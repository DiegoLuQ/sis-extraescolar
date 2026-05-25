"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { inscripcionesApi, talleresApi, alumnosApi } from "@/lib/api";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, Loader2, ArrowLeft, User, TrendingUp, AlertCircle, CheckCircle2, Filter, Plus, Search, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";
import type { Alumno } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AlumnoStats {
  inscripcion_id: string;
  alumno_id: string;
  nombre_alumno: string;
  rut_alumno: string;
  curso_alumno: string;
  estado: string;
  porcentaje_asistencia: number;
  total_sesiones: number;
  asistencias_contadas: number;
}

export default function TallerInscripcionesDetailPage() {
  const { tallerId } = useParams() as { tallerId: string };
  const router = useRouter();
  const [stats, setStats] = useState<AlumnoStats[]>([]);
  const [tallerInfo, setTallerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showHighAttendance, setShowHighAttendance] = useState(false);
  const [kpiThreshold, setKpiThreshold] = useState(90);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [allAlumnos, setAllAlumnos] = useState<Alumno[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCursos, setSelectedCursos] = useState<string[]>([]);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tallerId) fetchData();
  }, [tallerId]);

  const handleDownloadTemplate = async () => {
    try {
      const response = await inscripcionesApi.getTemplate();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "plantilla_inscripciones.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading template:", error);
    }
  };

  const handleExport = async () => {
    try {
      const response = await inscripcionesApi.exportByTaller(tallerId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `asistencia_${tallerInfo?.nombre_taller || tallerId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Excel generado correctamente");
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Error al exportar los datos");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
       const response = await inscripcionesApi.bulkUpload(tallerId, file);
       const { inserted, skipped, errors } = response.data;
       toast.success(`Importación completada — Insertados: ${inserted}, Saltados: ${skipped}, Errores: ${errors}`);
       await fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al importar");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const fetchData = async () => {
    try {
      const [statsData, talleresData] = await Promise.all([
        inscripcionesApi.getStatsByTaller(tallerId),
        talleresApi.getAll(),
      ]);
      setStats(statsData.data);
      const taller = talleresData.find((t: any) => t.id === tallerId);
      setTallerInfo(taller);
    } catch (error) {
      console.error("Error fetching workshop details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddStudent = async () => {
    setIsAddStudentOpen(true);
    try {
      const data = await alumnosApi.getAll();
      setAllAlumnos(data);
    } catch (error) {
      toast.error("Error al cargar listado de alumnos");
    }
  };

  const handleEnroll = async (alumnoId: string) => {
    setEnrollingId(alumnoId);
    try {
      await inscripcionesApi.create({
        taller_id: tallerId,
        alumno_id: alumnoId
      });
      toast.success("Alumno inscrito correctamente");
      await fetchData();
      // Remove from the local list so we don't enroll twice in the UI
      setAllAlumnos(prev => prev.filter(a => a.id !== alumnoId));
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al inscribir alumno");
    } finally {
      setEnrollingId(null);
    }
  };

  const cursosUnicos = Array.from(new Set(allAlumnos.map(a => a.curso).filter(Boolean))).sort();

  const availableAlumnos = allAlumnos.filter(a => 
    !stats.some(s => s.alumno_id === a.id && s.estado === "inscrito") &&
    (selectedCursos.length === 0 || (a.curso && selectedCursos.includes(a.curso))) &&
    (a.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) || 
     a.rut.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleRetirar = async (inscripcionId: string) => {
    const ok = await confirmDialog({
      title: "Retirar alumno",
      description: "¿Retirar al alumno del taller?",
      confirmText: "Retirar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await inscripcionesApi.update(inscripcionId, { estado: "retirado" });
      toast.success("Alumno retirado del taller");
      await fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Error al actualizar la inscripción");
    }
  };

  const filteredStats = showHighAttendance 
    ? stats.filter(s => s.porcentaje_asistencia >= kpiThreshold)
    : stats;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
      </div>
    );
  }

  if (!tallerInfo) {
    return <div className="text-center py-12">Taller no encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button variant="outline" size="icon" onClick={() => router.push("/dashboard/inscripciones")} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 break-words">{tallerInfo.nombre_taller}</h1>
            <p className="text-gray-500 mt-1 text-sm md:text-base">Lista de alumnos y monitoreo de asistencia</p>
          </div>
        </div>
        {user?.rol !== "monitor" && (
          <Button onClick={handleOpenAddStudent} className="bg-indigo-600 hover:bg-indigo-700 shadow-md w-full md:w-auto">
            <UserPlus className="h-4 w-4 mr-2" />
            Inscribir Alumno
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-2 w-full">
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="text-calipso-600 border-calipso-200 hover:bg-calipso-50 w-full sm:w-auto">
          <Download className="h-4 w-4 mr-2" />
          Descargar Plantilla
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing} className="border-calipso-200 hover:bg-calipso-50 w-full sm:w-auto">
          {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2 text-calipso-600" />}
          Importar Alumnos
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExport} 
          className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 w-full sm:w-auto"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImport}
          accept=".xlsx,.xls"
          className="hidden"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm bg-calipso-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg">
                <TrendingUp className="h-5 w-5 text-calipso-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Asistencia Promedio</p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {stats.length > 0 
                    ? (stats.reduce((acc, s) => acc + s.porcentaje_asistencia, 0) / stats.length).toFixed(1)
                    : 0}%
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 underline decoration-calipso-200">KPI Alta Asistencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {stats.filter(s => s.porcentaje_asistencia >= kpiThreshold).length} Alumnos
                </h3>
                <p className="text-xs text-gray-400 mt-1">Sobre el {kpiThreshold}%</p>
              </div>
              <Button 
                variant={showHighAttendance ? "default" : "outline"}
                size="sm"
                className={showHighAttendance ? "bg-calipso-500 hover:bg-calipso-600" : ""}
                onClick={() => setShowHighAttendance(!showHighAttendance)}
              >
                <Filter className="h-3 w-3 mr-2" />
                {showHighAttendance ? "Ver Todos" : "Filtrar KPI"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Sesiones Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="text-2xl font-bold text-gray-900">
              {stats.length > 0 ? stats[0].total_sesiones : 0} Registradas
            </h3>
            <p className="text-xs text-gray-400 mt-1">Hasta la fecha</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Listado de Alumnos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead className="text-center">Asistencia</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                    {showHighAttendance 
                      ? "Ningún alumno cumple el criterio del KPI"
                      : "No hay alumnos inscritos en este taller"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredStats.map((item) => (
                  <TableRow key={item.inscripcion_id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{item.nombre_alumno}</span>
                        <span className="text-xs text-gray-500">{item.rut_alumno}</span>
                      </div>
                    </TableCell>
                    <TableCell>{item.curso_alumno}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-full max-w-[100px] h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              item.porcentaje_asistencia >= kpiThreshold 
                                ? "bg-green-500" 
                                : item.porcentaje_asistencia >= 75 
                                  ? "bg-calipso-400" 
                                  : "bg-orange-400"
                            }`}
                            style={{ width: `${item.porcentaje_asistencia}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold">
                          {item.porcentaje_asistencia}% ({item.asistencias_contadas}/{item.total_sesiones})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={item.estado === "inscrito" ? "success" : "secondary"}>
                        {item.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.estado === "inscrito" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleRetirar(item.inscripcion_id)}
                        >
                          Retirar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Inscribir Alumno en {tallerInfo.nombre_taller}</DialogTitle>
            <DialogDescription>
              Busca y selecciona un alumno para inscribirlo en este taller. Solo se muestran alumnos que no están inscritos actualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col sm:flex-row gap-3 my-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre o RUT..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {/* Custom Multi-Select Dropdown que actúa como un Select */}
            <div className="relative w-full sm:w-64 shrink-0">
              <button
                type="button"
                onClick={() => setIsSelectOpen(!isSelectOpen)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <span className="truncate text-left flex-1 mr-2">
                  {selectedCursos.length === 0 
                    ? "Todos los cursos" 
                    : selectedCursos.length <= 2 
                      ? selectedCursos.join(", ") 
                      : `${selectedCursos.length} cursos selec.`}
                </span>
                <span className="text-xs text-gray-500 font-bold shrink-0">▼</span>
              </button>

              {isSelectOpen && (
                <div className="absolute right-0 top-11 z-50 w-full sm:w-64 rounded-md border bg-white shadow-lg outline-none overflow-hidden">
                  <div className="p-1.5 border-b flex justify-between items-center bg-gray-50 text-xs font-medium">
                    <button 
                      type="button" 
                      onClick={() => setSelectedCursos(cursosUnicos)}
                      className="text-calipso-600 hover:underline px-2 py-0.5"
                    >
                      Seleccionar todos
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setSelectedCursos([])}
                      className="text-gray-500 hover:underline px-2 py-0.5"
                    >
                      Limpiar
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto p-1 space-y-0.5">
                    {cursosUnicos.map((curso) => {
                      const isSelected = selectedCursos.includes(curso);
                      return (
                        <label
                          key={curso}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm hover:bg-gray-100 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setSelectedCursos(selectedCursos.filter(c => c !== curso));
                              } else {
                                setSelectedCursos([...selectedCursos, curso]);
                              }
                            }}
                            className="rounded border-gray-300 text-calipso-600 focus:ring-calipso-500 h-4 w-4 transition-colors"
                          />
                          <span className="text-gray-700 font-normal">{curso}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="p-1 border-t bg-gray-50 text-center">
                    <button
                      type="button"
                      onClick={() => setIsSelectOpen(false)}
                      className="text-xs font-semibold text-calipso-600 hover:underline w-full py-1"
                    >
                      Aplicar y cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableAlumnos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-gray-400">
                      {searchQuery ? "No se encontraron alumnos" : "Cargando alumnos..."}
                    </TableCell>
                  </TableRow>
                ) : (
                  availableAlumnos.slice(0, 50).map((alumno) => (
                    <TableRow key={alumno.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{alumno.nombre_completo}</span>
                          <span className="text-xs text-gray-500">{alumno.rut}</span>
                        </div>
                      </TableCell>
                      <TableCell>{alumno.curso}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          onClick={() => handleEnroll(alumno.id)}
                          disabled={enrollingId === alumno.id}
                        >
                          {enrollingId === alumno.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Inscribir"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsAddStudentOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

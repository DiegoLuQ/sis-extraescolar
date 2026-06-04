"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { alumnosApi, colegiosApi } from "@/lib/api";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import type { Alumno, AlumnoCreate, Colegio } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Loader2, Download, FileUp, Users, UserMinus, UserCheck, Database, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CURSOS = [
  "PKºA", "PKºB", "KºA", "KºB",
  "1ºA", "1ºB", "1ºC", "2ºA", "2ºB", "2ºC",
  "3ºA", "3ºB", "3ºC", "4ºA", "4ºB", "4ºC",
  "5ºA", "5ºB", "5ºC", "6ºA", "6ºB", "6ºC",
  "7ºA", "7ºB", "7ºC", "8ºA", "8ºB", "8ºC",
  "1ºMA", "1ºMB", "1ºMC", "2ºMA", "2ºMB", "2ºMC",
  "3ºMA", "3ºMB", "3ºMC", "4ºMA", "4ºMB", "4ºMC"
];

export default function AlumnosPage() {
  const user = useAuthStore((state) => state.user);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAlumno, setEditingAlumno] = useState<Alumno | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({ inscritos: 0, retirados: 0, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Estados para resultados de sincronización
  const [syncResults, setSyncResults] = useState<any>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Estados para selección de colegio (solo admin)
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [selectedColegioId, setSelectedColegioId] = useState<string>("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [formData, setFormData] = useState<AlumnoCreate>({
    rut: "",
    nombre_completo: "",
    curso: "",
    telefono: "",
  });

  useEffect(() => {
    fetchAlumnos();
  }, []);

  const fetchAlumnos = async () => {
    try {
      const [data, statsData] = await Promise.all([
        alumnosApi.getAll(),
        alumnosApi.getStats()
      ]);
      setAlumnos(data);
      setStats(statsData);
    } catch (error) {
      console.error("Error fetching alumnos data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingAlumno) {
        await alumnosApi.update(editingAlumno.id, {
          rut: formData.rut,
          nombre_completo: formData.nombre_completo,
          curso: formData.curso,
          telefono: formData.telefono,
        });
      } else {
        await alumnosApi.create(formData);
      }
      await fetchAlumnos();
      setIsDialogOpen(false);
      resetForm();
      toast.success(editingAlumno ? "Alumno actualizado" : "Alumno creado");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (alumno: Alumno) => {
    setEditingAlumno(alumno);
    setFormData({
      rut: alumno.rut,
      nombre_completo: alumno.nombre_completo,
      curso: alumno.curso,
      telefono: alumno.telefono || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Eliminar alumno",
      description: "¿Estás seguro de eliminar este alumno? Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await alumnosApi.delete(id);
      toast.success("Alumno eliminado");
      await fetchAlumnos();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Error al eliminar el alumno");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await alumnosApi.downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "planilla_alumnos.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error("Error al descargar la planilla");
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (user?.rol === 'admin') {
      setPendingFile(file);
      try {
        const data = await colegiosApi.getAll();
        setColegios(data);
        setIsSchoolModalOpen(true);
      } catch (error) {
        console.error("Error fetching colegios:", error);
        toast.error("Error al cargar la lista de colegios");
      }
      e.target.value = "";
      return;
    }

    await executeBulkUpload(file);
    e.target.value = "";
  };

  const executeBulkUpload = async (file: File, colegioId?: string) => {
    setSaving(true);
    try {
      const result = await alumnosApi.bulkUpload(file, colegioId);
      const { stats } = result;
      toast.success(
        `Importación completada — Insertados: ${stats.inserted}, Actualizados: ${stats.updated}, Errores: ${stats.errors}`
      );
      await fetchAlumnos();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al subir el archivo");
    } finally {
      setSaving(false);
    }
  };

  const confirmBulkUpload = async () => {
    if (!pendingFile || !selectedColegioId) {
      toast.error("Debes seleccionar un colegio");
      return;
    }
    await executeBulkUpload(pendingFile, selectedColegioId);
    setIsSchoolModalOpen(false);
    setPendingFile(null);
    setSelectedColegioId("");
  };

  const handleSyncExternal = async () => {
    setSyncing(true);
    const id = toast.loading("Conectando con bases de datos MySQL externas e importando alumnos...");
    try {
      const res = await alumnosApi.syncExternal();
      toast.success("Sincronización de alumnos finalizada exitosamente", { id });
      setSyncResults(res.results);
      setIsSyncModalOpen(true);
      await fetchAlumnos();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Error al sincronizar bases de datos externas", { id });
    } finally {
      setSyncing(false);
    }
  };

  const resetForm = () => {
    setFormData({ rut: "", nombre_completo: "", curso: "", telefono: "" });
    setEditingAlumno(null);
  };

  const filteredAlumnos = alumnos.filter(
    (a) =>
      a.rut.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.curso.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredAlumnos.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedAlumnos = filteredAlumnos.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alumnos</h1>
          <p className="text-gray-500 mt-1">Gestión de alumnos registrados</p>
        </div>
        {user?.rol !== 'monitor' && (
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button variant="outline" onClick={handleDownloadTemplate} disabled={saving} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Descargar Planilla
            </Button>
            
            <input
              type="file"
              id="bulk-upload"
              className="hidden"
              accept=".xlsx"
              onChange={handleBulkUpload}
            />
            <Button 
              variant="outline" 
              onClick={() => document.getElementById('bulk-upload')?.click()}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4 mr-2" />
              )}
              Importar Excel
            </Button>

            {(user?.rol === "admin" || user?.rol === "coordinador") && (
              <Button
                variant="outline"
                className="border-calipso-500 text-calipso-600 hover:bg-calipso-50 w-full sm:w-auto"
                onClick={handleSyncExternal}
                disabled={syncing || saving}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Sincronizar BD Externa
              </Button>
            )}

            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-calipso-500 hover:bg-calipso-600 w-full sm:w-auto" disabled={saving}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Alumno
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingAlumno ? "Editar Alumno" : "Nuevo Alumno"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingAlumno
                      ? "Modifica los datos del alumno"
                      : "Ingresa los datos del nuevo alumno"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="rut">RUT</Label>
                        <Input
                          id="rut"
                          value={formData.rut}
                          onChange={(e) =>
                            setFormData({ ...formData, rut: e.target.value })
                          }
                          placeholder="00000000-0"
                          required
                        />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nombre_completo">Nombre Completo</Label>
                      <Input
                        id="nombre_completo"
                        value={formData.nombre_completo}
                        onChange={(e) =>
                          setFormData({ ...formData, nombre_completo: e.target.value })
                        }
                        placeholder="Juan Pérez González"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="curso">Curso</Label>
                      <Select 
                        value={formData.curso} 
                        onValueChange={(value) => setFormData({ ...formData, curso: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un curso..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {CURSOS.map((curso) => (
                            <SelectItem key={curso} value={curso}>
                              {curso}
                            </SelectItem>
                          ))}
                          {formData.curso && !CURSOS.includes(formData.curso) && (
                            <SelectItem key={formData.curso} value={formData.curso}>
                              {formData.curso} (Formato antiguo)
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefono">Teléfono</Label>
                      <Input
                        id="telefono"
                        value={formData.telefono || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, telefono: e.target.value })
                        }
                        placeholder="9823959479"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingAlumno ? "Guardar" : "Crear"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Alumnos</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</h3>
              </div>
              <div className="bg-blue-50 p-3 rounded-full">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Inscritos Activos</p>
                <h3 className="text-2xl font-bold text-green-600 mt-1">{stats.inscritos}</h3>
              </div>
              <div className="bg-green-50 p-3 rounded-full">
                <UserCheck className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Retirados</p>
                <h3 className="text-2xl font-bold text-red-600 mt-1">{stats.retirados}</h3>
              </div>
              <div className="bg-red-50 p-3 rounded-full">
                <UserMinus className="h-6 w-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Selección de Colegio para Admin */}
      <Dialog open={isSchoolModalOpen} onOpenChange={setIsSchoolModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleccionar Colegio de Destino</DialogTitle>
            <DialogDescription>
              Estás a punto de subir alumnos masivamente. Por favor selecciona el colegio al que pertenecen.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Colegio</Label>
              <Select value={selectedColegioId} onValueChange={setSelectedColegioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un colegio..." />
                </SelectTrigger>
                <SelectContent>
                  {colegios.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre_colegio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSchoolModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmBulkUpload} disabled={!selectedColegioId || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Comenzar Importación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Resultados de Sincronización */}
      <Dialog open={isSyncModalOpen} onOpenChange={setIsSyncModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <Database className="h-5 w-5 text-calipso-500" />
              Sincronización de Base de Datos
            </DialogTitle>
            <DialogDescription>
              Resumen del proceso de importación y actualización de alumnos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {syncResults && Object.keys(syncResults).length > 0 ? (
              Object.entries(syncResults).map(([schoolName, data]: [string, any]) => (
                <div key={schoolName} className="border border-gray-100 rounded-lg p-4 bg-gray-50/50 space-y-3">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="font-semibold text-gray-800 text-sm md:text-base">{schoolName}</span>
                    <Badge variant={data.status === "success" ? "success" : "destructive"}>
                      {data.status === "success" ? "Completado" : "Error"}
                    </Badge>
                  </div>
                  
                  {data.status === "success" ? (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-white p-3 rounded-md border border-gray-100 shadow-sm flex flex-col">
                        <span className="text-xs text-gray-400 font-medium">Alumnos Agregados</span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-xl font-bold text-green-600">
                            {data.stats?.inserted ?? 0}
                          </span>
                          <span className="text-xs text-gray-400">nuevos</span>
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded-md border border-gray-100 shadow-sm flex flex-col">
                        <span className="text-xs text-gray-400 font-medium">Alumnos Editados</span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-xl font-bold text-blue-600">
                            {data.stats?.updated ?? 0}
                          </span>
                          <span className="text-xs text-gray-400">actualizados</span>
                        </div>
                      </div>

                      {data.stats?.errors > 0 && (
                        <div className="bg-white p-3 rounded-md border border-gray-100 shadow-sm flex flex-col col-span-2">
                          <span className="text-xs text-red-400 font-medium">Errores en Registros</span>
                          <span className="text-xl font-bold text-red-600 mt-1">
                            {data.stats.errors}
                          </span>
                        </div>
                      )}
                      
                      <div className="col-span-2 text-xs text-gray-500 text-right mt-1">
                        Total consultados: <span className="font-semibold">{data.extracted ?? 0}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-100">
                      <strong>Error:</strong> {data.detail || "Error desconocido al procesar la sincronización."}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">
                No se obtuvieron resultados de sincronización.
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              className="bg-calipso-500 hover:bg-calipso-600 text-white w-full sm:w-auto" 
              onClick={() => setIsSyncModalOpen(false)}
            >
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2 w-full">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <Input
              placeholder="Buscar alumnos..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full md:max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>RUT</TableHead>
                <TableHead>Nombre Completo</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                {user?.rol !== 'monitor' && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAlumnos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                    No hay alumnos registrados
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAlumnos.map((alumno, index) => (
                  <TableRow key={alumno.id}>
                    <TableCell className="text-gray-500 font-medium">
                      {(safeCurrentPage - 1) * itemsPerPage + index + 1}
                    </TableCell>
                    <TableCell className="font-medium">{alumno.rut}</TableCell>
                    <TableCell>{alumno.nombre_completo}</TableCell>
                    <TableCell>{alumno.curso}</TableCell>
                    <TableCell className="font-mono text-sm text-gray-600">
                      {alumno.telefono || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={alumno.is_active ? "success" : "secondary"}>
                        {alumno.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    {user?.rol !== 'monitor' && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEdit(alumno)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDelete(alumno.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
              <div className="text-sm text-gray-500">
                Mostrando <span className="font-medium">{(safeCurrentPage - 1) * itemsPerPage + 1}</span> a{" "}
                <span className="font-medium">
                  {Math.min(safeCurrentPage * itemsPerPage, filteredAlumnos.length)}
                </span>{" "}
                de <span className="font-medium">{filteredAlumnos.length}</span> alumnos
              </div>
              <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={safeCurrentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={safeCurrentPage === page ? "default" : "outline"}
                    size="sm"
                    className={safeCurrentPage === page ? "bg-calipso-500 hover:bg-calipso-600" : ""}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={safeCurrentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

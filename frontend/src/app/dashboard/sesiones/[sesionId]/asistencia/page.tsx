"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { sesionesApi, talleresApi, inscripcionesApi, asistenciaApi, alumnosApi } from "@/lib/api";
import type { Sesion, Taller, Inscripcion, Alumno } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { confirmDialog, alertDialog } from "@/components/ui/confirm-dialog";
import {
  Loader2, ArrowLeft, CheckCircle, XCircle, AlertTriangle,
  Save, User, ClipboardCheck, Lock, Unlock, UserPlus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";

const LISTA_CURSOS = [
  "PKºA", "PKºB", "KºA", "KºB",
  "1ºA", "1ºB", "1ºC", "2°A", "2ºB", "2ºC",
  "3ºA", "3ºB", "3ºC", "4ºA", "4ºB", "4ºC",
  "5°A", "5°B", "5°C", "6°A", "6°B", "6°C",
  "7°A", "7°B", "7°C", "8°A", "8°B", "8°C",
  "1°M A", "1°M B", "1°M C", 
  "2°M A", "2°M B", "2°M C", 
  "3°M A", "3°M B", "3°M C", 
  "4°M A", "4°M B", "4°M C"
];

const normalizeCourse = (c: string) => {
  if (!c) return "";
  return c
    .toLowerCase()
    .replace(/º/g, "°")
    .replace(/\s+/g, "")
    .trim();
};

export default function AsistenciaPage() {
  const { sesionId } = useParams() as { sesionId: string };
  const router = useRouter();
  
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [taller, setTaller] = useState<Taller | null>(null);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [alumnos, setAlumnos] = useState<Map<string, Alumno>>(new Map());
  const [asistencias, setAsistencias] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [absentFromSchool, setAbsentFromSchool] = useState<any[]>([]);
  
  // Roles e interactividad
  const { user } = useAuthStore();
  const [userRole, setUserRole] = useState<string>("");
  const [togglingBloqueo, setTogglingBloqueo] = useState(false);

  // Inscripción rápida desde la sesión
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [allAlumnos, setAllAlumnos] = useState<Alumno[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  useEffect(() => {
    let r = user?.rol?.toLowerCase() || "";
    if (!r) {
      const storedAuth = localStorage.getItem("auth-storage");
      if (storedAuth) {
        try {
          const parsed = JSON.parse(storedAuth);
          r = parsed?.state?.user?.rol?.toLowerCase() || "";
        } catch (e) {}
      }
    }
    setUserRole(r);

    if (sesionId) {
      fetchData();
      fetchAbsentFromSchool();
    }
  }, [sesionId, user]);

  const fetchAbsentFromSchool = async () => {
    try {
      const data = await sesionesApi.getAbsentFromSchool(sesionId);
      setAbsentFromSchool(data);
    } catch (error) {
      console.error("Error fetching absent from school:", error);
    }
  };

  const handleOpenAddStudent = async () => {
    try {
      const data = await alumnosApi.getAll(0, 5000, undefined, true);
      setAllAlumnos(data.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, "es")));
    } catch {
      toast.error("Error al cargar el listado de alumnos");
      return;
    }
    setSearchQuery("");
    setSelectedCourse("");
    setIsAddStudentOpen(true);
  };

  const handleEnroll = async (alumnoId: string) => {
    if (!sesion) return;
    setEnrollingId(alumnoId);
    try {
      await inscripcionesApi.create({ taller_id: sesion.taller_id, alumno_id: alumnoId });
      toast.success("Alumno inscrito correctamente");
      setIsAddStudentOpen(false);
      await fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al inscribir al alumno");
    } finally {
      setEnrollingId(null);
    }
  };

  const fetchData = async () => {
    try {
      const sesionData = await sesionesApi.getById(sesionId);
      setSesion(sesionData);

      const talleres = await talleresApi.getAll();
      const t = talleres.find(t => t.id === sesionData.taller_id);
      setTaller(t || null);

      const insData = await inscripcionesApi.getAll(sesionData.taller_id);
      const activas = insData.filter(i => i.estado === "inscrito");
      setInscripciones(activas);

      const alumnosMap = new Map<string, Alumno>();
      const asistenciasMap = new Map<string, string>();
      
      const [prevAsistencias, alumnosTaller] = await Promise.all([
        asistenciaApi.getBySesion(sesionId),
        alumnosApi.getAll(0, 500, sesionData.taller_id)
      ]);

      prevAsistencias.forEach(a => {
        asistenciasMap.set(a.alumno_id, a.estado_asistencia);
      });

      alumnosTaller.forEach(alu => {
        alumnosMap.set(alu.id, alu);
      });

      activas.forEach(ins => {
        if (!asistenciasMap.has(ins.alumno_id)) {
          asistenciasMap.set(ins.alumno_id, "");
        }
      });
      
      setAlumnos(alumnosMap);
      setAsistencias(asistenciasMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Error al cargar los datos de la sesión");
    } finally {
      setLoading(false);
    }
  };

  const isLockedForCurrentUser = sesion?.bloqueada && userRole.includes("monitor");
  const canToggleLock = userRole.includes("admin") || userRole.includes("coordinador");

  const handleSave = async () => {
    if (!sesion) return;
    if (isLockedForCurrentUser) {
      toast.error("La sesión está bloqueada y no puede ser modificada.");
      return;
    }
    
    const incompletos = inscripciones.some(i => !asistencias.get(i.alumno_id));
    if (incompletos) {
      toast.warning("Hay alumnos sin estado de asistencia marcado");
    }

    setSaving(true);
    try {
      const lista = Array.from(asistencias.entries())
        .filter(([_, estado]) => estado !== "")
        .map(([alumnoId, estado]) => ({
          alumno_id: alumnoId,
          estado_asistencia: estado as "presente" | "ausente" | "justificado" | "atraso",
        }));

      await asistenciaApi.bulk({
        sesion_id: sesionId,
        lista,
      });
      
      toast.success("Asistencia guardada correctamente");
      router.push("/dashboard/sesiones");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al guardar asistencia");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBloqueo = async () => {
    if (!sesion) return;
    const nextBloqueada = !sesion.bloqueada;
    
    const ok = await confirmDialog({
      title: nextBloqueada ? "Cerrar Sesiones Activa y Anteriores" : "Reabrir Sesión",
      description: nextBloqueada 
        ? "¿Estás seguro de cerrar definitivamente la sesión del día actual y todas las sesiones anteriores de este taller? Pasarán a modo de solo lectura para los monitores y si existen inconsistencias de asistencia en la fecha actual, se enviará un reporte automático a los correos autorizados."
        : "¿Estás seguro de desbloquear la sesión? Los monitores podrán volver a editar el estado de asistencia.",
      confirmText: nextBloqueada ? "Cerrar Sesiones" : "Reabrir",
      destructive: nextBloqueada,
    });
    
    if (!ok) return;
    
    setTogglingBloqueo(true);
    try {
      const res = await sesionesApi.toggleCierre(sesionId, nextBloqueada);
      setSesion(prev => prev ? { ...prev, bloqueada: res.bloqueada } : null);
      toast.success(nextBloqueada ? "Sesión actual y anteriores cerradas correctamente" : "Sesión desbloqueada para su edición");
      
      if (res.mail_report) {
        if (res.mail_report.sent) {
          toast.success(`Alerta enviada automáticamente a ${res.mail_report.recipients} destinatario(s) autorizados.`);
        } else if (res.mail_report.status !== "no_alerts" && res.mail_report.status !== "no_recipients") {
          console.log("Estado de envío:", res.mail_report.status);
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al cambiar el estado de la sesión");
    } finally {
      setTogglingBloqueo(false);
    }
  };

  const updateAsistencia = async (alumnoId: string, estado: string) => {
    if (isLockedForCurrentUser) return;

    if (estado === "presente") {
      const isAbsentFromSchool = absentFromSchool.some(a => a.alumno_id === alumnoId);
      if (isAbsentFromSchool) {
        const alu = alumnos.get(alumnoId);
        await alertDialog({
          title: "Alerta de Inconsistencia",
          description: (
            <div className="space-y-2">
              <p>
                El alumno <b>{alu?.nombre_completo}</b> está siendo marcado como <b>PRESENTE</b> en el taller, pero figura como <b>AUSENTE</b> en el libro de clases del colegio.
              </p>
              <p className="text-amber-700 bg-amber-50 p-2 rounded text-sm">
                Se enviará una notificación automática por correo a los destinatarios autorizados informando esta inconsistencia.
              </p>
            </div>
          ),
          confirmText: "Entendido, marcar como presente",
        });

        // Enviar correo de alerta
        try {
          const res = await sesionesApi.notificarInconsistencia(sesionId, alumnoId);
          if (res?.mail_report?.sent) {
            toast.success(`Alerta enviada a ${res.mail_report.recipients} destinatario(s) autorizado(s).`, { duration: 5000 });
          }
        } catch (err) {
          console.error("Error al enviar notificación de inconsistencia:", err);
        }
      }
    }
    setAsistencias(prev => new Map(prev).set(alumnoId, estado));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
      </div>
    );
  }

  if (!sesion || !taller) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Sesión no encontrada</p>
        <Button variant="link" onClick={() => router.push("/dashboard/sesiones")}>
          Volver a sesiones
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn">
      {/* Banner de estado bloqueado */}
      {sesion.bloqueada && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-900">Sesión Cerrada y Protegida</p>
              <p className="text-xs text-amber-700">
                Esta sesión ha sido auditada y cerrada por coordinación. Los registros se encuentran en modo de solo lectura.
              </p>
            </div>
          </div>
          {userRole === "monitor" && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-semibold shrink-0">
              Solo Lectura
            </Badge>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push("/dashboard/sesiones")} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tomar Asistencia</h1>
            <p className="text-gray-500 text-sm">
              {taller.nombre_taller} — {(() => {
                const [y, m, d] = sesion.fecha_sesion.split('-').map(Number);
                return new Date(y, m - 1, d).toLocaleDateString("es-CL", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });
              })()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {canToggleLock && (
            <Button
              type="button"
              variant={sesion.bloqueada ? "outline" : "secondary"}
              onClick={handleToggleBloqueo}
              disabled={togglingBloqueo}
              className={cn(
                "shadow-sm transition-all font-semibold",
                !sesion.bloqueada && "bg-amber-500 hover:bg-amber-600 text-white"
              )}
            >
              {togglingBloqueo ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : sesion.bloqueada ? (
                <Unlock className="h-4 w-4 mr-2 text-calipso-600" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              {sesion.bloqueada ? "Reabrir Sesión" : "Cerrar Sesión"}
            </Button>
          )}

          <Button 
            onClick={handleSave} 
            disabled={saving || isLockedForCurrentUser} 
            className="bg-calipso-500 hover:bg-calipso-600 shadow-md transition-all active:scale-95"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Finalizar y Guardar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-0 shadow-lg">
          <CardHeader className="border-b bg-gray-50/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-calipso-500" />
                Listado de Alumnos
              </CardTitle>
              {!isLockedForCurrentUser && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenAddStudent}
                  className="gap-2 text-calipso-600 border-calipso-200 hover:bg-calipso-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Inscribir Alumno
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Alumno</TableHead>
                  <TableHead className="hidden sm:table-cell">RUT</TableHead>
                  <TableHead className="pr-6 text-right sm:text-left">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inscripciones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-gray-400">
                      No hay alumnos inscritos en este taller
                    </TableCell>
                  </TableRow>
                ) : (
                  inscripciones.map((ins) => {
                    const alu = alumnos.get(ins.alumno_id);
                    const estado = asistencias.get(ins.alumno_id) || "";
                    const isAbsentInSchool = absentFromSchool.some(a => a.alumno_id === ins.alumno_id);
                    
                    return (
                      <TableRow 
                        key={ins.id} 
                        className={cn(
                          "hover:bg-gray-50/50 transition-colors",
                          isAbsentInSchool && "bg-red-50/30 hover:bg-red-50/50",
                          isLockedForCurrentUser && "opacity-80"
                        )}
                      >
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <div className="font-semibold text-gray-900 flex items-center gap-2">
                                {alu?.nombre_completo || "Cargando..."}
                                {absentFromSchool.some(a => a.alumno_id === ins.alumno_id) && (
                                  <Badge className="bg-red-100 text-red-700 border-red-200 text-[9px] font-bold h-4 px-1 flex gap-1 animate-pulse">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    AUSENTE COLEGIO
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 font-medium">{alu?.curso}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-gray-500 text-sm">{alu?.rut}</TableCell>
                        <TableCell className="pr-6 text-right sm:text-left">
                          <div className={cn(
                            "flex bg-gray-100/80 p-1 rounded-xl w-fit border border-gray-200",
                            isLockedForCurrentUser && "opacity-60 cursor-not-allowed bg-gray-200/50"
                          )}>
                            <button
                              type="button"
                              disabled={isLockedForCurrentUser}
                              onClick={() => updateAsistencia(ins.alumno_id, "presente")}
                              className={cn(
                                "flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200",
                                estado === "presente" 
                                  ? "bg-white text-green-600 shadow-sm ring-1 ring-black/5" 
                                  : "text-gray-400 hover:text-gray-700 hover:bg-white/50",
                                isLockedForCurrentUser && "cursor-not-allowed"
                              )}
                              title="Asiste"
                            >
                              <CheckCircle className={cn("h-4 w-4 sm:h-3.5 sm:w-3.5", estado === "presente" ? "text-green-500" : "text-gray-400")} />
                              <span className="hidden sm:inline">Asiste</span>
                            </button>
                            <button
                              type="button"
                              disabled={isLockedForCurrentUser}
                              onClick={() => updateAsistencia(ins.alumno_id, "ausente")}
                              className={cn(
                                "flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200",
                                estado === "ausente" 
                                  ? "bg-white text-red-600 shadow-sm ring-1 ring-black/5" 
                                  : "text-gray-400 hover:text-gray-700 hover:bg-white/50",
                                isLockedForCurrentUser && "cursor-not-allowed"
                              )}
                              title="Ausente"
                            >
                              <XCircle className={cn("h-4 w-4 sm:h-3.5 sm:w-3.5", estado === "ausente" ? "text-red-500" : "text-gray-400")} />
                              <span className="hidden sm:inline">Ausente</span>
                            </button>
                            <button
                              type="button"
                              disabled={isLockedForCurrentUser}
                              onClick={() => updateAsistencia(ins.alumno_id, "justificado")}
                              className={cn(
                                "flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200",
                                estado === "justificado" 
                                  ? "bg-white text-amber-600 shadow-sm ring-1 ring-black/5" 
                                  : "text-gray-400 hover:text-gray-700 hover:bg-white/50",
                                isLockedForCurrentUser && "cursor-not-allowed"
                              )}
                              title="Justificado"
                            >
                              <AlertTriangle className={cn("h-4 w-4 sm:h-3.5 sm:w-3.5", estado === "justificado" ? "text-amber-500" : "text-gray-400")} />
                              <span className="hidden sm:inline">Justificado</span>
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-0 shadow-md bg-white overflow-hidden">
            <CardHeader className="bg-gray-50/50 py-3 border-b">
              <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-wider">Control de Sesión</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center p-2 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Total</span>
                  <span className="text-lg font-bold text-gray-700">{inscripciones.length}</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-green-50 rounded-lg border border-green-100">
                  <span className="text-[10px] text-green-600 font-bold uppercase">Pres.</span>
                  <span className="text-lg font-bold text-green-700">
                    {Array.from(asistencias.values()).filter(v => v === "presente" || v === "atraso").length}
                  </span>
                </div>
                <div className="flex flex-col items-center p-2 bg-red-50 rounded-lg border border-red-100">
                  <span className="text-[10px] text-red-600 font-bold uppercase">Aus.</span>
                  <span className="text-lg font-bold text-red-700">
                    {Array.from(asistencias.values()).filter(v => v === "ausente").length}
                  </span>
                </div>
              </div>

              {sesion.tematica && (
                <div className="pt-2">
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Temática</p>
                  <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded border border-dashed border-gray-200">{sesion.tematica}</p>
                </div>
              )}

              {!isLockedForCurrentUser && (
                <div className="flex items-start gap-2 p-2 bg-yellow-50 rounded-lg border border-yellow-100">
                  <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-yellow-800 leading-tight">
                    Guarda los cambios antes de salir.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {absentFromSchool.length > 0 && (
            <Card className="border-0 shadow-md border-l-4 border-l-red-500 overflow-hidden">
              <CardHeader className="bg-red-50/50 py-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-red-500" />
                    <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Alertas Colegio</span>
                  </div>
                  <Badge className="bg-red-500 text-white border-0 text-[10px] h-5">
                    {absentFromSchool.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-red-100">
                  {absentFromSchool.map(alu => (
                    <div key={alu.alumno_id} className="flex justify-between items-center bg-gray-50 p-2 rounded-md border border-gray-100 transition-hover hover:bg-red-50/30">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-gray-800 leading-tight">{alu.nombre_completo}</span>
                        <span className="text-[9px] text-gray-400">{alu.rut}</span>
                      </div>
                      <span className="text-[9px] font-black bg-white px-1.5 py-0.5 rounded border border-gray-100 text-gray-500">{alu.curso}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal de inscripción rápida */}
      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-calipso-500" />
              Inscribir Alumno al Taller
            </DialogTitle>
            <DialogDescription>
              Busca por nombre o RUT. El alumno quedará inscrito en{" "}
              <span className="font-semibold text-gray-700">{taller?.nombre_taller}</span> y
              podrás marcar su asistencia de inmediato.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Input
                autoFocus
                placeholder="Buscar por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <Select
                value={selectedCourse || "__all__"}
                onValueChange={(v) => setSelectedCourse(v === "__all__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por curso..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="__all__">Todos los cursos</SelectItem>
                  {LISTA_CURSOS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {(() => {
              const enrolledIds = new Set(inscripciones.map((i) => i.alumno_id));
              const q = searchQuery.toLowerCase().trim();

              const filtered = allAlumnos.filter((a) => {
                if (enrolledIds.has(a.id)) return false;
                if (selectedCourse && normalizeCourse(a.curso) !== normalizeCourse(selectedCourse)) return false;
                if (q && !a.nombre_completo.toLowerCase().includes(q) && !a.rut.toLowerCase().includes(q)) return false;
                return true;
              });

              const shouldShow = !!selectedCourse || !!q;

              if (!shouldShow) {
                return (
                  <p className="text-center py-6 text-sm text-gray-400">
                    Selecciona un curso o escribe un nombre para buscar.
                  </p>
                );
              }

              if (filtered.length === 0) {
                return (
                  <p className="text-center py-6 text-sm text-gray-400">
                    No se encontraron alumnos disponibles.
                  </p>
                );
              }

              return filtered.map((alu) => (
                <div
                  key={alu.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-gray-800 truncate">
                      {alu.nombre_completo}
                    </span>
                    <span className="text-xs text-gray-400">{alu.curso}</span>
                  </div>
                  <Button
                    size="sm"
                    disabled={enrollingId === alu.id}
                    onClick={() => handleEnroll(alu.id)}
                    className="ml-3 shrink-0 bg-calipso-500 hover:bg-calipso-600 text-white"
                  >
                    {enrollingId === alu.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Inscribir"
                    )}
                  </Button>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

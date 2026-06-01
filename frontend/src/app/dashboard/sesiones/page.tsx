"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { sesionesApi, talleresApi } from "@/lib/api";
import type { Sesion, Taller } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Calendar, BookOpen, CheckCircle, XCircle, Clock, AlertTriangle, Trash2, User, X, Filter, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function SesionesPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modales
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCierreGlobalOpen, setIsCierreGlobalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closingGlobal, setClosingGlobal] = useState(false);
  const [existingSesionWarning, setExistingSesionWarning] = useState<Sesion | null>(null);

  // Formulario de Nueva Sesión
  const [selectedTaller, setSelectedTaller] = useState<string>("");
  const [selectedTallerData, setSelectedTallerData] = useState<Taller | null>(null);
  const [fechaSesion, setFechaSesion] = useState<string>(() => {
    const now = new Date();
    return now.getFullYear() + "-" + 
           String(now.getMonth() + 1).padStart(2, '0') + "-" + 
           String(now.getDate()).padStart(2, '0');
  });
  const [tematica, setTematica] = useState<string>("");

  // Formulario de Cierre Global
  const [cierreGlobalFecha, setCierreGlobalFecha] = useState<string>(() => {
    const now = new Date();
    return now.getFullYear() + "-" + 
           String(now.getMonth() + 1).padStart(2, '0') + "-" + 
           String(now.getDate()).padStart(2, '0');
  });

  // Filtros
  const [filterFecha, setFilterFecha] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());

  const months = [
    { value: "01", label: "Enero" }, { value: "02", label: "Febrero" }, { value: "03", label: "Marzo" },
    { value: "04", label: "Abril" }, { value: "05", label: "Mayo" }, { value: "06", label: "Junio" },
    { value: "07", label: "Julio" }, { value: "08", label: "Agosto" }, { value: "09", label: "Septiembre" },
    { value: "10", label: "Octubre" }, { value: "11", label: "Noviembre" }, { value: "12", label: "Diciembre" }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sesionesData, talleresData] = await Promise.all([
        sesionesApi.getAll().catch(() => []),
        talleresApi.getAll().catch(() => []),
      ]);
      
      setSesiones(Array.isArray(sesionesData) ? sesionesData : []);
      setTalleres(Array.isArray(talleresData) ? talleresData.filter((t) => t.is_active) : []);
    } catch (error) {
      toast.error("Error al cargar datos. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSesion = async (e?: React.FormEvent, force: boolean = false) => {
    if (e) e.preventDefault();
    if (!selectedTaller || !fechaSesion) {
      toast.error("Por favor selecciona un taller y una fecha");
      return;
    }

    const existing = sesiones.find(s => 
      s.taller_id === selectedTaller && 
      s.fecha_sesion === fechaSesion
    );

    if (existing && !force) {
      setExistingSesionWarning(existing);
      return;
    }

    setSaving(true);
    try {
      const newSesion = await sesionesApi.create({
        taller_id: selectedTaller,
        fecha_sesion: fechaSesion,
        tematica: tematica || undefined,
      });
      
      setIsDialogOpen(false);
      setExistingSesionWarning(null);
      setSelectedTaller("");
      setSelectedTallerData(null);
      setTematica("");
      toast.success("Sesión creada");
      
      router.push(`/dashboard/sesiones/${newSesion.id}/asistencia`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al crear sesión");
    } finally {
      setSaving(false);
    }
  };

  const handleCierreGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cierreGlobalFecha) {
      toast.error("Selecciona la fecha para realizar el cierre global");
      return;
    }

    setClosingGlobal(true);
    try {
      const res = await sesionesApi.cierreGlobal(cierreGlobalFecha);
      toast.success(`Cierre global exitoso: ${res.sesiones_cerradas} sesión(es) bloqueada(s)`);
      setIsCierreGlobalOpen(false);
      
      if (res.mail_report?.sent) {
        toast.success(`Reporte de auditoría enviado a ${res.mail_report.recipients} correo(s) habilitado(s).`);
      }

      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al ejecutar el cierre masivo de sesiones");
    } finally {
      setClosingGlobal(false);
    }
  };

  const handleDeleteSesion = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta sesión? Se eliminará toda la asistencia registrada.")) {
      return;
    }
    try {
      await sesionesApi.delete(id);
      toast.success("Sesión eliminada");
      fetchData();
    } catch (error) {
      toast.error("Error al eliminar sesión");
    }
  };

  const handleTallerChange = (id: string) => {
    setSelectedTaller(id);
    const taller = talleres.find(t => t.id === id);
    setSelectedTallerData(taller || null);
  };

  const formatFecha = (fecha: string) => {
    const parts = fecha.split('-');
    if (parts.length !== 3) return fecha;
    
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    
    const date = new Date(year, month, day);
    
    return date.toLocaleDateString("es-CL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const canManageCierre = user?.rol === "admin" || user?.rol === "coordinador";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Sesiones</h1>
          <p className="text-gray-500 text-sm mt-1 max-w-2xl">
            Gestión y control de asistencia. Filtra por fecha para auditar clases pasadas o realiza cierres consolidados.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          {canManageCierre && (
            <Button 
              variant="outline"
              onClick={() => setIsCierreGlobalOpen(true)} 
              className="border-amber-500 text-amber-600 hover:bg-amber-50 font-bold px-4 h-12 rounded-xl transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto"
            >
              <Lock className="h-4 w-4 mr-2 text-amber-500 shrink-0" />
              <span className="truncate">Cerrar Sesiones del Día</span>
            </Button>
          )}

          <Button 
            onClick={() => setIsDialogOpen(true)} 
            className="bg-calipso-500 hover:bg-calipso-600 font-bold shadow-lg shadow-calipso-100 px-6 h-12 rounded-xl transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto"
          >
            <Plus className="h-5 w-5 mr-2 shrink-0" />
            <span className="truncate">Nueva Sesión</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 self-start md:self-auto shrink-0">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filtrar por:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
            {/* Fecha Exacta */}
            <div className="relative w-full sm:w-44">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-calipso-500 pointer-events-none" />
              <Input 
                type="date" 
                className="pl-9 w-full h-11 border-gray-200 rounded-xl focus:ring-calipso-500 focus:border-calipso-500 text-sm font-medium" 
                value={filterFecha}
                onChange={(e) => {
                  setFilterFecha(e.target.value);
                  setFilterMonth("");
                  setFilterYear("");
                }}
              />
            </div>

            {/* Mes */}
            <Select value={filterMonth} onValueChange={(v) => {
              setFilterMonth(v);
              setFilterFecha("");
              if (!filterYear) setFilterYear(currentYear.toString());
            }}>
              <SelectTrigger className="w-full sm:w-40 h-11 border-gray-200 rounded-xl text-sm font-medium">
                <SelectValue placeholder="Seleccionar Mes" />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Año */}
            <Select value={filterYear} onValueChange={(v) => {
              setFilterYear(v);
              setFilterFecha("");
            }}>
              <SelectTrigger className="w-full sm:w-32 h-11 border-gray-200 rounded-xl text-sm font-medium">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botón Limpiar */}
        {(filterFecha || filterMonth || filterYear !== currentYear.toString()) && (
          <Button 
            variant="ghost" 
            onClick={() => {
              setFilterFecha("");
              setFilterMonth("");
              setFilterYear(currentYear.toString());
            }}
            className="text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors font-bold text-xs flex items-center justify-center gap-2 px-4 py-2 w-full lg:w-auto h-11 rounded-xl"
          >
            <X className="h-4 w-4" />
            Limpiar Filtros
          </Button>
        )}
      </div>

      {/* Modal de Cierre Global */}
      <Dialog open={isCierreGlobalOpen} onOpenChange={setIsCierreGlobalOpen}>
        <DialogContent className="max-w-md border-amber-100 bg-amber-50/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              <Lock className="h-5 w-5 text-amber-500" />
              Cierre Global de Sesiones
            </DialogTitle>
            <DialogDescription className="text-xs text-amber-800/80">
              Esta operación bloqueará de forma consolidada todas las clases activas y pasadas del establecimiento hasta la fecha seleccionada, y enviará un único reporte resumen a los destinatarios autorizados.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCierreGlobal}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cierre-fecha" className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Fecha de Cierre Límite
                </Label>
                <Input
                  id="cierre-fecha"
                  type="date"
                  value={cierreGlobalFecha}
                  onChange={(e) => setCierreGlobalFecha(e.target.value)}
                  className="focus-visible:ring-amber-500 h-11 font-medium"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCierreGlobalOpen(false)} disabled={closingGlobal}>
                Cancelar
              </Button>
              <Button type="submit" disabled={closingGlobal} className="bg-amber-500 hover:bg-amber-600 text-white font-bold">
                {closingGlobal ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Consolidando...
                  </>
                ) : (
                  "Confirmar Cierre Global"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Nueva Sesión */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Sesión</DialogTitle>
            <DialogDescription>
              Crea una nueva sesión para un taller
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSesion}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Taller</Label>
                <Select value={selectedTaller} onValueChange={handleTallerChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un taller" />
                  </SelectTrigger>
                  <SelectContent>
                    {talleres.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No tienes talleres asignados
                      </SelectItem>
                    ) : (
                      talleres.map((taller) => (
                        <SelectItem key={taller.id} value={taller.id} className="py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-gray-900">{taller.nombre_taller}</span>
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="text-gray-900 font-bold bg-gray-200/60 px-1.5 py-0.5 rounded">
                                {taller.nombre_colegio}
                              </span>
                              <span className="text-gray-400">
                                Monitor: <span className="text-gray-600 font-medium">
                                  {taller.nombre_profesor ||
                                    (taller.profesor_id === user?.id ? (user?.nombre_2 || user?.nombre) : "No asignado")}
                                </span>
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedTallerData && (
                <div className="p-4 bg-calipso-50 rounded-lg space-y-3 border border-calipso-100 shadow-sm">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[10px] text-calipso-600 font-bold uppercase tracking-wider">Colegio</p>
                      <p className="text-gray-900 font-medium">{selectedTallerData.nombre_colegio}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-calipso-600 font-bold uppercase tracking-wider">Monitor</p>
                      <p className="text-gray-900 font-medium">
                        {selectedTallerData.nombre_profesor ||
                          (selectedTallerData.profesor_id === user?.id ? (user?.nombre_2 || user?.nombre) : "No asignado")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-calipso-600 font-bold uppercase tracking-wider">Horario</p>
                      <p className="text-gray-900 font-medium">{selectedTallerData.dia} {selectedTallerData.hora_inicio}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-calipso-600 font-bold uppercase tracking-wider">Cupos Disp.</p>
                      <p className="text-gray-900 font-medium">{selectedTallerData.cupos_maximos}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={fechaSesion}
                  onChange={(e) => setFechaSesion(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Temática (opcional)</Label>
                <Input
                  value={tematica}
                  onChange={(e) => setTematica(e.target.value)}
                  placeholder="Tema de la clase"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !selectedTaller} className="bg-calipso-500 hover:bg-calipso-600">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar Sesión
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alerta de sesión duplicada */}
      <Dialog open={!!existingSesionWarning} onOpenChange={(open) => !open && setExistingSesionWarning(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-amber-500 p-6 flex flex-col items-center text-white text-center">
            <div className="bg-white/20 p-3 rounded-full mb-4 backdrop-blur-sm">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-bold">Sesión ya Registrada</h2>
            <p className="text-amber-50 text-sm mt-1 opacity-90">
              Ya existe una sesión para este taller el día de hoy
            </p>
          </div>

          <div className="p-6 space-y-6 bg-white">
            {existingSesionWarning && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="bg-amber-100 p-2 rounded-lg mt-1">
                    <BookOpen className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Taller Seleccionado</p>
                    <p className="text-gray-900 font-bold text-lg leading-tight">
                      {talleres.find(t => t.id === existingSesionWarning.taller_id)?.nombre_taller}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Monitor</p>
                      <p className="text-sm font-semibold text-gray-700">
                        {talleres.find(t => t.id === existingSesionWarning.taller_id)?.nombre_profesor || "No asignado"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Horario</p>
                      <p className="text-sm font-semibold text-gray-700">
                        {talleres.find(t => t.id === existingSesionWarning.taller_id)?.hora_inicio || "--:--"} hrs
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button 
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-12 rounded-xl shadow-lg shadow-amber-100 transition-all hover:scale-[1.02] active:scale-95"
                onClick={() => {
                  if (existingSesionWarning) {
                    router.push(`/dashboard/sesiones/${existingSesionWarning.id}/asistencia`);
                  }
                }}
              >
                Ir a la sesión existente
              </Button>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  className="flex-1 text-gray-500 hover:bg-gray-50 h-11 rounded-xl font-medium"
                  onClick={() => setExistingSesionWarning(null)}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50 h-11 rounded-xl font-medium"
                  onClick={() => handleCreateSesion(undefined, true)}
                  disabled={saving}
                >
                  Crear nueva sesión
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Listado de sesiones */}
      <div className="grid gap-3">
        {(() => {
          const filtered = sesiones.filter(s => {
            if (filterFecha) return s.fecha_sesion === filterFecha;
            
            const [sYear, sMonth] = s.fecha_sesion.split("-");
            const matchMonth = filterMonth ? sMonth === filterMonth : true;
            const matchYear = filterYear ? sYear === filterYear : true;
            
            return matchMonth && matchYear;
          });
          
          if (filtered.length === 0) {
            return (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-gray-400">
                  No se encontraron sesiones con los filtros aplicados.
                </CardContent>
              </Card>
            );
          }
          return filtered.map((sesion) => {
            const tallerName = sesion.nombre_taller || talleres.find(t => t.id === sesion.taller_id)?.nombre_taller || "Taller desconocido";
            
            return (
              <Card key={sesion.id} className="border-0 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden bg-white">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row items-stretch">
                    <div className="flex-1 p-4 flex flex-col justify-center">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${sesion.bloqueada ? "bg-amber-50 text-amber-600" : "bg-calipso-50 text-calipso-600"}`}>
                          {sesion.bloqueada ? <Lock className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className="font-black text-gray-900 text-base sm:text-lg leading-tight break-words">{tallerName}</h3>
                            {sesion.bloqueada && (
                              <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                                CERRADA
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                            <span className="text-[11px] font-bold text-gray-400 uppercase flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span className="truncate">{formatFecha(sesion.fecha_sesion)}</span>
                            </span>
                            {sesion.tematica && (
                              <>
                                <span className="text-gray-300 hidden sm:inline">•</span>
                                <span className="text-[11px] font-medium text-amber-600 italic truncate max-w-xs block w-full sm:w-auto sm:inline">
                                  {sesion.tematica}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50/50 md:border-l border-t md:border-t-0 border-gray-100 flex items-center px-4 py-3 md:px-6 md:py-0 w-full md:w-auto justify-center">
                      <div className="grid grid-cols-4 gap-1 sm:gap-4 w-full md:flex md:items-center md:gap-6 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Inscritos</span>
                          <span className="text-sm font-black text-gray-700">{sesion.total_inscritos || 0}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black text-green-500 uppercase tracking-tighter">Pres.</span>
                          <span className="text-sm font-black text-green-600">{sesion.total_presentes || 0}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter">Aus.</span>
                          <span className="text-sm font-black text-red-600">{sesion.total_ausentes || 0}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter">Disp.</span>
                          <span className="text-sm font-black text-indigo-600">{sesion.cupos_disponibles || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 flex items-center justify-between md:justify-start gap-2 border-t md:border-t-0 md:border-l border-gray-100 w-full md:w-auto">
                      <Button 
                        size="sm"
                        variant={sesion.bloqueada ? "outline" : "default"}
                        onClick={() => router.push(`/dashboard/sesiones/${sesion.id}/asistencia`)} 
                        className={sesion.bloqueada ? "border-amber-200 text-amber-700 font-bold text-xs flex-1 md:flex-initial" : "bg-calipso-500 hover:bg-calipso-600 shadow-sm font-bold text-xs flex-1 md:flex-initial"}
                      >
                        {sesion.bloqueada ? "Ver Auditoría" : "Asistencia"}
                      </Button>
                      {canManageCierre && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                          onClick={() => handleDeleteSesion(sesion.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          });
        })()}
      </div>
    </div>
  );
}

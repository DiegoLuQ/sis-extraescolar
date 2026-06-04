"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { usuariosApi, alumnosApi, talleresApi, estadisticasApi, inscripcionesApi } from "@/lib/api";
import type { TallerOcupacion, AusentismoTaller, AlertaInasistencia, TallerAusentismoDetalle, Taller, AlumnoAsistenciaDetalle, EstadoAsistencia } from "@/types";
import {
  Users, GraduationCap, BookOpen, AlertTriangle,
  TrendingUp, Activity, Trash2, ChevronLeft, ChevronRight, Loader2, Phone, Eye, CreditCard, FileDown,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 10;

const ESTADO_ASISTENCIA: Record<EstadoAsistencia, { label: string; className: string }> = {
  presente: { label: "Asiste", className: "bg-green-100 text-green-700 border-green-200" },
  ausente: { label: "Ausente", className: "bg-red-100 text-red-700 border-red-200" },
  justificado: { label: "Justificado", className: "bg-blue-100 text-blue-700 border-blue-200" },
  atraso: { label: "Atraso", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  sin_registro: { label: "Sin registro", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

const formatFecha = (fecha: string) => {
  const d = new Date(`${fecha}T00:00:00`);
  return isNaN(d.getTime()) ? fecha : d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
};

type AlertaRow = TallerAusentismoDetalle & {
  alumno_id: string;
  nombre_completo: string;
  curso: string;
  telefono?: string;
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [usuariosCount, setUsuariosCount] = useState(0);
  const [alumnosCount, setAlumnosCount] = useState(0);
  const [talleresCount, setTalleresCount] = useState(0);
  const [ocupacion, setOcupacion] = useState<TallerOcupacion[]>([]);
  const [ausentismo, setAusentismo] = useState<AusentismoTaller[]>([]);
  const [alertas, setAlertas] = useState<AlertaInasistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertaPage, setAlertaPage] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [talleresList, setTalleresList] = useState<Taller[]>([]);
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroTaller, setFiltroTaller] = useState("");
  const [selectedAlumnoPhones, setSelectedAlumnoPhones] = useState<{ nombre: string; phones: string[] } | null>(null);

  // Estado para el modal de detalle de asistencia
  const [detalleAlumno, setDetalleAlumno] = useState<AlumnoAsistenciaDetalle | null>(null);
  const [isDetalleOpen, setIsDetalleOpen] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const isCoordinador = user?.rol === "coordinador" || user?.rol === "admin";
      const [usuarios, alumnos, talleres, ocupacionData, ausentismoData, alertasData] = await Promise.all([
        usuariosApi.getAll(),
        alumnosApi.getAll(),
        talleresApi.getAll(),
        estadisticasApi.ocupacion(),
        estadisticasApi.ausentismo(),
        isCoordinador ? estadisticasApi.alertasInasistencias() : Promise.resolve([]),
      ]);
      setUsuariosCount(usuarios.length);
      setAlumnosCount(alumnos.length);
      setTalleresCount(talleres.length);
      setTalleresList(talleres);
      setOcupacion(ocupacionData);
      setAusentismo(ausentismoData);
      setAlertas(alertasData);
      setAlertaPage(0);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.rol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEliminarInscripcion = async (inscripcionId: string, alumnoNombre: string, tallerNombre: string) => {
    const ok = await confirmDialog({
      title: "Retirar del Taller",
      description: `¿Retirar a ${alumnoNombre} del taller "${tallerNombre}"?`,
      confirmText: "Retirar",
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(inscripcionId);
    try {
      await inscripcionesApi.update(inscripcionId, { estado: "retirado" });
      toast.success("Alumno retirado del taller correctamente");
      await fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al retirar al alumno");
    } finally {
      setDeletingId(null);
    }
  };

  const handleVerDetalle = async (alumnoId: string) => {
    setIsDetalleOpen(true);
    setLoadingDetalle(true);
    setDetalleAlumno(null);
    try {
      const data = await estadisticasApi.detalleAsistencia(alumnoId);
      setDetalleAlumno(data);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al cargar el detalle de asistencia");
      setIsDetalleOpen(false);
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleExportDetallePDF = () => {
    if (!detalleAlumno) return;
    const d = detalleAlumno;
    const esc = (s: string | null | undefined) =>
      (s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
    const fechaGen = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });

    const talleresHtml = d.talleres.length === 0
      ? `<p class="empty">El alumno no tiene talleres con inscripción activa.</p>`
      : d.talleres.map((t) => {
          const rows = t.sesiones.map((s) => {
            const est = ESTADO_ASISTENCIA[s.estado] ?? ESTADO_ASISTENCIA.sin_registro;
            return `<tr>
              <td class="nowrap">${esc(formatFecha(s.fecha))}</td>
              <td>${esc(s.tematica || "—")}</td>
              <td><span class="badge ${s.estado}">${esc(est.label)}</span></td>
            </tr>`;
          }).join("");
          const stats = [
            `${t.presentes} asiste`,
            `${t.ausentes} ausente`,
            ...(t.justificados ? [`${t.justificados} justif.`] : []),
            ...(t.atrasos ? [`${t.atrasos} atraso`] : []),
            `${t.total_sesiones} ses.`,
          ].join(" · ");
          return `<div class="taller">
            <div class="taller-head">
              <span class="taller-name">${esc(t.nombre_taller)}</span>
              <span class="taller-stats">${stats}</span>
            </div>
            ${t.sesiones.length === 0
              ? `<p class="empty">Sin sesiones registradas.</p>`
              : `<table><thead><tr><th>Fecha</th><th>Temática</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table>`}
          </div>`;
        }).join("");

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" />
      <title>Detalle de Asistencia - ${esc(d.nombre_completo)}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; margin: 32px; }
        h1 { font-size: 18px; margin: 0 0 4px; color: #0e7490; }
        .sub { font-size: 11px; color: #6b7280; margin: 0 0 20px; }
        .info { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin-bottom: 22px; background: #f9fafb; }
        .info .name { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
        .info .meta { font-size: 12px; color: #374151; }
        .info .meta span { margin-right: 18px; }
        .info .meta b { color: #111827; }
        .taller { border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid; }
        .taller-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; background: #f3f4f6; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
        .taller-name { font-weight: 700; font-size: 13px; }
        .taller-stats { font-size: 11px; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; padding: 6px 12px; border-bottom: 1px solid #e5e7eb; background: #fff; }
        td { font-size: 12px; padding: 6px 12px; border-bottom: 1px solid #f3f4f6; }
        .nowrap { white-space: nowrap; }
        .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; border: 1px solid; }
        .badge.presente { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
        .badge.ausente { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
        .badge.justificado { background: #dbeafe; color: #1d4ed8; border-color: #bfdbfe; }
        .badge.atraso { background: #fef9c3; color: #a16207; border-color: #fde68a; }
        .badge.sin_registro { background: #f3f4f6; color: #6b7280; border-color: #e5e7eb; }
        .empty { font-size: 12px; color: #9ca3af; padding: 10px 12px; }
        .footer { margin-top: 24px; font-size: 10px; color: #9ca3af; text-align: right; }
        @page { margin: 0; }
        @media print { body { margin: 0; padding: 12mm; } }
      </style></head><body>
      <h1>Detalle de Asistencia</h1>
      <p class="sub">Resumen de asistencia e inasistencia por taller</p>
      <div class="info">
        <div class="name">${esc(d.nombre_completo)}</div>
        <div class="meta">
          <span>Curso: <b>${esc(d.curso)}</b></span>
          <span>RUT: <b>${esc(d.rut)}</b></span>
          <span>Teléfono: <b>${esc(d.telefono || "—")}</b></span>
        </div>
      </div>
      ${talleresHtml}
      <div class="footer">Generado el ${esc(fechaGen)}</div>
      <script>window.onload = function () { window.focus(); window.print(); };</script>
    </body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Permite las ventanas emergentes para exportar el PDF");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  // Flatten: one row per (alumno × taller)
  const alertaRows: AlertaRow[] = alertas.flatMap(a =>
    a.talleres.map(t => ({
      alumno_id: a.alumno_id,
      nombre_completo: a.nombre_completo,
      curso: a.curso,
      telefono: a.telefono,
      ...t,
    }))
  );

  const filteredAlertaRows = alertaRows.filter(row => {
    const matchNombre = row.nombre_completo.toLowerCase().includes(filtroNombre.toLowerCase());
    const matchTaller = !filtroTaller || row.taller_id === filtroTaller;
    return matchNombre && matchTaller;
  });

  const totalPages = Math.ceil(filteredAlertaRows.length / PAGE_SIZE);
  const safeAlertaPage = Math.min(alertaPage, Math.max(0, totalPages - 1));
  const pagedRows = filteredAlertaRows.slice(safeAlertaPage * PAGE_SIZE, (safeAlertaPage + 1) * PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-calipso-500" />
      </div>
    );
  }

  const stats = [
    {
      title: "Usuarios",
      value: usuariosCount,
      description: "Usuarios registrados",
      icon: Users,
      color: "bg-calipso-500",
      show: user?.rol !== "monitor",
    },
    {
      title: "Alumnos",
      value: alumnosCount,
      description: "Alumnos activos",
      icon: GraduationCap,
      color: "bg-indigo-500",
      show: true,
    },
    {
      title: "Talleres",
      value: talleresCount,
      description: "Talleres disponibles",
      icon: BookOpen,
      color: "bg-green-500",
      show: true,
    },
    {
      title: "Alertas",
      value: alertaRows.length,
      description: "Alumnos con >70% inasistencia",
      icon: AlertTriangle,
      color: "bg-red-500",
      show: user?.rol === "coordinador" || user?.rol === "admin",
    },
  ].filter(s => s.show);

  const isCoordinadorOrAdmin = user?.rol === "coordinador" || user?.rol === "admin";

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            ¡Hola, {user?.nombre_2 || user?.nombre}! 👋
          </h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">
            Bienvenido de nuevo al panel de gestión extraescolar.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl shadow-sm border border-calipso-100 w-fit">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sistema Online</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-0 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden bg-white">
            <CardContent className="p-0">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-xl ${stat.color} bg-opacity-10 text-calipso-600 transition-transform group-hover:scale-110 duration-300`}>
                    <stat.icon className={cn("h-6 w-6", stat.color.replace("bg-", "text-"))} />
                  </div>
                  <Badge variant="outline" className="text-[10px] border-gray-100 text-gray-400 font-bold">
                    Hoy
                  </Badge>
                </div>
                <div className="mt-4">
                  <p className="text-2xl md:text-3xl font-black text-gray-900">{stat.value}</p>
                  <p className="text-sm font-bold text-gray-500 mt-0.5">{stat.title}</p>
                  <p className="text-[11px] text-gray-400 mt-1 font-medium">{stat.description}</p>
                </div>
              </div>
              <div className={cn("h-1.5 w-full", stat.color)} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ocupación y Ausentismo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-calipso-500" />
              Ocupación de Talleres
            </CardTitle>
            <CardDescription>Porcentaje de cupos ocupados por taller</CardDescription>
          </CardHeader>
          <CardContent>
            {ocupacion.length === 0 ? (
              <p className="text-gray-400 text-sm">No hay datos disponibles</p>
            ) : (
              <div className="max-h-[380px] overflow-y-auto pr-2 space-y-4">
                {ocupacion.map((taller) => (
                  <div key={taller.taller_id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{taller.nombre_taller}</span>
                      <span className="text-gray-500">
                        {taller.inscripciones_activas}/{taller.cupos_maximos}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-calipso-500 rounded-full transition-all"
                        style={{ width: `${taller.porcentaje_ocupacion}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-500" />
              Ausentismo por Taller
            </CardTitle>
            <CardDescription>Porcentaje de inasistencias registrado</CardDescription>
          </CardHeader>
          <CardContent>
            {ausentismo.length === 0 ? (
              <p className="text-gray-400 text-sm">No hay datos disponibles</p>
            ) : (
              <div className="max-h-[380px] overflow-y-auto pr-2 space-y-4">
                {ausentismo.map((taller) => (
                  <div key={taller.taller_id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{taller.nombre_taller}</span>
                      <Badge
                        variant={
                          taller.porcentaje_ausentismo > 20
                            ? "destructive"
                            : taller.porcentaje_ausentismo > 10
                            ? "warning"
                            : "success"
                        }
                      >
                        {taller.porcentaje_ausentismo.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          taller.porcentaje_ausentismo > 20 ? "bg-red-500"
                          : taller.porcentaje_ausentismo > 10 ? "bg-yellow-500"
                          : "bg-green-500"
                        )}
                        style={{ width: `${Math.min(taller.porcentaje_ausentismo, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla de alta inasistencia — solo coordinador/admin */}
      {isCoordinadorOrAdmin && alertaRows.length > 0 && (
        <Card className="border-0 shadow-md border-l-4 border-l-red-500">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Alumnos con Alta Inasistencia
                </CardTitle>
                <CardDescription className="mt-1">
                  Alumnos con más del 70% de inasistencia — se sugiere seguimiento o retiro del taller
                </CardDescription>
              </div>
              <Badge className="bg-red-100 text-red-700 border-red-200 shrink-0 text-xs">
                {filteredAlertaRows.length} {filteredAlertaRows.length === 1 ? "registro" : "registros"}
              </Badge>
            </div>

            {/* Panel de Filtros */}
            <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full">
              <div className="flex-1">
                <Input
                  placeholder="Buscar alumno por nombre..."
                  value={filtroNombre}
                  onChange={(e) => {
                    setFiltroNombre(e.target.value);
                    setAlertaPage(0);
                  }}
                  className="bg-white border-gray-200 text-sm focus:border-calipso-400 focus:ring-calipso-400 focus:ring-1"
                />
              </div>
              <div className="w-full sm:w-72">
                <select
                  value={filtroTaller}
                  onChange={(e) => {
                    setFiltroTaller(e.target.value);
                    setAlertaPage(0);
                  }}
                  className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-calipso-400 focus:border-calipso-400"
                >
                  <option value="">Todos los talleres</option>
                  {talleresList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre_taller} {user?.rol === "admin" && !localStorage.getItem("colegio_id") ? `(${t.nombre_colegio})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredAlertaRows.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No hay registros que coincidan con los filtros aplicados.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <TableHead className="pl-6">Alumno</TableHead>
                      <TableHead>Curso</TableHead>
                      <TableHead>Taller</TableHead>
                      <TableHead>Inasistencia</TableHead>
                      <TableHead className="pr-6 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((row, i) => (
                      <TableRow key={`${row.alumno_id}-${row.inscripcion_id ?? i}`} className="hover:bg-red-50/30">
                        <TableCell className="pl-6 font-medium text-gray-900">
                          {row.nombre_completo}
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">{row.curso}</TableCell>
                        <TableCell className="text-gray-700 text-sm">{row.nombre_taller}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{row.ausencias}/{row.total_sesiones} ses.</span>
                            <Badge variant="destructive" className="text-xs">{row.porcentaje_ausencia}%</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                              onClick={() => handleVerDetalle(row.alumno_id)}
                              title="Detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {row.telefono ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-calipso-600 hover:text-calipso-800 hover:bg-calipso-50"
                                onClick={() => {
                                  const phonesList = row.telefono
                                    ? row.telefono.split("/").map(p => p.trim()).filter(Boolean)
                                    : [];
                                  setSelectedAlumnoPhones({
                                    nombre: row.nombre_completo,
                                    phones: phonesList
                                  });
                                }}
                                title="Ver teléfonos de contacto"
                              >
                                <Phone className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-gray-300 cursor-not-allowed"
                                disabled
                                title="Sin teléfono registrado"
                              >
                                <Phone className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              disabled={deletingId === row.inscripcion_id || !row.inscripcion_id}
                              onClick={() => handleEliminarInscripcion(row.inscripcion_id, row.nombre_completo, row.nombre_taller)}
                              title="Retirar del taller"
                            >
                              {deletingId === row.inscripcion_id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Trash2 className="h-4 w-4" />
                              }
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50/50">
                    <span className="text-xs text-gray-400">
                      Página {safeAlertaPage + 1} de {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={safeAlertaPage === 0}
                        onClick={() => setAlertaPage(p => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={safeAlertaPage >= totalPages - 1}
                        onClick={() => setAlertaPage(p => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal de Teléfonos */}
      <Dialog
        open={selectedAlumnoPhones !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedAlumnoPhones(null);
        }}
      >
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-0 shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-calipso-700 text-lg font-bold">
              <Phone className="h-5 w-5 text-calipso-500" />
              Teléfonos de Contacto
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-sm">
              Números registrados para el alumno: <strong className="text-gray-700 font-semibold">{selectedAlumnoPhones?.nombre}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {selectedAlumnoPhones?.phones && selectedAlumnoPhones.phones.length > 0 ? (
              <div className="space-y-3">
                {selectedAlumnoPhones.phones.map((phone, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-calipso-50/20 transition-all duration-300"
                  >
                    <span className="font-mono text-sm font-bold text-gray-700 tracking-wide">{phone}</span>
                    <a
                      href={`tel:${phone}`}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-green-500 hover:bg-green-600 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Llamar
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No hay teléfonos de contacto registrados para este alumno.
              </p>
            )}
          </div>

          <DialogFooter className="sm:justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => setSelectedAlumnoPhones(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalle de Asistencia — solo coordinador/admin */}
      {isCoordinadorOrAdmin && (
        <Dialog
          open={isDetalleOpen}
          onOpenChange={(open) => {
            setIsDetalleOpen(open);
            if (!open) setDetalleAlumno(null);
          }}
        >
          <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border-0 shadow-lg">
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2 text-calipso-700 text-lg font-bold">
                <Eye className="h-5 w-5 text-calipso-500" />
                Detalle de Asistencia
              </DialogTitle>
              <DialogDescription className="text-gray-500 text-sm">
                Resumen de asistencia e inasistencia del alumno en todos sus talleres.
              </DialogDescription>
            </DialogHeader>

            {loadingDetalle ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
              </div>
            ) : detalleAlumno ? (
              <div className="flex flex-col min-h-0 flex-1 gap-4 py-2">
                {/* Datos del alumno (fijo) */}
                <div className="shrink-0 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                  <p className="text-base font-bold text-gray-900">{detalleAlumno.nombre_completo}</p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <GraduationCap className="h-4 w-4 text-gray-400" />
                      <span>{detalleAlumno.curso}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <CreditCard className="h-4 w-4 text-gray-400" />
                      <span className="font-mono">{detalleAlumno.rut}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="font-mono">{detalleAlumno.telefono || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Talleres (scroll) */}
                {detalleAlumno.talleres.length === 0 ? (
                  <p className="text-center py-6 text-gray-400 text-sm">
                    El alumno no tiene talleres con inscripción activa.
                  </p>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                  {detalleAlumno.talleres.map((taller) => (
                    <div key={taller.taller_id} className="rounded-2xl border border-gray-100 overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-4 py-3 border-b border-gray-100">
                        <span className="font-semibold text-gray-800 text-sm">{taller.nombre_taller}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-[11px]">
                            {taller.presentes} asiste
                          </Badge>
                          <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">
                            {taller.ausentes} ausente
                          </Badge>
                          {taller.justificados > 0 && (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[11px]">
                              {taller.justificados} justif.
                            </Badge>
                          )}
                          {taller.atrasos > 0 && (
                            <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[11px]">
                              {taller.atrasos} atraso
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[11px] text-gray-500">
                            {taller.total_sesiones} ses.
                          </Badge>
                        </div>
                      </div>

                      {taller.sesiones.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-gray-400">Sin sesiones registradas.</p>
                      ) : (
                        <div className="max-h-56 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-white hover:bg-white">
                                <TableHead className="pl-4 sticky top-0 z-10 bg-white">Fecha</TableHead>
                                <TableHead className="sticky top-0 z-10 bg-white">Temática</TableHead>
                                <TableHead className="pr-4 text-right sticky top-0 z-10 bg-white">Estado</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {taller.sesiones.map((sesion, idx) => {
                                const estado = ESTADO_ASISTENCIA[sesion.estado] ?? ESTADO_ASISTENCIA.sin_registro;
                                return (
                                  <TableRow key={`${taller.taller_id}-${idx}`}>
                                    <TableCell className="pl-4 text-sm text-gray-700 whitespace-nowrap">
                                      {formatFecha(sesion.fecha)}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">
                                      {sesion.tematica || "—"}
                                    </TableCell>
                                    <TableCell className="pr-4 text-right">
                                      <Badge className={cn("text-[11px] border", estado.className)}>
                                        {estado.label}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center py-6 text-gray-400 text-sm">
                No se pudo cargar el detalle.
              </p>
            )}

            <DialogFooter className="shrink-0 gap-2 sm:justify-between">
              <Button
                variant="outline"
                className="rounded-xl gap-2 border-calipso-200 text-calipso-700 hover:bg-calipso-50"
                onClick={handleExportDetallePDF}
                disabled={loadingDetalle || !detalleAlumno}
              >
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setIsDetalleOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

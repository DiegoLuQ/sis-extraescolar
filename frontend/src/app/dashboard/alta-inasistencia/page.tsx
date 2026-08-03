"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { estadisticasApi, talleresApi, colegiosApi, inscripcionesApi } from "@/lib/api";
import type { AlertaInasistencia, TallerAusentismoDetalle, Taller, Colegio, AlumnoAsistenciaDetalle, EstadoAsistencia } from "@/types";
import {
  AlertTriangle, Phone, Eye, Trash2, ChevronLeft, ChevronRight, Loader2, FileDown,
  Search, Filter, GraduationCap, School, BookOpen, RefreshCw, XCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 12;

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

export default function AltaInasistenciaPage() {
  const { user } = useAuthStore();
  const [alertas, setAlertas] = useState<AlertaInasistencia[]>([]);
  const [talleresList, setTalleresList] = useState<Taller[]>([]);
  const [colegiosList, setColegiosList] = useState<Colegio[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtros
  const [filtroQuery, setFiltroQuery] = useState("");
  const [filtroTaller, setFiltroTaller] = useState("");
  const [filtroColegio, setFiltroColegio] = useState("");
  const [filtroMinAusencias, setFiltroMinAusencias] = useState<number>(3);
  const [page, setPage] = useState(0);

  // Modal Teléfonos & Detalle
  const [selectedAlumnoPhones, setSelectedAlumnoPhones] = useState<{ nombre: string; phones: string[] } | null>(null);
  const [detalleAlumno, setDetalleAlumno] = useState<AlumnoAsistenciaDetalle | null>(null);
  const [isDetalleOpen, setIsDetalleOpen] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertasData, talleresData, colegiosData] = await Promise.all([
        estadisticasApi.alertasInasistencias({
          min_ausencias: filtroMinAusencias,
          colegio_id: filtroColegio || undefined,
          taller_id: filtroTaller || undefined,
        }),
        talleresApi.getAll(),
        user?.rol === "admin" ? colegiosApi.getAll().catch(() => []) : Promise.resolve([]),
      ]);
      setAlertas(alertasData);
      setTalleresList(talleresData);
      setColegiosList(colegiosData);
      setPage(0);
    } catch (error) {
      console.error("Error al cargar reporte de alta inasistencia:", error);
      toast.error("Error al cargar datos de inasistencia");
    } finally {
      setLoading(false);
    }
  }, [filtroMinAusencias, filtroColegio, filtroTaller, user?.rol]);

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
        .sub { font-size: 12px; color: #6b7280; margin: 0 0 16px; }
        .info { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
        .info .name { font-size: 16px; font-weight: bold; color: #111827; }
        .info .meta { font-size: 12px; color: #4b5563; margin-top: 4px; display: flex; gap: 16px; flex-wrap: wrap; }
        .taller { margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .taller-head { background: #f3f4f6; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; }
        .taller-name { font-size: 14px; font-weight: bold; color: #111827; }
        .taller-stats { font-size: 11px; color: #4b5563; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #fafafa; text-align: left; padding: 8px 12px; color: #4b5563; font-weight: 600; border-bottom: 1px solid #e5e7eb; }
        td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; }
        tr:last-child td { border-bottom: none; }
        .nowrap { whitespace: nowrap; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; border: 1px solid transparent; }
        .badge.presente { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
        .badge.ausente { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }
        .badge.justificado { background: #dbeafe; color: #1d4ed8; border-color: #bfdbfe; }
        .badge.atraso { background: #fef9c3; color: #a16207; border-color: #fef08a; }
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

  // Aplana la estructura (1 fila por alumno x taller)
  const alertaRows: AlertaRow[] = alertas.flatMap((a) =>
    a.talleres.map((t) => ({
      alumno_id: a.alumno_id,
      nombre_completo: a.nombre_completo,
      curso: a.curso,
      telefono: a.telefono,
      ...t,
    }))
  );

  const filteredRows = alertaRows.filter((row) => {
    const q = filtroQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      row.nombre_completo.toLowerCase().includes(q) ||
      row.curso.toLowerCase().includes(q);
    const matchTaller = !filtroTaller || row.taller_id === filtroTaller;
    return matchQuery && matchTaller;
  });

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pagedRows = filteredRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Reporte de Alta Inasistencia
              <Badge variant="destructive" className="text-xs px-2.5 py-0.5">
                {filteredRows.length} {filteredRows.length === 1 ? "caso" : "casos"}
              </Badge>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Alumnos con faltas reiteradas acumuladas en talleres extraescolares (umbral mayor a 3 ausencias)
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="self-start md:self-auto gap-2 text-xs font-semibold"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Actualizar Datos
        </Button>
      </div>

      {/* Card Principal con Filtros y Tabla */}
      <Card className="border-0 shadow-md border-l-4 border-l-red-500 overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Filter className="w-4 h-4 text-calipso-600" /> Filtros de Búsqueda
            </div>
          </div>

          {/* Panel de Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filtro por Nombre / Curso */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Buscar por alumno o curso..."
                value={filtroQuery}
                onChange={(e) => {
                  setFiltroQuery(e.target.value);
                  setPage(0);
                }}
                className="pl-9 bg-white border-slate-200 text-xs focus:border-calipso-500"
              />
            </div>

            {/* Filtro por Taller */}
            <div>
              <select
                value={filtroTaller}
                onChange={(e) => {
                  setFiltroTaller(e.target.value);
                  setPage(0);
                }}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-calipso-500 focus:border-calipso-500 font-medium"
              >
                <option value="">Todos los talleres</option>
                {talleresList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre_taller} {user?.rol === "admin" && t.nombre_colegio ? `(${t.nombre_colegio})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Mínimo de Ausencias */}
            <div>
              <select
                value={filtroMinAusencias}
                onChange={(e) => {
                  setFiltroMinAusencias(Number(e.target.value));
                  setPage(0);
                }}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-calipso-500 focus:border-calipso-500 font-medium"
              >
                <option value={3}>Más de 3 ausencias (&gt; 3)</option>
                <option value={5}>Más de 5 ausencias (&gt; 5)</option>
                <option value={1}>Todas las inasistencias (&ge; 1)</option>
              </select>
            </div>

            {/* Filtro Colegio (Solo Admin) */}
            {user?.rol === "admin" && colegiosList.length > 0 && (
              <div>
                <select
                  value={filtroColegio}
                  onChange={(e) => {
                    setFiltroColegio(e.target.value);
                    setPage(0);
                  }}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-calipso-500 focus:border-calipso-500 font-medium"
                >
                  <option value="">Todos los establecimientos</option>
                  {colegiosList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre_colegio}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 text-calipso-500 animate-spin" />
              <p className="text-xs font-semibold">Cargando reporte de inasistencias...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <XCircle className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No se encontraron registros de alta inasistencia</p>
              <p className="text-xs text-slate-400">Intenta ajustando los filtros de búsqueda o el umbral de ausencias.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="pl-6 text-xs font-bold text-slate-700">Alumno</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Curso</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Taller</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Ausencias / Total</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">% Ausentismo</TableHead>
                    <TableHead className="pr-6 text-right text-xs font-bold text-slate-700">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((row, i) => (
                    <TableRow key={`${row.alumno_id}-${row.inscripcion_id ?? i}`} className="hover:bg-red-50/20">
                      <TableCell className="pl-6 font-semibold text-slate-900 text-xs sm:text-sm">
                        {row.nombre_completo}
                      </TableCell>
                      <TableCell className="text-slate-600 text-xs">{row.curso}</TableCell>
                      <TableCell className="text-slate-800 text-xs font-medium">{row.nombre_taller}</TableCell>
                      <TableCell className="text-xs text-slate-600 font-medium">
                        <strong className="text-rose-600 font-bold">{row.ausencias}</strong> de {row.total_sesiones} sesiones
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-xs font-bold">
                          {row.porcentaje_ausencia}%
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                            onClick={() => handleVerDetalle(row.alumno_id)}
                            title="Ver Detalle completo de Asistencias"
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
                                  ? row.telefono.split("/").map((p) => p.trim()).filter(Boolean)
                                  : [];
                                setSelectedAlumnoPhones({
                                  nombre: row.nombre_completo,
                                  phones: phonesList,
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
                              className="h-8 w-8 p-0 text-slate-300 cursor-not-allowed"
                              disabled
                              title="Sin teléfono registrado"
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                            disabled={deletingId === row.inscripcion_id || !row.inscripcion_id}
                            onClick={() => handleEliminarInscripcion(row.inscripcion_id, row.nombre_completo, row.nombre_taller)}
                            title="Retirar del taller"
                          >
                            {deletingId === row.inscripcion_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50/50">
                  <span className="text-xs text-slate-500 font-medium">
                    Página {safePage + 1} de {totalPages} ({filteredRows.length} registros en total)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={safePage === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className="h-8 text-xs font-semibold"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={safePage >= totalPages - 1}
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      className="h-8 text-xs font-semibold"
                    >
                      Siguiente <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de Teléfonos de Contacto */}
      <Dialog open={!!selectedAlumnoPhones} onOpenChange={() => setSelectedAlumnoPhones(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-calipso-700">
              <Phone className="h-5 w-5" />
              Contacto - {selectedAlumnoPhones?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {selectedAlumnoPhones?.phones && selectedAlumnoPhones.phones.length > 0 ? (
              selectedAlumnoPhones.phones.map((phone, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-sm font-semibold text-slate-800 font-mono">{phone}</span>
                  <a
                    href={`tel:${phone}`}
                    className="px-3 py-1 text-xs font-semibold bg-calipso-600 hover:bg-calipso-700 text-white rounded-lg transition-colors"
                  >
                    Llamar
                  </a>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">No se registraron teléfonos de contacto.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalle de Asistencia */}
      <Dialog open={isDetalleOpen} onOpenChange={setIsDetalleOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-calipso-700 pr-6">
              <span>Detalle de Asistencia</span>
              {detalleAlumno && (
                <Button size="sm" variant="outline" onClick={handleExportDetallePDF} className="gap-1.5 text-xs">
                  <FileDown className="h-4 w-4" /> Exportar PDF
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {loadingDetalle ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
            </div>
          ) : detalleAlumno ? (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <div className="text-sm font-bold text-slate-900">{detalleAlumno.nombre_completo}</div>
                <div className="flex flex-wrap gap-4 text-slate-600">
                  <span>Curso: <b>{detalleAlumno.curso}</b></span>
                  <span>RUT: <b>{detalleAlumno.rut}</b></span>
                  <span>Teléfono: <b>{detalleAlumno.telefono || "—"}</b></span>
                </div>
              </div>

              {detalleAlumno.talleres.map((taller) => (
                <div key={taller.taller_id} className="border rounded-xl overflow-hidden">
                  <div className="bg-slate-100 p-3 font-semibold text-slate-800 flex justify-between items-center text-xs">
                    <span>{taller.nombre_taller}</span>
                    <span className="text-slate-500 font-normal">
                      {taller.presentes} asiste · {taller.ausentes} ausente · {taller.total_sesiones} ses.
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white">
                        <TableHead className="text-xs">Fecha</TableHead>
                        <TableHead className="text-xs">Temática</TableHead>
                        <TableHead className="text-xs">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taller.sesiones.map((ses, idx) => {
                        const est = ESTADO_ASISTENCIA[ses.estado] ?? ESTADO_ASISTENCIA.sin_registro;
                        return (
                          <TableRow key={`${ses.fecha}-${idx}`}>
                            <TableCell className="font-mono text-xs">{formatFecha(ses.fecha)}</TableCell>
                            <TableCell className="text-xs">{ses.tematica || "—"}</TableCell>
                            <TableCell>
                              <Badge className={cn("text-[10px]", est.className)}>{est.label}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

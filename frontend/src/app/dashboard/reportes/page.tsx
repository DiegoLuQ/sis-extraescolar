"use client";

import { useEffect, useState, useRef } from "react";
import { toPng } from "html-to-image";
import { reportesApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "../../../components/ui/tabs";
import { Loader2, FileDown, Calendar, Users, TrendingUp, Filter, BarChart, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Activity, Sparkles, ImageDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function ReportesPage() {
  const { user } = useAuthStore();
  const metasExportRef = useRef<HTMLDivElement>(null);
  const [exportingImg, setExportingImg] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [annualData, setAnnualData] = useState<any>(null);
  const [metasData, setMetasData] = useState<any>(null);
  const [metasRango, setMetasRango] = useState<"semanal" | "mensual">("mensual");
  const [metasSemanaIdx, setMetasSemanaIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("mensual");
  const [mes, setMes] = useState<string>((new Date().getMonth() + 1).toString());
  const [anio, setAnio] = useState<string>(new Date().getFullYear().toString());

  const [showDailyDetail, setShowDailyDetail] = useState<boolean>(true);

  // Filtros dedicados para la sección "Detalle de Asistencia por Taller"
  const [filtroFechaInicio, setFiltroFechaInicio] = useState<string>("");
  const [filtroFechaFin, setFiltroFechaFin] = useState<string>("");
  const [filtroTallerMatriz, setFiltroTallerMatriz] = useState<string>("");
  const [diasSemanaSeleccionados, setDiasSemanaSeleccionados] = useState<string[]>([
    "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"
  ]);
  const [semanaNavegacionMatriz, setSemanaNavegacionMatriz] = useState<number | null>(null);

  const aplicarNavegacionSemana = (atras: number) => {
    setSemanaNavegacionMatriz(atras);
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek - 1) - (atras * 7));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatISO = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const inicioStr = formatISO(monday);
    const finStr = formatISO(sunday);

    setFiltroFechaInicio(inicioStr);
    setFiltroFechaFin(finStr);

    const mStr = (monday.getMonth() + 1).toString();
    const yStr = monday.getFullYear().toString();
    if (mStr !== mes || yStr !== anio) {
      setMes(mStr);
      setAnio(yStr);
    }
  };

  const handleFiltrarClick = () => {
    if (filtroFechaInicio) {
      const parts = filtroFechaInicio.split("-");
      if (parts.length === 3) {
        const yearStr = parts[0];
        const monthStr = parseInt(parts[1], 10).toString();
        if (monthStr !== mes || yearStr !== anio) {
          setMes(monthStr);
          setAnio(yearStr);
          toast.success("Cargando reporte del período seleccionado...");
          return;
        }
      }
    }
    toast.success("Filtros aplicados correctamente");
  };

  const [semanasAtras, setSemanasAtras] = useState<number>(0);
  const [resumenSemana, setResumenSemana] = useState<any>(null);
  const [loadingSemana, setLoadingSemana] = useState<boolean>(false);

  const toggleDiaSemana = (dia: string) => {
    setDiasSemanaSeleccionados((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  const limpiarFiltrosMatriz = () => {
    setFiltroFechaInicio("");
    setFiltroFechaFin("");
    setFiltroTallerMatriz("");
    setSemanaNavegacionMatriz(null);
    setDiasSemanaSeleccionados(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]);
  };

  const getNombreDiaSemana = (fechaStr: string): string => {
    const d = new Date(`${fechaStr}T00:00:00`);
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return dias[d.getDay()];
  };

  // Días activos filtrados según rango de fechas y días de la semana seleccionados
  const activeDaysFiltrados = (reportData?.active_days || []).filter((day: string) => {
    if (filtroFechaInicio && day < filtroFechaInicio) return false;
    if (filtroFechaFin && day > filtroFechaFin) return false;
    const nombreDia = getNombreDiaSemana(day);
    if (diasSemanaSeleccionados.length > 0 && !diasSemanaSeleccionados.includes(nombreDia)) {
      return false;
    }
    return true;
  });

  // Talleres filtrados según selección de taller único y según actividad en los días filtrados
  const workshopsFiltrados = (reportData?.workshops || []).filter((w: any) => {
    if (filtroTallerMatriz && w.id !== filtroTallerMatriz) return false;

    // Solo mostrar talleres que registren sesión en los días filtrados
    if (activeDaysFiltrados.length > 0) {
      const tieneSesionActiva = activeDaysFiltrados.some(
        (day: string) => w.asistencias?.[day] !== null && w.asistencias?.[day] !== undefined
      );
      if (!tieneSesionActiva) return false;
    }

    return true;
  });

  const handleExportExcel = async () => {
    if (!reportData || workshopsFiltrados.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    try {
      const blob = await reportesApi.exportarDetalleExcel({
        mes: parseInt(mes),
        anio: parseInt(anio),
        fecha_inicio: filtroFechaInicio || undefined,
        fecha_fin: filtroFechaFin || undefined,
        taller_id: filtroTallerMatriz || undefined,
        dias_semana: diasSemanaSeleccionados.length > 0 ? diasSemanaSeleccionados.join(",") : undefined
      });

      const mesObj = meses.find(m => m.value === mes);
      const mesNombre = mesObj ? mesObj.label : mes;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `detalle_asistencia_${colegioNombre || "taller"}_${mesNombre}_${anio}.xlsx`.replace(/\s+/g, "_"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Reporte exportado a Excel (.xlsx) exitosamente");
    } catch (error) {
      console.error("Error exporting excel:", error);
      toast.error("Error al exportar el reporte a Excel");
    }
  };

  const meses = [
    { value: "1", label: "Enero" },
    { value: "2", label: "Febrero" },
    { value: "3", label: "Marzo" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Mayo" },
    { value: "6", label: "Junio" },
    { value: "7", label: "Julio" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Septiembre" },
    { value: "10", label: "Octubre" },
    { value: "11", label: "Noviembre" },
    { value: "12", label: "Diciembre" },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 2030 - 2024 + 1 }, (_, i) => (2024 + i).toString());

  const fetchResumenSemana = async (atras: number) => {
    setLoadingSemana(true);
    try {
      const data = await reportesApi.getResumenSemana(atras);
      setResumenSemana(data);
    } catch (error) {
      console.error("Error fetching weekly summary:", error);
      toast.error("Error al cargar el resumen semanal");
    } finally {
      setLoadingSemana(false);
    }
  };

  useEffect(() => {
    fetchAllReports();
  }, [mes, anio]);

  useEffect(() => {
    fetchResumenSemana(semanasAtras);
  }, [semanasAtras]);

  // Al cargar el reporte de metas, posicionar en la última semana con actividad.
  useEffect(() => {
    if (metasData?.semanas?.length) {
      setMetasSemanaIdx(metasData.semanas.length - 1);
    }
  }, [metasData]);

  const fetchAllReports = async () => {
    setLoading(true);
    try {
      const [mensual, semanal, anual, metas] = await Promise.all([
        reportesApi.getAsistenciaMensual(parseInt(mes), parseInt(anio)),
        reportesApi.getAsistenciaSemanal(parseInt(mes), parseInt(anio)),
        reportesApi.getAsistenciaAnual(parseInt(anio)),
        reportesApi.getMetas(parseInt(mes), parseInt(anio))
      ]);
      setReportData(mensual);
      setWeeklyData(semanal);
      setAnnualData(anual);
      setMetasData(metas);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Error al cargar los reportes");
    } finally {
      setLoading(false);
    }
  };

  // Color del encabezado de la imagen según el colegio activo.
  const colegioNombre = user?.nombre_colegio || "";
  const getColegioColor = () => {
    const n = colegioNombre.toLowerCase();
    if (n.includes("macaya")) return "#14532d";      // verde oscuro
    if (n.includes("portales")) return "#1e3a8a";    // azul oscuro
    return "#0f172a";                                 // gris pizarra por defecto
  };

  const handleExportMetasImage = async () => {
    if (!metasExportRef.current) return;
    setExportingImg(true);
    try {
      const dataUrl = await toPng(metasExportRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const mesLabel = meses.find((m) => m.value === mes)?.label || mes;
      const link = document.createElement("a");
      link.download = `metas-${colegioNombre}-${mesLabel}-${anio}.png`.replace(/\s+/g, "_");
      link.href = dataUrl;
      link.click();
      toast.success("Imagen exportada");
    } catch (error) {
      console.error("Error exporting image:", error);
      toast.error("Error al exportar la imagen");
    } finally {
      setExportingImg(false);
    }
  };

  if (loading && !reportData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <TrendingUp className="h-12 w-12 mb-4 text-gray-200" />
        <p>No se encontraron datos para los filtros seleccionados.</p>
        <Button variant="outline" className="mt-4" onClick={fetchAllReports}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Centro de Reportes</h1>
          <p className="text-gray-500 text-sm mt-1">Analítica de asistencia y participación escolar</p>
        </div>
        <div className="flex items-center justify-between sm:justify-start gap-2 bg-white p-2 rounded-xl shadow-sm border border-gray-100 w-full md:w-auto">
          <div className="flex items-center gap-1 sm:gap-2 flex-1 sm:flex-initial">
            <Calendar className="h-4 w-4 text-calipso-500 shrink-0" />
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-full sm:w-28 border-0 shadow-none focus:ring-0 font-bold text-xs sm:text-sm h-9">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {meses.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="h-4 w-px bg-gray-200 shrink-0" />
          <div className="flex-1 sm:flex-initial">
            <Select value={anio} onValueChange={setAnio}>
              <SelectTrigger className="w-full sm:w-20 border-0 shadow-none focus:ring-0 font-bold text-xs sm:text-sm h-9">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchAllReports} className="text-calipso-500 h-9 w-9 shrink-0">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-0 shadow-sm bg-calipso-500 text-white relative overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start z-10 relative">
              <div>
                <p className="text-calipso-100 text-xs font-bold uppercase tracking-wider">Matrícula Total</p>
                <h3 className="text-4xl font-black mt-1">
                  {reportData?.total_enrollment || weeklyData?.total_enrollment || annualData?.total_enrollment || 0}
                </h3>
                <p className="text-[10px] text-calipso-100 mt-2 italic">* Sumatoria de todos los inscritos activos</p>
              </div>
              <div className="p-2 bg-white/20 rounded-lg shrink-0">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Días con Actividad {activeTab === "anual" ? "· Año" : "· Mes"}</p>
                <h3 className="text-3xl font-black mt-1 text-gray-700">
                  {activeTab === "anual" ? (annualData?.months?.length || 0) :
                   activeTab === "semanal" ? (weeklyData?.active_days_count || 0) :
                   (reportData?.active_days?.length || 0)}
                </h3>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Capacidad Citada {activeTab === "anual" ? "· Año" : "· Mes"}</p>
                <h3 className="text-3xl font-black mt-1 text-gray-700">
                  {activeTab === "anual" ? (
                    annualData?.total_capacidad_anio || 0
                  ) : activeTab === "semanal" ? (
                    weeklyData?.weeks?.reduce((acc: any, curr: any) => acc + curr.capacidad, 0) || 0
                  ) : (
                    reportData?.daily_stats ? Object.values(reportData.daily_stats).reduce((acc: any, curr: any) => acc + (curr as any).matricula_total, 0) : 0
                  )}
                </h3>
                <p className="text-[10px] text-gray-400 mt-2 italic">* Suma de cupos por sesión dictada; un taller que se repite cuenta cada día</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg shrink-0">
                <BarChart className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Rendimiento {activeTab === "anual" ? "Anual" : "Mensual"}</p>
                <h3 className="text-3xl font-black mt-1 text-calipso-600">
                  {activeTab === "anual" ? (
                    annualData?.promedio_anual !== undefined ? `${annualData.promedio_anual}%` : "0%"
                  ) : (
                    reportData?.daily_stats 
                    ? (() => {
                        const stats = Object.values(reportData.daily_stats) as any[];
                        const totalPresentes = stats.reduce((acc: any, curr: any) => acc + curr.presentes, 0);
                        const totalCapacidad = stats.reduce((acc: any, curr: any) => acc + curr.matricula_total, 0);
                        return totalCapacidad > 0 ? ((totalPresentes / totalCapacidad) * 100).toFixed(1) : "0.0";
                      })() + "%"
                    : "0%"
                  )}
                </h3>
              </div>
              <div className="p-2 bg-green-50 rounded-lg shrink-0">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECCIÓN NUEVA: RESUMEN SEMANAL Y DIARIO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 my-6">
        {/* Tarjeta de Asistencia de Hoy */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-calipso-600 via-calipso-500 to-cyan-500 text-white relative overflow-hidden flex flex-col justify-between p-6">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
            <Activity className="h-64 w-64" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="bg-white/20 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full backdrop-blur-sm">
                Hoy: {new Date().toLocaleDateString("es-CL", { weekday: 'long', day: 'numeric', month: 'short' })}
              </span>
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                <Sparkles className="h-5 w-5 text-yellow-300" />
              </div>
            </div>
            <p className="text-calipso-100 text-xs font-bold uppercase tracking-wider">Asistencia Total de Hoy</p>
            <h3 className="text-5xl font-black mt-2 tracking-tight">
              {resumenSemana ? resumenSemana.total_hoy : 0}
            </h3>
            <p className="text-xs text-calipso-100/90 mt-2">
              Estudiantes registrados como presentes en los talleres de la fecha actual.
            </p>
          </div>
          <div className="border-t border-white/10 pt-4 mt-6 flex justify-between items-center text-xs text-calipso-100">
            <span>Semana Seleccionada: <strong>{resumenSemana?.total_semana_actual || 0}</strong> asistencias</span>
            {resumenSemana?.comparativa_totales_porcentaje !== null && (
              <span className="flex items-center gap-1">
                {resumenSemana?.comparativa_totales_porcentaje >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-green-300" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-300" />
                )}
                <span className={resumenSemana?.comparativa_totales_porcentaje >= 0 ? "text-green-300 font-bold" : "text-red-300 font-bold"}>
                  {resumenSemana?.comparativa_totales_porcentaje >= 0 ? "+" : ""}{resumenSemana?.comparativa_totales_porcentaje}%
                </span>
                vs sem. anterior
              </span>
            )}
          </div>
        </Card>

        {/* Panel de Asistencia Semanal Interactiva */}
        <Card className="border-0 shadow-md bg-white lg:col-span-2 overflow-hidden flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between border-b border-gray-50 pb-4">
            <div>
              <CardTitle className="text-md font-bold text-gray-800 flex items-center gap-2">
                <Activity className="h-4.5 w-4.5 text-calipso-500" />
                Desglose Semanal & Comparativa Día Anterior
              </CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">
                {resumenSemana?.semana_actual?.length > 0 
                  ? `Periodo: ${new Date(resumenSemana.semana_actual[0].fecha + "T00:00:00").toLocaleDateString("es-CL", { day: 'numeric', month: 'short' })} al ${new Date(resumenSemana.semana_actual[resumenSemana.semana_actual.length - 1].fecha + "T00:00:00").toLocaleDateString("es-CL", { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'Cargando fechas...'}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-gray-600 hover:bg-white hover:shadow-sm" 
                onClick={() => setSemanasAtras(prev => prev + 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-black text-gray-700 px-2 min-w-[100px] text-center select-none">
                {semanasAtras === 0 ? "Semana Actual" : `Hace ${semanasAtras} ${semanasAtras === 1 ? 'semana' : 'semanas'}`}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-gray-600 hover:bg-white hover:shadow-sm" 
                onClick={() => setSemanasAtras(prev => Math.max(0, prev - 1))}
                disabled={semanasAtras === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 flex-1 flex flex-col justify-center">
            {loadingSemana ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-calipso-500" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* KPIs de la semana seleccionada (cambian al navegar) */}
                {(() => {
                  const dias = resumenSemana?.semana_actual || [];
                  const presentesSem = dias.reduce((a: number, d: any) => a + (d.presentes || 0), 0);
                  const capacidadSem = dias.reduce((a: number, d: any) => a + (d.matricula_total || 0), 0);
                  const diasActividad = dias.filter((d: any) => (d.matricula_total || 0) > 0 || (d.presentes || 0) > 0).length;
                  const rendimientoSem = capacidadSem > 0 ? ((presentesSem / capacidadSem) * 100).toFixed(1) : "0.0";
                  return (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                        <div>
                          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Días con Actividad</p>
                          <p className="text-2xl font-black text-gray-800 mt-0.5">{diasActividad}</p>
                        </div>
                        <Calendar className="h-5 w-5 text-blue-400 shrink-0" />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-green-50/60 border border-green-100">
                        <div>
                          <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Presentes (Semana)</p>
                          <p className="text-2xl font-black text-gray-800 mt-0.5">{presentesSem}</p>
                        </div>
                        <Users className="h-5 w-5 text-green-400 shrink-0" />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50/60 border border-orange-100">
                        <div>
                          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Capacidad Citada</p>
                          <p className="text-2xl font-black text-gray-800 mt-0.5">{capacidadSem}</p>
                        </div>
                        <BarChart className="h-5 w-5 text-orange-400 shrink-0" />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-calipso-50/60 border border-calipso-100">
                        <div>
                          <p className="text-[10px] font-bold text-calipso-600 uppercase tracking-wider">Rendimiento</p>
                          <p className="text-2xl font-black text-calipso-700 mt-0.5">{rendimientoSem}%</p>
                        </div>
                        <TrendingUp className="h-5 w-5 text-calipso-400 shrink-0" />
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {resumenSemana?.semana_actual?.map((day: any) => {
                  const isMonday = day.dia === "Lunes";
                  return (
                    <div 
                      key={day.fecha} 
                      className={`flex flex-col justify-between p-3 rounded-2xl border transition-all hover:shadow-sm ${
                        day.fecha === new Date().toISOString().split('T')[0]
                          ? "bg-calipso-50/50 border-calipso-200 ring-1 ring-calipso-200"
                          : "bg-gray-50/30 border-gray-100 hover:bg-gray-50/60"
                      }`}
                    >
                      <div className="text-center">
                        <span className="text-[10px] uppercase font-black text-gray-400 block tracking-wider">
                          {day.dia}
                        </span>
                        <span className="text-xs text-gray-500 font-medium block mt-0.5">
                          {new Date(day.fecha + "T00:00:00").toLocaleDateString("es-CL", { day: 'numeric', month: 'numeric' })}
                        </span>
                      </div>

                      <div className="my-3 text-center">
                        <span className="text-2xl font-black text-gray-800 tracking-tight">
                          {day.presentes}
                        </span>
                        <span className="text-[9px] text-gray-400 block mt-0.5">asistentes</span>
                        
                        <div className="mt-2 pt-2 border-t border-gray-100/50">
                          <span className="text-[11px] font-bold text-gray-600 block">
                            Matrícula: {day.matricula_total}
                          </span>
                          <span className="text-[11px] font-extrabold text-calipso-600 block mt-0.5">
                            {day.porcentaje_asistencia}% Asist.
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-center h-5">
                        {!isMonday && day.diferencia_anterior !== null ? (
                          (() => {
                            const diff = day.diferencia_anterior;
                            if (diff > 0) {
                              return (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700" title="Variación en puntos porcentuales vs día anterior">
                                  <ArrowUpRight className="h-3 w-3 text-emerald-600 shrink-0" />
                                  +{diff} pp
                                </span>
                              );
                            } else if (diff < 0) {
                              return (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-700" title="Variación en puntos porcentuales vs día anterior">
                                  <ArrowDownRight className="h-3 w-3 text-rose-600 shrink-0" />
                                  {diff} pp
                                </span>
                              );
                            } else {
                              return (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-500" title="Sin variación vs día anterior">
                                  0 pp
                                </span>
                              );
                            }
                          })()
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="mensual" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border p-1 rounded-xl mb-6 w-full flex overflow-x-auto whitespace-nowrap justify-start md:justify-center gap-1 scrollbar-none">
          <TabsTrigger value="mensual" className="rounded-lg data-[state=active]:bg-calipso-500 data-[state=active]:text-white shrink-0">Matriz Mensual</TabsTrigger>
          <TabsTrigger value="semanal" className="rounded-lg data-[state=active]:bg-calipso-500 data-[state=active]:text-white shrink-0">Resumen Semanal</TabsTrigger>
          <TabsTrigger value="anual" className="rounded-lg data-[state=active]:bg-calipso-500 data-[state=active]:text-white shrink-0">Consolidado Anual</TabsTrigger>
          <TabsTrigger value="metas" className="rounded-lg data-[state=active]:bg-calipso-500 data-[state=active]:text-white shrink-0">Metas por Taller</TabsTrigger>
        </TabsList>

        {/* CONTENIDO MENSUAL */}
        <TabsContent value="mensual" className="space-y-6">
          <Card className="border-0 shadow-md overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 p-4 sm:p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <Calendar className="h-4.5 w-4.5 text-calipso-600" />
                    Detalle de Asistencia por Taller
                  </CardTitle>
                  <p className="text-xs text-gray-500 mt-1">
                    Filtra por rango de fechas, días de la semana (Lunes a Viernes) o consulta un taller único.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Píldora de Navegación por Semanas (< Hace X semana >) */}
                  <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-200 shadow-xs">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-gray-600 hover:bg-white hover:shadow-xs rounded-lg" 
                      onClick={() => aplicarNavegacionSemana((semanaNavegacionMatriz ?? 0) + 1)}
                      title="Semana anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-bold text-gray-700 px-2 min-w-[105px] text-center select-none">
                      {semanaNavegacionMatriz === null
                        ? "Filtrar Semana"
                        : semanaNavegacionMatriz === 0
                        ? "Semana Actual"
                        : `Hace ${semanaNavegacionMatriz} ${semanaNavegacionMatriz === 1 ? 'semana' : 'semanas'}`}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-gray-600 hover:bg-white hover:shadow-xs rounded-lg" 
                      onClick={() => aplicarNavegacionSemana(Math.max(0, (semanaNavegacionMatriz ?? 0) - 1))}
                      disabled={semanaNavegacionMatriz === 0 || semanaNavegacionMatriz === null}
                      title="Semana siguiente"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <Checkbox 
                      id="show-daily" 
                      checked={showDailyDetail} 
                      onCheckedChange={(val) => setShowDailyDetail(!!val)}
                    />
                    <label
                      htmlFor="show-daily"
                      className="text-xs font-semibold text-gray-700 cursor-pointer"
                    >
                      Ver detalle diario
                    </label>
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExportExcel} 
                    className="h-9 text-xs font-bold gap-2 border-slate-200 hover:bg-slate-50"
                  >
                    <FileDown className="h-4 w-4 text-calipso-600" />
                    Exportar Excel
                  </Button>
                </div>
              </div>

              {/* BARRA DE FILTROS AVANZADOS PARA DETALLE DE ASISTENCIA */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-calipso-600" /> Filtros de Asistencia
                  </span>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleFiltrarClick}
                      className="bg-calipso-600 hover:bg-calipso-700 text-white text-xs font-bold gap-1.5 h-8 px-3.5 shadow-xs rounded-lg"
                    >
                      <Filter className="w-3.5 h-3.5" /> Filtrar
                    </Button>

                    {(filtroFechaInicio || filtroFechaFin || filtroTallerMatriz || diasSemanaSeleccionados.length < 7 || semanaNavegacionMatriz !== null) && (
                      <button
                        type="button"
                        onClick={limpiarFiltrosMatriz}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Restablecer Filtros
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Rango de Fecha Inicio */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Desde (Fecha Inicio)</label>
                    <input
                      type="date"
                      value={filtroFechaInicio}
                      onChange={(e) => setFiltroFechaInicio(e.target.value)}
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-calipso-500"
                    />
                  </div>

                  {/* Rango de Fecha Fin */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Hasta (Fecha Fin)</label>
                    <input
                      type="date"
                      value={filtroFechaFin}
                      onChange={(e) => setFiltroFechaFin(e.target.value)}
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-calipso-500"
                    />
                  </div>

                  {/* Taller Único */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Filtrar por Taller</label>
                    <select
                      value={filtroTallerMatriz}
                      onChange={(e) => setFiltroTallerMatriz(e.target.value)}
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-calipso-500 font-medium"
                    >
                      <option value="">Todos los talleres</option>
                      {reportData?.workshops?.map((w: any) => (
                        <option key={w.id} value={w.id}>{w.nombre_taller}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Filtro por Días de la Semana */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600 mr-1">Días a Mostrar:</span>
                  {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((dia) => {
                    const isSelected = diasSemanaSeleccionados.includes(dia);
                    return (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => toggleDiaSemana(dia)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                          isSelected
                            ? "bg-calipso-600 text-white border-calipso-600 shadow-xs"
                            : "bg-slate-50 text-gray-500 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {dia}
                      </button>
                    );
                  })}

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDiasSemanaSeleccionados(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"])}
                      className="text-[11px] font-semibold text-calipso-600 hover:underline"
                    >
                      Solo Lu-Vi
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setDiasSemanaSeleccionados(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"])}
                      className="text-[11px] font-semibold text-calipso-600 hover:underline"
                    >
                      Todos
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="min-w-[200px] font-bold text-gray-900 border-r">Taller</TableHead>
                      {showDailyDetail && activeDaysFiltrados.map((day: string) => (
                        <TableHead key={day} className="text-center min-w-[80px] p-2">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] uppercase font-black text-calipso-600">
                              {getNombreDiaSemana(day).substring(0, 3)}
                            </span>
                            <span className="text-xs font-bold text-gray-700">{day.split("-")[2]}</span>
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold text-calipso-600 bg-calipso-50/30 min-w-[90px]">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workshopsFiltrados.length === 0 || activeDaysFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={(showDailyDetail ? activeDaysFiltrados.length : 0) + 2} className="text-center py-12 text-gray-400 italic text-sm">
                          No hay registros de asistencia que coincidan con los filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {workshopsFiltrados.map((workshop: any) => {
                          // Recalcular total y promedio reactivo según días filtrados
                          let totalTallerFiltrado = 0;
                          let sesionesContadas = 0;
                          activeDaysFiltrados.forEach((day: string) => {
                            const val = workshop.asistencias[day];
                            if (val !== null && val !== undefined) {
                              totalTallerFiltrado += val;
                              sesionesContadas++;
                            }
                          });
                          const promTallerFiltrado = sesionesContadas > 0 ? (totalTallerFiltrado / sesionesContadas).toFixed(1) : "0.0";

                          return (
                            <TableRow key={workshop.id} className="hover:bg-gray-50/30 transition-colors">
                              <TableCell className="font-bold text-gray-700 border-r py-3.5">
                                <div className="flex flex-col">
                                  <span>{workshop.nombre_taller}</span>
                                  <span className="text-[10px] text-gray-400 font-normal uppercase tracking-tighter">
                                    {workshop.matriculados} Inscritos
                                  </span>
                                </div>
                              </TableCell>
                              {showDailyDetail && activeDaysFiltrados.map((day: string) => (
                                <TableCell key={day} className="text-center p-2">
                                  {workshop.asistencias[day] !== null && workshop.asistencias[day] !== undefined ? (
                                    <span className="font-medium text-gray-700">{workshop.asistencias[day]}</span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </TableCell>
                              ))}
                              <TableCell className="text-center font-black text-calipso-700 bg-calipso-50/20">
                                <div className="flex flex-col">
                                  <span className="text-sm">{totalTallerFiltrado}</span>
                                  <span className="text-[10px] font-normal text-gray-400">
                                    Prom: {promTallerFiltrado}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {/* Fila de Totales Generales para Días y Talleres Filtrados */}
                        <TableRow className="bg-gray-900 text-white font-bold hover:bg-gray-800 transition-colors">
                          <TableCell className="border-r py-4">Asistencia Total (%)</TableCell>
                          {showDailyDetail && activeDaysFiltrados.map((day: string) => {
                            const presentesDia = workshopsFiltrados.reduce((acc: number, w: any) => {
                              const val = w.asistencias[day];
                              return acc + (typeof val === "number" ? val : 0);
                            }, 0);
                            const capacidadDia = reportData?.daily_stats?.[day]?.matricula_total || 0;
                            const pctDia = capacidadDia > 0 ? ((presentesDia / capacidadDia) * 100).toFixed(1) : "0.0";

                            return (
                              <TableCell key={day} className="text-center">
                                <div className="flex flex-col">
                                  <span className="text-xs text-white/70 font-normal">{presentesDia}</span>
                                  <span className="text-xs">{pctDia}%</span>
                                </div>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center">
                            {(() => {
                              let totalPresentesGlobal = 0;
                              let totalCapacidadGlobal = 0;
                              activeDaysFiltrados.forEach((day: string) => {
                                totalPresentesGlobal += workshopsFiltrados.reduce((acc: number, w: any) => {
                                  const val = w.asistencias[day];
                                  return acc + (typeof val === "number" ? val : 0);
                                }, 0);
                                totalCapacidadGlobal += reportData?.daily_stats?.[day]?.matricula_total || 0;
                              });
                              const pctGlobal = totalCapacidadGlobal > 0 ? ((totalPresentesGlobal / totalCapacidadGlobal) * 100).toFixed(1) : "0.0";

                              return (
                                <div className="flex flex-col">
                                  <span className="text-xs text-white/70 font-normal">{totalPresentesGlobal} Tot.</span>
                                  <span className="text-xs">{pctGlobal}%</span>
                                </div>
                              );
                            })()}
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTENIDO SEMANAL */}
        <TabsContent value="semanal" className="space-y-6">
          <Card className="border-0 shadow-md bg-white overflow-hidden">
            <CardHeader className="bg-calipso-50/30 border-b border-calipso-100">
              <CardTitle className="text-sm font-bold text-calipso-900 flex items-center gap-2">
                <BarChart className="h-4 w-4" />
                Resumen de Participación por Semana
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="font-bold text-gray-900">Período</TableHead>
                      <TableHead className="text-center font-bold text-gray-900">Estudiantes Presentes (Acumulado)</TableHead>
                      <TableHead className="text-center font-bold text-gray-900">Capacidad Teórica (Matrícula x Sesiones)</TableHead>
                      <TableHead className="text-right font-bold text-gray-900">Porcentaje Asistencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyData?.weeks?.length > 0 ? (
                      weeklyData.weeks.map((week: any) => (
                        <TableRow key={week.week_label}>
                          <TableCell className="font-bold text-gray-700">{week.week_label}</TableCell>
                          <TableCell className="text-center font-medium text-gray-600">{week.presentes}</TableCell>
                          <TableCell className="text-center text-gray-600 font-medium">
                            {week.capacidad} <span className="text-[10px] text-gray-400 font-normal ml-1">Alumnos</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-black ${
                              week.porcentaje >= 80 ? "bg-green-100 text-green-700" : 
                              week.porcentaje >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                            }`}>
                              {week.porcentaje}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-gray-400 italic">
                          No hay datos de asistencia registrados para este mes.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTENIDO ANUAL */}
        <TabsContent value="anual" className="space-y-6">
          <Card className="border-0 shadow-md bg-white overflow-hidden">
            <CardHeader className="bg-calipso-900 text-white border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                <TrendingUp className="h-4 w-4" />
                Consolidado Histórico del Año {anio}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="font-bold text-gray-900">Mes</TableHead>
                      <TableHead className="text-center font-bold text-gray-900">Asistencia Acumulada</TableHead>
                      <TableHead className="text-center font-bold text-gray-900">Capacidad Total</TableHead>
                      <TableHead className="text-right font-bold text-gray-900">Rendimiento Anual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {annualData?.months?.length > 0 ? (
                      annualData.months.map((month: any) => (
                        <TableRow key={month.month_label}>
                          <TableCell className="font-bold text-gray-700">{month.month_label}</TableCell>
                          <TableCell className="text-center font-medium text-gray-600">{month.presentes} alumnos</TableCell>
                          <TableCell className="text-center font-medium text-gray-400">{month.capacidad}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-3">
                              <div className="w-24 bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-calipso-500 h-full transition-all duration-500" 
                                  style={{ width: `${month.porcentaje}%` }}
                                />
                              </div>
                              <span className="text-sm font-black text-calipso-700 w-10">
                                {month.porcentaje}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-gray-400 italic">
                          Inicie el registro de asistencia para visualizar el historial anual.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metas" className="space-y-4">
          {(() => {
            const esSemanal = metasRango === "semanal";
            const semanas = metasData?.semanas || [];
            const idx = Math.min(metasSemanaIdx, Math.max(0, semanas.length - 1));
            const semActual = semanas[idx];
            const mesLabel = meses.find((m) => m.value === mes)?.label || mes;
            const rangoLabel = esSemanal ? "Semanal" : "Mensual";
            const fmtCorto = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" });
            const fmtLargo = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

            const rawItems = esSemanal ? (semActual?.items || []) : (metasData?.mensual || []);
            const items = [...rawItems].sort((a: any, b: any) => b.asistencias - a.asistencias || b.porcentaje - a.porcentaje);
            const total = esSemanal ? semActual?.total : metasData?.total_mensual;
            const periodoTexto = esSemanal
              ? (semActual ? `${fmtCorto(semActual.semana_inicio)} al ${fmtLargo(semActual.semana_fin)}` : `${mesLabel} ${anio}`)
              : `${mesLabel} ${anio}`;
            return (
              <>
                {/* Controles (no se incluyen en la imagen) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                      <button
                        onClick={() => setMetasRango("semanal")}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${metasRango === "semanal" ? "bg-white text-calipso-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                      >
                        Semanal
                      </button>
                      <button
                        onClick={() => setMetasRango("mensual")}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${metasRango === "mensual" ? "bg-white text-calipso-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                      >
                        Mensual
                      </button>
                    </div>

                    {/* Navegación entre semanas del mes */}
                    {esSemanal && (
                      <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-600 hover:bg-white hover:shadow-sm"
                          disabled={idx <= 0}
                          onClick={() => setMetasSemanaIdx((i) => Math.max(0, i - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-[11px] font-black text-gray-700 px-1 min-w-[110px] text-center select-none">
                          {semanas.length > 0 ? `Semana ${idx + 1} de ${semanas.length}` : "Sin semanas"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-600 hover:bg-white hover:shadow-sm"
                          disabled={idx >= semanas.length - 1}
                          onClick={() => setMetasSemanaIdx((i) => Math.min(semanas.length - 1, i + 1))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs font-bold w-full sm:w-auto"
                    onClick={handleExportMetasImage}
                    disabled={exportingImg}
                  >
                    {exportingImg ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <ImageDown className="h-3.5 w-3.5 mr-2" />}
                    Exportar Imagen
                  </Button>
                </div>

                {/* Contenedor capturado como imagen */}
                <div ref={metasExportRef} className="bg-white overflow-hidden rounded-xl border border-gray-100 shadow-md">
                  {/* Encabezado con color según colegio */}
                  <div className="px-6 py-4 text-white" style={{ backgroundColor: getColegioColor() }}>
                    <p className="text-lg font-black leading-tight">{colegioNombre || "Colegio"}</p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-white/80 flex items-center gap-2">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Cumplimiento de Metas por Taller · {rangoLabel}
                      </p>
                      <p className="text-xs font-bold text-white/90">{periodoTexto}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto w-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/50">
                          <TableHead className="font-bold text-gray-900">Taller</TableHead>
                          <TableHead className="text-center font-bold text-gray-900">Asistencia (nº y %)</TableHead>
                          <TableHead className="text-right font-bold text-gray-900">Meta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.length > 0 ? (
                          <>
                            {items.map((item: any) => (
                              <TableRow key={item.taller_id}>
                                <TableCell className="font-bold text-gray-700">{item.nombre_taller}</TableCell>
                                <TableCell className="text-center">
                                  <span className="font-medium text-gray-600">{item.asistencias}/{item.registros}</span>
                                  <span className={`ml-2 font-black ${item.cumple ? "text-green-600" : "text-red-500"}`}>
                                    {item.porcentaje}%
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${item.cumple ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                    {item.meta}%
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                            {total && (
                              <TableRow className="bg-gray-50 border-t-2">
                                <TableCell className="font-black text-gray-900">TOTAL COLEGIO</TableCell>
                                <TableCell className="text-center">
                                  <span className="font-medium text-gray-600">{total.asistencias}/{total.registros}</span>
                                  <span className={`ml-2 font-black ${total.cumple ? "text-green-600" : "text-red-500"}`}>
                                    {total.porcentaje}%
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${total.cumple ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                    {total.meta}%
                                  </span>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-10 text-gray-400 italic">
                              No hay registros de asistencia en el rango seleccionado.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

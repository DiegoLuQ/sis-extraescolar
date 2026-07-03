"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reportesProgramadosApi, authApi, type ReporteProgramado } from "@/lib/api";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, CalendarClock, Loader2, Trash2, XCircle, Send, Pencil } from "lucide-react";
import type { Colegio } from "@/types";
import { FRECUENCIA_LABEL } from "./constants";

export default function ReportesProgramadosPage() {
  const router = useRouter();
  const [reportes, setReportes] = useState<ReporteProgramado[]>([]);
  const [colegiosMap, setColegiosMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);

  const [userRole, setUserRole] = useState<string>("");
  const [activeColegioId, setActiveColegioId] = useState<string | null>(null);

  useEffect(() => {
    const storedAuth = localStorage.getItem("auth-storage");
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth);
        setUserRole(parsed?.state?.user?.rol || "");
      } catch (e) {}
    }

    setActiveColegioId(localStorage.getItem("colegio_id") || null);
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [dataReportes, dataColegios] = await Promise.all([
        reportesProgramadosApi.getAll().catch(() => []),
        authApi.getMisColegios().catch(() => [] as Colegio[]),
      ]);

      setReportes(dataReportes);
      const map = new Map<string, string>();
      dataColegios.forEach((c) => map.set(c.id, c.nombre_colegio));
      setColegiosMap(map);
    } catch (error) {
      console.error("Error fetching initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEstado = async (id: string, currentActivo: boolean) => {
    try {
      setReportes((prev) => prev.map((r) => (r.id === id ? { ...r, activo: !currentActivo } : r)));
      await reportesProgramadosApi.toggle(id, !currentActivo);
      toast.success(!currentActivo ? "Reporte reanudado" : "Reporte pausado");
    } catch (error: any) {
      setReportes((prev) => prev.map((r) => (r.id === id ? { ...r, activo: currentActivo } : r)));
      toast.error("Error al cambiar el estado del reporte");
    }
  };

  const handleDelete = async (id: string, nombreReporte: string) => {
    const ok = await confirmDialog({
      title: "Eliminar reporte programado",
      description: `¿Estás seguro de que deseas eliminar "${nombreReporte}"? Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      destructive: true,
    });

    if (!ok) return;

    try {
      await reportesProgramadosApi.delete(id);
      toast.success("Reporte eliminado exitosamente");
      setReportes((prev) => prev.filter((r) => r.id !== id));
    } catch (error: any) {
      toast.error("Error al eliminar el reporte");
    }
  };

  const handleEnviarAhora = async (id: string) => {
    setEnviandoId(id);
    try {
      const resultado = await reportesProgramadosApi.enviarAhora(id);
      toast.success(`Reporte enviado a ${resultado.recipients ?? ""} destinatario(s)`);
      const data = await reportesProgramadosApi.getAll();
      setReportes(data);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al enviar el reporte");
    } finally {
      setEnviandoId(null);
    }
  };

  if (userRole && userRole !== "admin") {
    return (
      <Card className="max-w-md mx-auto mt-12 border-red-100 bg-red-50/30 shadow-sm animate-fadeIn">
        <CardContent className="pt-6 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-red-900">Acceso Restringido</h2>
          <p className="text-sm text-red-700 mt-1">
            Esta sección es exclusiva para el Administrador del sistema.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isVistaGlobal = !activeColegioId;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Reportes Programados</h1>
            {isVistaGlobal && (
              <Badge variant="outline" className="bg-calipso-50 text-calipso-700 border-calipso-200 font-semibold text-xs mt-1">
                Vista Global
              </Badge>
            )}
          </div>
          <p className="text-gray-500 mt-1 text-sm">
            Configura el envío automático de reportes de asistencia (diario, semanal o mensual) a los correos que definas.
          </p>
        </div>

        <Link href="/dashboard/reportes-programados/nuevo">
          <Button className="bg-calipso-500 hover:bg-calipso-600 shadow-md hover:shadow-lg transition-all">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Reporte
          </Button>
        </Link>
      </div>

      <Card className="border-0 shadow-md bg-white/70 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 px-6 py-4">
          <CardTitle className="text-base font-semibold text-gray-800">Reportes Configurados</CardTitle>
          <CardDescription className="text-xs">
            Solo los reportes "Activos" se envían automáticamente a las 9:00am según su frecuencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
            </div>
          ) : reportes.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="h-12 w-12 rounded-full bg-calipso-50 flex items-center justify-center mx-auto mb-3 text-calipso-500">
                <CalendarClock className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-gray-800 text-sm">Sin reportes configurados</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                No hay reportes programados para {isVistaGlobal ? "el sistema global" : "este establecimiento"}. Crea uno con el botón superior.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-gray-50/30">
                  <TableHead className="font-semibold text-gray-600">Reporte</TableHead>
                  <TableHead className="font-semibold text-gray-600">Frecuencia</TableHead>
                  <TableHead className="font-semibold text-gray-600">Destinatarios</TableHead>
                  <TableHead className="font-semibold text-gray-600">Última Ejecución</TableHead>
                  <TableHead className="text-center font-semibold text-gray-600">Estado</TableHead>
                  <TableHead className="text-right font-semibold text-gray-600">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportes.map((item) => (
                  <TableRow key={item.id} className="group transition-colors hover:bg-gray-50/50">
                    <TableCell className="font-medium text-gray-800">
                      <div className="flex flex-col gap-1">
                        <span>{item.nombre || "Reporte sin nombre"}</span>
                        {isVistaGlobal && colegiosMap.has(item.colegio_id) && (
                          <Badge variant="secondary" className="w-fit text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            {colegiosMap.get(item.colegio_id)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{FRECUENCIA_LABEL[item.frecuencia]}</TableCell>
                    <TableCell className="text-sm text-gray-600" title={item.destinatarios.join(", ")}>
                      {item.destinatarios.length} correo{item.destinatarios.length !== 1 ? "s" : ""}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {item.ultima_ejecucion ? (
                        <div className="flex flex-col">
                          <span>{item.ultima_ejecucion}</span>
                          <span className="text-[11px] text-gray-400">{item.ultimo_estado}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Nunca</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleEstado(item.id, item.activo)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                          item.activo
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 hover:bg-emerald-100"
                            : "bg-gray-100 text-gray-500 ring-1 ring-gray-400/20 hover:bg-gray-200"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${item.activo ? "bg-emerald-500" : "bg-gray-400"}`} />
                        {item.activo ? "Activo" : "Pausado"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEnviarAhora(item.id)}
                          disabled={enviandoId === item.id}
                          className="h-8 w-8 text-gray-400 hover:text-calipso-600 hover:bg-calipso-50 transition-colors"
                          title="Enviar ahora"
                        >
                          {enviandoId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/dashboard/reportes-programados/${item.id}`)}
                          className="h-8 w-8 text-gray-400 hover:text-calipso-600 hover:bg-calipso-50 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item.id, item.nombre || "este reporte")}
                          className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

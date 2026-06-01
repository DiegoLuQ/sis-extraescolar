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
import type { TallerOcupacion, AusentismoTaller, AlertaInasistencia, TallerAusentismoDetalle } from "@/types";
import {
  Users, GraduationCap, BookOpen, AlertTriangle,
  TrendingUp, Activity, Trash2, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

const PAGE_SIZE = 10;

type AlertaRow = TallerAusentismoDetalle & {
  alumno_id: string;
  nombre_completo: string;
  curso: string;
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

  // Flatten: one row per (alumno × taller)
  const alertaRows: AlertaRow[] = alertas.flatMap(a =>
    a.talleres.map(t => ({
      alumno_id: a.alumno_id,
      nombre_completo: a.nombre_completo,
      curso: a.curso,
      ...t,
    }))
  );
  const totalPages = Math.ceil(alertaRows.length / PAGE_SIZE);
  const pagedRows = alertaRows.slice(alertaPage * PAGE_SIZE, (alertaPage + 1) * PAGE_SIZE);

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
            <div className="flex items-start justify-between gap-4">
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
                {alertaRows.length} {alertaRows.length === 1 ? "registro" : "registros"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50/50">
                <span className="text-xs text-gray-400">
                  Página {alertaPage + 1} de {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={alertaPage === 0}
                    onClick={() => setAlertaPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={alertaPage >= totalPages - 1}
                    onClick={() => setAlertaPage(p => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

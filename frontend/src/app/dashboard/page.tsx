"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usuariosApi, alumnosApi, talleresApi, estadisticasApi } from "@/lib/api";
import type { TallerOcupacion, AusentismoTaller, AlertaInasistencia } from "@/types";
import { Users, GraduationCap, BookOpen, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [usuariosCount, setUsuariosCount] = useState(0);
  const [alumnosCount, setAlumnosCount] = useState(0);
  const [talleresCount, setTalleresCount] = useState(0);
  const [ocupacion, setOcupacion] = useState<TallerOcupacion[]>([]);
  const [ausentismo, setAusentismo] = useState<AusentismoTaller[]>([]);
  const [alertas, setAlertas] = useState<AlertaInasistencia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usuarios, alumnos, talleres, ocupacionData, ausentismoData, alertasData] = await Promise.all([
          usuariosApi.getAll(),
          alumnosApi.getAll(),
          talleresApi.getAll(),
          estadisticasApi.ocupacion(),
          estadisticasApi.ausentismo(),
          estadisticasApi.alertasInasistencias(3),
        ]);

        setUsuariosCount(usuarios.length);
        setAlumnosCount(alumnos.length);
        setTalleresCount(talleres.length);
        setOcupacion(ocupacionData);
        setAusentismo(ausentismoData);
        setAlertas(alertasData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-calipso-500"></div>
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
      value: alertas.length,
      description: "Inasistencias consecutivas",
      icon: AlertTriangle,
      color: "bg-red-500",
      show: true,
    },
  ].filter(s => s.show);

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
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sistema Online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-0 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden bg-white">
            <CardContent className="p-0">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-xl ${stat.color} bg-opacity-10 text-calipso-600 transition-transform group-hover:scale-110 duration-300`}>
                    <stat.icon className={cn("h-6 w-6", stat.color.replace('bg-', 'text-'))} />
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
              <div className={cn("h-1.5 w-full", stat.color)}></div>
            </CardContent>
          </Card>
        ))}
      </div>

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
              <div className="space-y-4">
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
                      ></div>
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
              <div className="space-y-4">
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
                        className={`h-full rounded-full transition-all ${
                          taller.porcentaje_ausentismo > 20
                            ? "bg-red-500"
                            : taller.porcentaje_ausentismo > 10
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min(taller.porcentaje_ausentismo, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {alertas.length > 0 && (
        <Card className="border-0 shadow-md border-l-4 border-l-indigo-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-600">
              <AlertTriangle className="h-5 w-5" />
              Alumnos con Inasistencias Consecutivas
            </CardTitle>
            <CardDescription>Alumnos que requieren atención</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertas.map((alerta) => (
                <div
                  key={alerta.alumno_id}
                  className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{alerta.nombre_completo}</p>
                    <p className="text-sm text-gray-500">RUT: {alerta.rut}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive">{alerta.taller}</Badge>
                    <p className="text-sm text-indigo-600 mt-1">
                      {alerta.inasistencias_consecutivas} inasistencias
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

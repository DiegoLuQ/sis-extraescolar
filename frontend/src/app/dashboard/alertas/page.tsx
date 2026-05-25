"use client";

import { useEffect, useState } from "react";
import { asistenciaApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, Loader2, User, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";

export default function AlertasHistorialPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // Seguridad: Solo admin y coordinador
    if (user && user.rol !== "admin" && user.rol !== "coordinador") {
      router.push("/dashboard");
      return;
    }
    fetchAlertas();
  }, [user, router]);

  const fetchAlertas = async () => {
    try {
      const data = await asistenciaApi.getAlertasHistorial();
      setAlertas(data);
    } catch (error) {
      console.error("Error fetching alertas:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAlertas = alertas.filter(a => 
    a.nombre_alumno.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.nombre_taller.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            Historial de Inconsistencias
          </h1>
          <p className="text-gray-500 mt-1">
            Registro de alumnos presentes en talleres pero ausentes en el colegio.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm md:col-span-3">
          <CardHeader className="border-b bg-gray-50/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Buscar por alumno o taller..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Badge variant="outline" className="w-fit font-bold border-red-100 text-red-600 bg-red-50 px-3 py-1">
                {filteredAlertas.length} Inconsistencias registradas
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="w-[180px] pl-6">Fecha Incidente</TableHead>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Taller / Actividad</TableHead>
                  <TableHead>Estado Alerta</TableHead>
                  <TableHead className="pr-6 text-right">Registrado el</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlertas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-gray-400">
                      No se han encontrado registros de inconsistencias.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAlertas.map((alerta) => (
                    <TableRow key={alerta.id} className="hover:bg-red-50/10 transition-colors">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="font-semibold text-gray-700">
                            {new Date(alerta.fecha + "T12:00:00").toLocaleDateString("es-CL", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900">{alerta.nombre_alumno}</span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">RUT: {alerta.alumno_id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-calipso-50 text-calipso-700 border-calipso-100">
                          {alerta.nombre_taller}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span className="text-xs font-black uppercase italic">{alerta.tipo_alerta}</span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <p className="text-[10px] text-gray-400 font-medium">
                          {new Date(alerta.creado_at).toLocaleString("es-CL", {
                            dateStyle: "short",
                            timeStyle: "short"
                          })}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

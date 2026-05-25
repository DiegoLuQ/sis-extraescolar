"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { talleresApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { 
  Calendar, 
  Clock, 
  User, 
  BookOpen, 
  Search, 
  Loader2, 
  Grid, 
  List, 
  XCircle,
  GraduationCap,
  School
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import type { Taller } from "@/types";

interface FlatScheduleItem {
  id: string;
  tallerId: string;
  nombreTaller: string;
  nombreProfesor: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  cursosAsignados?: string;
  colegio: string;
}

const DAYS_OF_WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function HorarioPage() {
  const { user } = useAuthStore();
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>("todos");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await talleresApi.getAll();
      setTalleres(data);
    } catch (error) {
      console.error("Error al obtener los talleres:", error);
      toast.error("Error al cargar los horarios de talleres");
    } finally {
      setLoading(false);
    }
  };

  // 1. Control de accesos
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
      </div>
    );
  }

  const isAuthorized = user?.rol === "admin" || user?.rol === "coordinador";
  if (!isAuthorized) {
    return (
      <Card className="max-w-md mx-auto mt-12 border-red-100 bg-red-50/30 shadow-sm animate-fadeIn">
        <CardContent className="pt-6 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-red-900">Acceso Restringido</h2>
          <p className="text-sm text-red-700 mt-1">
            Esta sección es exclusiva para el Coordinador o Administrador del sistema.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 2. Aplanar los talleres por sus respectivos horarios
  const flatSchedules: FlatScheduleItem[] = [];
  
  talleres.forEach((taller) => {
    if (!taller.is_active) return;

    let horarios = taller.horarios || [];
    // Fallback para talleres sin horarios estructurados en BD
    if (horarios.length === 0 && taller.dia) {
      const dias = taller.dia.split(",").map((d) => d.trim());
      horarios = dias.map((d) => ({
        dia: d || "Lunes",
        hora_inicio: taller.hora_inicio || "",
        hora_fin: taller.hora_fin || "",
      }));
    }

    if (horarios.length === 0) {
      // Si no tiene ningún horario, se coloca como bloque por definir
      horarios = [{ dia: "Lunes", hora_inicio: "", hora_fin: "" }];
    }

    horarios.forEach((h, idx) => {
      flatSchedules.push({
        id: `${taller.id}-${h.dia}-${idx}`,
        tallerId: taller.id,
        nombreTaller: taller.nombre_taller,
        nombreProfesor: taller.nombre_profesor || "No asignado",
        dia: h.dia,
        horaInicio: h.hora_inicio || "--:--",
        horaFin: h.hora_fin || "--:--",
        cursosAsignados: taller.cursos_asignados,
        colegio: taller.nombre_colegio,
      });
    });
  });

  // 3. Filtrar horarios según el término de búsqueda y día
  const filteredSchedules = flatSchedules.filter((item) => {
    const matchSearch =
      item.nombreTaller.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nombreProfesor.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchDay = selectedDayFilter === "todos" || item.dia.toLowerCase() === selectedDayFilter.toLowerCase();
    
    return matchSearch && matchDay;
  });

  // 4. Agrupar por día para la vista de cronograma/grilla
  const groupedByDay: { [key: string]: FlatScheduleItem[] } = {};
  DAYS_OF_WEEK.forEach((day) => {
    groupedByDay[day] = [];
  });

  filteredSchedules.forEach((item) => {
    const foundDay = DAYS_OF_WEEK.find((d) => d.toLowerCase() === item.dia.trim().toLowerCase());
    if (foundDay) {
      groupedByDay[foundDay].push(item);
    } else {
      // Manejar otros días si los hay
      if (!groupedByDay[item.dia]) {
        groupedByDay[item.dia] = [];
      }
      groupedByDay[item.dia].push(item);
    }
  });

  // Ordenar bloques por hora de inicio
  Object.keys(groupedByDay).forEach((day) => {
    groupedByDay[day].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Horario General</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Visualiza y audita la programación semanal de todos los talleres extraescolares del establecimiento.
          </p>
        </div>

        {/* Selector de Vista */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg border border-gray-200 shadow-sm shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("grid")}
            className={`h-8 px-3 text-xs gap-1.5 transition-all ${
              viewMode === "grid"
                ? "bg-white text-calipso-600 shadow-sm font-semibold"
                : "text-gray-600 hover:bg-white/50"
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            Vista Semanal
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("table")}
            className={`h-8 px-3 text-xs gap-1.5 transition-all ${
              viewMode === "table"
                ? "bg-white text-calipso-600 shadow-sm font-semibold"
                : "text-gray-600 hover:bg-white/50"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Lista Completa
          </Button>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtro */}
      <Card className="border-0 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3 w-full md:max-w-md border-gray-200">
              <Search className="h-4 w-4 text-gray-400 shrink-0 ml-1" />
              <Input
                placeholder="Buscar por taller o monitor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full focus-visible:ring-calipso-500"
              />
            </div>

            {/* Filtros por Día */}
            <div className="flex flex-wrap gap-1 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDayFilter("todos")}
                className={`h-8 text-xs font-semibold px-2.5 rounded-full ${
                  selectedDayFilter === "todos"
                    ? "bg-calipso-50 text-calipso-700 border border-calipso-200"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                Todos los días
              </Button>
              {DAYS_OF_WEEK.map((day) => (
                <Button
                  key={day}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDayFilter(day)}
                  className={`h-8 text-xs font-semibold px-2.5 rounded-full ${
                    selectedDayFilter === day
                      ? "bg-calipso-50 text-calipso-700 border border-calipso-200"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {day}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Carga de Datos */}
      {viewMode === "grid" ? (
        // VISTA SEMANAl (GRID DE TARJETAS POR DÍA)
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DAYS_OF_WEEK.filter((day) => selectedDayFilter === "todos" || day === selectedDayFilter).map((day) => {
            const daySchedules = groupedByDay[day] || [];
            
            return (
              <Card key={day} className="border border-gray-100 shadow-sm bg-white/80 backdrop-blur-sm flex flex-col min-h-[300px]">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-2.5 px-4 flex flex-row items-center justify-between shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-calipso-500" />
                    <CardTitle className="text-xs font-bold text-gray-800 uppercase tracking-wider">{day}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="bg-calipso-50 text-calipso-700 border border-calipso-100 font-bold text-[10px] py-0 px-1.5 h-5 rounded-full">
                    {daySchedules.length}
                  </Badge>
                </CardHeader>
                <CardContent className="p-2.5 flex-1 flex flex-col gap-2 overflow-y-auto max-h-[500px]">
                  {daySchedules.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 text-gray-400">
                      <Clock className="h-7 w-7 text-gray-300 mb-1.5" />
                      <p className="text-[11px] text-center">Sin talleres agendados</p>
                    </div>
                  ) : (
                    daySchedules.map((item) => (
                      <div
                        key={item.id}
                        className="group shrink-0 p-2.5 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md hover:border-calipso-200 transition-all space-y-1.5 relative overflow-hidden"
                      >
                        {/* Indicador de Hora de inicio lateral */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-calipso-400 group-hover:bg-calipso-500 transition-colors" />
                        
                        <div className="flex items-center justify-between gap-2 pl-2">
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-calipso-600">
                            <Clock className="h-3 w-3 shrink-0 text-calipso-400" />
                            <span>{item.horaInicio} - {item.horaFin}</span>
                          </div>
                          <span className="text-[9px] text-gray-400 truncate max-w-[100px]" title={item.colegio}>
                            {item.colegio}
                          </span>
                        </div>

                        <h3 className="font-semibold text-gray-800 text-[12px] pl-2 leading-snug break-words group-hover:text-calipso-600 transition-colors">
                          {item.nombreTaller}
                        </h3>

                        <div className="flex flex-col gap-0.5 pl-2 pt-1 border-t border-gray-50 text-[11px] text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="truncate">{item.nombreProfesor}</span>
                          </div>
                          {item.cursosAsignados && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <GraduationCap className="h-3 w-3 text-gray-400 shrink-0" />
                              <span className="bg-calipso-50/50 text-calipso-700 px-1 py-0 rounded border border-calipso-100/50 font-medium text-[9px] truncate max-w-full">
                                Cursos: {item.cursosAsignados}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        // VISTA DE LISTA COMPLETA (TABLA DETALLADA)
        <Card className="border-0 shadow-md bg-white overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/30">
                  <TableHead className="font-semibold text-gray-600 w-[15%]">Día</TableHead>
                  <TableHead className="font-semibold text-gray-600 w-[20%]">Horario</TableHead>
                  <TableHead className="font-semibold text-gray-600 w-[30%]">Nombre Taller</TableHead>
                  <TableHead className="font-semibold text-gray-600 w-[20%]">Monitor Responsable</TableHead>
                  <TableHead className="font-semibold text-gray-600 w-[15%]">Establecimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-gray-400">
                      <Clock className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="font-medium">No se encontraron horarios para los filtros seleccionados</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSchedules.map((item) => (
                    <TableRow key={item.id} className="group hover:bg-gray-50/40 transition-colors">
                      <TableCell className="font-bold text-gray-800">
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 font-semibold border-gray-200">
                          {item.dia}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-calipso-600">
                          <Clock className="h-4 w-4 text-calipso-500" />
                          <span>{item.horaInicio} - {item.horaFin}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-calipso-500 shrink-0" />
                            <span className="font-bold text-gray-900 group-hover:text-calipso-600 transition-colors">{item.nombreTaller}</span>
                          </div>
                          {item.cursosAsignados && (
                            <span className="text-xs text-calipso-600 bg-calipso-50/50 px-1.5 py-0.5 rounded border border-calipso-100/50 w-fit ml-6 mt-0.5 font-medium">
                              Cursos: {item.cursosAsignados}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <User className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="font-medium">{item.nombreProfesor}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <School className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="font-medium">{item.colegio}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

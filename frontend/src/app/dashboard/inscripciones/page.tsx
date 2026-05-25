"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { inscripcionesApi, talleresApi, alumnosApi, colegiosApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Taller, Alumno, Colegio } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Loader2, Users, Calendar, Clock, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";

interface TallerResumen {
  id: string;
  nombre_taller: string;
  coordinador_nombre: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  cupos_maximos: number;
  inscritos_count: number;
}

export default function InscripcionesPage() {
  const { user } = useAuthStore();
  const [resumenTalleres, setResumenTalleres] = useState<TallerResumen[]>([]);
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [inscripciones, setInscripciones] = useState<any[]>([]); // Para filtrar duplicados
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedColegio, setSelectedColegio] = useState<string>("all");
  const [selectedTaller, setSelectedTaller] = useState<string>("");
  const [selectedAlumno, setSelectedAlumno] = useState<string>("");
  const [tallerSearch, setTallerSearch] = useState("");
  const [alumnoSearch, setAlumnoSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resumenData, talleresData, alumnosData, inscripcionesData, colegiosData] = await Promise.all([
        inscripcionesApi.getResumen(),
        talleresApi.getAll(),
        alumnosApi.getAll(),
        inscripcionesApi.getAll(),
        colegiosApi.getAll(),
      ]);
      setResumenTalleres(resumenData.data);
      setTalleres(talleresData.filter((t) => t.is_active));
      setAlumnos(alumnosData.filter((a) => a.is_active));
      setInscripciones(inscripcionesData);
      setColegios(colegiosData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaller || !selectedAlumno) {
      toast.error("Por favor selecciona un taller y un alumno");
      return;
    }
    setSaving(true);
    try {
      await inscripcionesApi.create({
        taller_id: selectedTaller,
        alumno_id: selectedAlumno,
      });
      await fetchData();
      setIsDialogOpen(false);
      setSelectedTaller("");
      setSelectedAlumno("");
      toast.success("Alumno inscrito correctamente");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al inscribir");
    } finally {
      setSaving(false);
    }
  };

  const filteredTalleres = resumenTalleres.filter((taller) => {
    const matchesSearch = taller.nombre_taller.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         taller.coordinador_nombre.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Si es admin y tiene filtro de colegio
    if (user?.rol === 'admin' && selectedColegio !== 'all') {
      // Necesitamos el colegio_id en el resumen para filtrar correctamente
      // Buscaremos el taller original para obtener su colegio_id
      const tallerOriginal = talleres.find(t => t.id === taller.id);
      return matchesSearch && tallerOriginal?.colegio_id === selectedColegio;
    }
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
      </div>
    );
  }

  const filteredTalleresList = talleres.filter(t => {
    const matchesSearch = t.nombre_taller.toLowerCase().includes(tallerSearch.toLowerCase());
    // Si hay un alumno seleccionado, no mostrar talleres donde ya esté inscrito
    if (selectedAlumno) {
      const yaInscrito = inscripciones.some(i => i.taller_id === t.id && i.alumno_id === selectedAlumno && i.estado === 'inscrito');
      return matchesSearch && !yaInscrito;
    }
    return matchesSearch;
  });

  const filteredAlumnosList = alumnos.filter(a => {
    const matchesSearch = a.nombre_completo.toLowerCase().includes(alumnoSearch.toLowerCase()) ||
                          a.rut.toLowerCase().includes(alumnoSearch.toLowerCase());
    // Si hay un taller seleccionado, no mostrar alumnos ya inscritos
    if (selectedTaller) {
      const yaInscrito = inscripciones.some(i => i.taller_id === selectedTaller && i.alumno_id === a.id && i.estado === 'inscrito');
      return matchesSearch && !yaInscrito;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inscripciones</h1>
          <p className="text-gray-500 mt-1">Gestión y monitoreo de talleres</p>
        </div>
        {user?.rol !== 'monitor' && (
          <Dialog 
            open={isDialogOpen} 
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setTallerSearch("");
                setAlumnoSearch("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-calipso-500 hover:bg-calipso-600">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Inscripción
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Nueva Inscripción</DialogTitle>
                <DialogDescription>
                  Inscribe a un alumno en un taller disponible
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                  {/* Taller Section */}
                  <div className="space-y-2">
                    <Label>Taller</Label>
                    <Select value={selectedTaller} onValueChange={setSelectedTaller}>
                      <SelectTrigger>
                        <SelectValue placeholder={filteredTalleresList.length === 0 ? "No se encontraron talleres" : "Selecciona un taller"} />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="flex items-center px-3 py-2 sticky top-0 bg-background border-b z-10">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <input
                            placeholder="Buscar taller..."
                            className="flex h-8 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            value={tallerSearch}
                            onChange={(e) => setTallerSearch(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="max-h-[200px] overflow-y-auto">
                          {filteredTalleresList.map((taller) => (
                            <SelectItem key={taller.id} value={taller.id}>
                              {taller.nombre_taller}
                            </SelectItem>
                          ))}
                          {filteredTalleresList.length === 0 && (
                            <div className="p-4 text-sm text-center text-gray-500">
                              No se encontraron resultados
                            </div>
                          )}
                        </div>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Alumno Section */}
                  <div className="space-y-2">
                    <Label>Alumno</Label>
                    <Select value={selectedAlumno} onValueChange={setSelectedAlumno}>
                      <SelectTrigger>
                        <SelectValue placeholder={filteredAlumnosList.length === 0 ? "No se encontraron alumnos" : "Selecciona un alumno"} />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="flex items-center px-3 py-2 sticky top-0 bg-background border-b z-10">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <input
                            placeholder="Buscar alumno..."
                            className="flex h-8 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            value={alumnoSearch}
                            onChange={(e) => setAlumnoSearch(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="max-h-[200px] overflow-y-auto">
                          {filteredAlumnosList.map((alumno) => (
                            <SelectItem key={alumno.id} value={alumno.id}>
                              {alumno.nombre_completo} - {alumno.rut}
                            </SelectItem>
                          ))}
                          {filteredAlumnosList.length === 0 && (
                            <div className="p-4 text-sm text-center text-gray-500">
                              No se encontraron resultados
                            </div>
                          )}
                        </div>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving || !selectedAlumno || !selectedTaller}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Inscribir
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-2 flex-grow max-w-md">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            placeholder="Buscar talleres o coordinadores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        
        {user?.rol === 'admin' && (
          <div className="w-full md:w-64">
            <Select value={selectedColegio} onValueChange={setSelectedColegio}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por colegio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los colegios</SelectItem>
                {colegios.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre_colegio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTalleres.map((taller) => {
          const cardContent = (
            <Card className={cn(
              "border-0 shadow-md h-full flex flex-col transition-shadow",
              user?.rol !== 'monitor' && "hover:shadow-lg cursor-pointer"
            )}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-calipso-50 rounded-lg">
                    <BookOpen className="h-6 w-6 text-calipso-500" />
                  </div>
                  <Badge variant={taller.inscritos_count >= taller.cupos_maximos ? "destructive" : "success"}>
                    {taller.inscritos_count} / {taller.cupos_maximos} Cupos
                  </Badge>
                </div>
                <CardTitle className="text-xl mt-3">{taller.nombre_taller}</CardTitle>
                <div className="space-y-1 mt-1">
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Monitor: {taller.coordinador_nombre}
                  </p>
                  {user?.rol === 'admin' && (
                    <p className="text-xs text-calipso-600 font-medium">
                      {talleres.find(t => t.id === taller.id)?.nombre_colegio}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>{taller.dia}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>{taller.hora_inicio} - {taller.hora_fin}</span>
                  </div>
                </div>
              </CardContent>
              {user?.rol !== 'monitor' && (
                <CardFooter className="pt-3 border-t bg-gray-50/50 flex justify-between items-center">
                  <span className="text-sm font-medium text-calipso-600">Ver alumnos y asistencia</span>
                  <ChevronRight className="h-4 w-4 text-calipso-600" />
                </CardFooter>
              )}
            </Card>
          );

          return user?.rol === 'monitor' ? (
            <div key={taller.id}>{cardContent}</div>
          ) : (
            <Link key={taller.id} href={`/dashboard/inscripciones/${taller.id}`}>
              {cardContent}
            </Link>
          );
        })}
      </div>

      {filteredTalleres.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No se encontraron talleres con esos criterios.</p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { talleresApi } from "@/lib/api";
import type { Taller } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export default function ClonacionTalleresPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [talleresSource, setTalleresSource] = useState<Taller[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const [sourceYear, setSourceYear] = useState<string>(currentYear.toString());
  const [targetYear, setTargetYear] = useState<string>((currentYear + 1).toString());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const years = Array.from({ length: 2030 - 2024 + 1 }, (_, i) => (2024 + i).toString());

  useEffect(() => {
    if (user?.rol === "monitor") {
      router.push("/dashboard/talleres");
      return;
    }
    fetchSourceTalleres();
  }, [sourceYear]);

  const fetchSourceTalleres = async () => {
    setLoading(true);
    try {
      const data = await talleresApi.getAll();
      // Filtrar por el año de origen seleccionado
      const filtered = data.filter(t => t.periodo.toString() === sourceYear);
      setTalleresSource(filtered);
      // Seleccionar todos por defecto
      setSelectedIds(filtered.map(t => t.id));
    } catch (error) {
      toast.error("Error al cargar talleres del periodo anterior");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTaller = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === talleresSource.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(talleresSource.map(t => t.id));
    }
  };

  const handleClonar = async () => {
    if (selectedIds.length === 0) {
      toast.error("Selecciona al menos un taller para clonar");
      return;
    }
    if (sourceYear === targetYear) {
      toast.error("El año de origen y destino no pueden ser iguales");
      return;
    }

    setCloning(true);
    try {
      await talleresApi.clonarPeriodo({
        source_periodo: parseInt(sourceYear),
        target_periodo: parseInt(targetYear),
        taller_ids: selectedIds
      });
      toast.success(`Se han creado los talleres para el periodo ${targetYear}`);
      router.push("/dashboard/talleres");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al clonar talleres");
    } finally {
      setCloning(false);
    }
  };

  if (loading && talleresSource.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Apertura de Nuevo Año</h1>
            <p className="text-gray-500 text-sm">Clona la estructura de talleres de un periodo a otro</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Configuración */}
        <Card className="md:col-span-1 border-0 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Copy className="h-5 w-5 text-calipso-500" />
              Configuración
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase">Año de Origen (Base)</label>
              <Select value={sourceYear} onValueChange={setSourceYear}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Año origen" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase">Año de Destino (Nuevo)</label>
              <Select value={targetYear} onValueChange={setTargetYear}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Año destino" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 mt-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="text-xs text-amber-700 leading-relaxed">
                  <p className="font-bold mb-1">Información importante:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Se copiarán nombres, horarios, cupos y monitores.</li>
                    <li>Las inscripciones estarán **vacías** en el nuevo año.</li>
                    <li>No se duplicarán talleres que ya existan en el año destino.</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button 
              className="w-full bg-calipso-500 hover:bg-calipso-600 h-12 font-bold shadow-lg shadow-calipso-100" 
              onClick={handleClonar}
              disabled={cloning || selectedIds.length === 0}
            >
              {cloning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Iniciar Apertura {targetYear}
            </Button>
          </CardContent>
        </Card>

        {/* Selección de Talleres */}
        <Card className="md:col-span-2 border-0 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50 flex flex-row items-center justify-between py-4">
            <CardTitle className="text-lg font-bold">Talleres Disponibles ({talleresSource.length})</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Seleccionados: {selectedIds.length}</span>
              <Button variant="ghost" size="sm" onClick={handleSelectAll} className="text-xs font-bold text-calipso-600">
                {selectedIds.length === talleresSource.length ? "Deseleccionar todo" : "Seleccionar todo"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-calipso-200" />
              </div>
            ) : talleresSource.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                No hay talleres registrados en el año {sourceYear}
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Taller</TableHead>
                    <TableHead>Monitor</TableHead>
                    <TableHead>Horario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {talleresSource.map((taller) => (
                    <TableRow key={taller.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <input 
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-calipso-600 focus:ring-calipso-500"
                          checked={selectedIds.includes(taller.id)} 
                          onChange={() => handleToggleTaller(taller.id)}
                        />
                      </TableCell>
                      <TableCell className="font-bold text-gray-700">{taller.nombre_taller}</TableCell>
                      <TableCell className="text-xs text-gray-500">{taller.nombre_profesor || "No asignado"}</TableCell>
                      <TableCell className="text-xs text-gray-400 font-medium">
                        {taller.dia}, {taller.hora_inicio} - {taller.hora_fin}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { correosApi, authApi, type CorreoReporte } from "@/lib/api";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Mail, Loader2, Trash2, XCircle, School } from "lucide-react";
import type { Colegio } from "@/types";

export default function CorreosPage() {
  const [correos, setCorreos] = useState<CorreoReporte[]>([]);
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [colegiosMap, setColegiosMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Formulario
  const [newEmail, setNewEmail] = useState("");
  const [selectedColegioId, setSelectedColegioId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  
  // Contexto
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
    
    const currentColegio = localStorage.getItem("colegio_id");
    setActiveColegioId(currentColegio || null);
    if (currentColegio) {
      setSelectedColegioId(currentColegio);
    }

    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [dataCorreos, dataColegios] = await Promise.all([
        correosApi.getAll().catch(() => []),
        authApi.getMisColegios().catch(() => []),
      ]);

      setCorreos(dataCorreos);
      setColegios(dataColegios);

      const map = new Map<string, string>();
      dataColegios.forEach(c => {
        map.set(c.id, c.nombre_colegio);
      });
      setColegiosMap(map);

      // Si estamos en vista global y hay colegios cargados, preseleccionar el primero por comodidad
      const currentColegio = localStorage.getItem("colegio_id");
      if (!currentColegio && dataColegios.length > 0) {
        setSelectedColegioId(dataColegios[0].id);
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCorreo = async () => {
    if (!newEmail.trim()) {
      toast.error("Ingresa un correo electrónico válido");
      return;
    }
    
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(newEmail.trim())) {
      toast.error("El formato del correo electrónico no es válido");
      return;
    }

    const targetColegio = activeColegioId || selectedColegioId;
    if (!targetColegio) {
      toast.error("Selecciona el colegio al que pertenece este destinatario");
      return;
    }

    setCreating(true);
    try {
      await correosApi.create({ 
        email: newEmail.trim(), 
        estado: true,
        colegio_id: targetColegio 
      });
      
      toast.success("Correo agregado exitosamente");
      setIsDialogOpen(false);
      setNewEmail("");
      
      // Recargar lista
      const data = await correosApi.getAll();
      setCorreos(data);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al agregar el correo");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleEstado = async (id: string, currentEstado: boolean) => {
    try {
      setCorreos((prev) =>
        prev.map((c) => (c.id === id ? { ...c, estado: !currentEstado } : c))
      );
      await correosApi.toggle(id, !currentEstado);
      toast.success(`Correo ${!currentEstado ? "habilitado" : "deshabilitado"} para reportes`);
    } catch (error: any) {
      setCorreos((prev) =>
        prev.map((c) => (c.id === id ? { ...c, estado: currentEstado } : c))
      );
      toast.error("Error al cambiar el estado del correo");
    }
  };

  const handleDeleteCorreo = async (id: string, email: string) => {
    const ok = await confirmDialog({
      title: "Eliminar destinatario",
      description: `¿Estás seguro de que deseas eliminar el correo ${email} de la lista de reportes automáticos?`,
      confirmText: "Eliminar",
      destructive: true,
    });

    if (!ok) return;

    try {
      await correosApi.delete(id);
      toast.success("Correo eliminado exitosamente");
      setCorreos((prev) => prev.filter((c) => c.id !== id));
    } catch (error: any) {
      toast.error("Error al eliminar el correo");
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
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Correos de Reportes</h1>
            {isVistaGlobal && (
              <Badge variant="outline" className="bg-calipso-50 text-calipso-700 border-calipso-200 font-semibold text-xs mt-1">
                Vista Global
              </Badge>
            )}
          </div>
          <p className="text-gray-500 mt-1 text-sm">
            Administra las direcciones de correo que recibirán alertas automáticas al cerrar sesiones con inconsistencias.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-calipso-500 hover:bg-calipso-600 shadow-md hover:shadow-lg transition-all">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Correo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-calipso-500" />
                Nuevo Destinatario
              </DialogTitle>
              <DialogDescription>
                Configura una nueva dirección para la recepción de reportes de auditoría de asistencia.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Selector de colegio si está en vista global */}
              {isVistaGlobal && (
                <div className="space-y-2">
                  <Label htmlFor="colegio-select" className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <School className="h-3.5 w-3.5 text-calipso-500" />
                    Establecimiento Destino
                  </Label>
                  <Select
                    value={selectedColegioId}
                    onValueChange={setSelectedColegioId}
                  >
                    <SelectTrigger className="focus:ring-calipso-500">
                      <SelectValue placeholder="Selecciona un colegio" />
                    </SelectTrigger>
                    <SelectContent>
                      {colegios.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre_colegio}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Correo Electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="ej. auditoria@colegio.cl"
                  className="focus-visible:ring-calipso-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateCorreo();
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={creating}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCorreo}
                className="bg-calipso-500 hover:bg-calipso-600"
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  "Agregar"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-md bg-white/70 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 px-6 py-4">
          <CardTitle className="text-base font-semibold text-gray-800">
            Lista de Distribución Autorizada
          </CardTitle>
          <CardDescription className="text-xs">
            Solo los correos con estado "Habilitado" recibirán notificaciones activas.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
            </div>
          ) : correos.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="h-12 w-12 rounded-full bg-calipso-50 flex items-center justify-center mx-auto mb-3 text-calipso-500">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-gray-800 text-sm">Sin destinatarios configurados</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                No hay correos registrados para {isVistaGlobal ? "el sistema global" : "este establecimiento"}. Agrega un nuevo correo utilizando el botón superior.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-gray-50/30">
                  <TableHead className="w-[50%] font-semibold text-gray-600">Correo Electrónico</TableHead>
                  <TableHead className="text-center font-semibold text-gray-600">Estado de Envío</TableHead>
                  <TableHead className="text-right font-semibold text-gray-600">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {correos.map((item) => (
                  <TableRow key={item.id} className="group transition-colors hover:bg-gray-50/50">
                    <TableCell className="font-medium text-gray-800">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400 group-hover:text-calipso-500 transition-colors shrink-0" />
                          <span className="truncate">{item.email}</span>
                        </div>
                        {isVistaGlobal && colegiosMap.has(item.colegio_id) && (
                          <Badge variant="secondary" className="w-fit text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            {colegiosMap.get(item.colegio_id)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleEstado(item.id, item.estado)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                          item.estado
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 hover:bg-emerald-100"
                            : "bg-gray-100 text-gray-500 ring-1 ring-gray-400/20 hover:bg-gray-200"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            item.estado ? "bg-emerald-500" : "bg-gray-400"
                          }`}
                        />
                        {item.estado ? "Habilitado" : "Deshabilitado"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCorreo(item.id, item.email)}
                        className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Eliminar destinatario"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

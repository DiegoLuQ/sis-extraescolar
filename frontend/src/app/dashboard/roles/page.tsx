"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { rolesApi, type Rol, type Permiso } from "@/lib/api";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modulo } from "@/types/permisos";
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
import { Plus, Save, Loader2, Settings } from "lucide-react";

const MODULOS: { key: Modulo; label: string }[] = [
  { key: "usuarios", label: "Usuarios" },
  { key: "alumnos", label: "Alumnos" },
  { key: "talleres", label: "Talleres" },
  { key: "inscripciones", label: "Inscripciones" },
  { key: "sesiones", label: "Sesiones" },
  { key: "asistencias", label: "Asistencias" },
  { key: "colegios", label: "Colegios" },
  { key: "roles", label: "Roles" },
];

export default function RolesPage() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRol, setSelectedRol] = useState<Rol | null>(null);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loadingPermisos, setLoadingPermisos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRolName, setNewRolName] = useState("");
  const [newRolDesc, setNewRolDesc] = useState("");

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const data = await rolesApi.getAll();
      setRoles(data);
    } catch (error) {
      console.error("Error fetching roles:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermisos = async (rolId: string) => {
    setLoadingPermisos(true);
    try {
      const data = await rolesApi.getPermisos(rolId);
      
      // Asegurar que todos los módulos tengan entrada
      const permisosMap = new Map(data.map(p => [p.modulo, p]));
      const permisosCompletos = MODULOS.map(m => 
        permisosMap.get(m.key) || {
          modulo: m.key,
          puede_crear: false,
          puede_leer: false,
          puede_editar: false,
          puede_eliminar: false,
        }
      );
      setPermisos(permisosCompletos);
    } catch (error) {
      console.error("Error fetching permisos:", error);
    } finally {
      setLoadingPermisos(false);
    }
  };

  const handleSelectRol = (rol: Rol) => {
    setSelectedRol(rol);
    fetchPermisos(rol.id);
  };

  const handlePermisoChange = (modulo: string, accion: keyof Permiso, value: boolean) => {
    setPermisos(prev => prev.map(p => 
      p.modulo === modulo ? { ...p, [accion]: value } : p
    ));
  };

  const handleSavePermisos = async () => {
    if (!selectedRol) return;
    setSaving(true);
    try {
      await rolesApi.updatePermisos(selectedRol.id, permisos);
      toast.success("Permisos guardados correctamente");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al guardar permisos");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRol = async () => {
    if (!newRolName.trim()) return;
    try {
      await rolesApi.create({ nombre: newRolName, descripcion: newRolDesc });
      setIsDialogOpen(false);
      setNewRolName("");
      setNewRolDesc("");
      toast.success("Rol creado");
      fetchRoles();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al crear rol");
    }
  };

  const handleDeleteRol = async (id: string) => {
    const ok = await confirmDialog({
      title: "Eliminar rol",
      description: "¿Estás seguro de eliminar este rol? Los usuarios con este rol perderán sus permisos asociados.",
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await rolesApi.delete(id);
      if (selectedRol?.id === id) {
        setSelectedRol(null);
        setPermisos([]);
      }
      toast.success("Rol eliminado");
      fetchRoles();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al eliminar rol");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Roles y Permisos</h1>
          <p className="text-gray-500 mt-1">Configura los permisos de cada rol en el sistema</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-calipso-500 hover:bg-calipso-600">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Rol
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Rol</DialogTitle>
              <DialogDescription>
                Ingresa el nombre y descripción del nuevo rol
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Rol</Label>
                <Input
                  id="nombre"
                  value={newRolName}
                  onChange={(e) => setNewRolName(e.target.value)}
                  placeholder="ej. supervisor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Input
                  id="descripcion"
                  value={newRolDesc}
                  onChange={(e) => setNewRolDesc(e.target.value)}
                  placeholder="Descripción opcional"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateRol}>
                Crear Rol
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lista de Roles */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {roles.map((rol) => (
                <div
                  key={rol.id}
                  onClick={() => handleSelectRol(rol)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedRol?.id === rol.id
                      ? "bg-calipso-100 border-calipso-500 border"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium capitalize">{rol.nombre}</p>
                      {rol.descripcion && (
                        <p className="text-xs text-gray-500">{rol.descripcion}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Badge variant={rol.is_active ? "default" : "secondary"}>
                        {rol.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                      {rol.nombre !== "admin" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRol(rol.id);
                          }}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Configuración de Permisos */}
        <Card className="md:col-span-2 border-0 shadow-md">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">
                Permisos {selectedRol && `- ${selectedRol.nombre}`}
              </CardTitle>
              {selectedRol && (
                <Button
                  onClick={handleSavePermisos}
                  disabled={saving || loadingPermisos}
                  className="bg-calipso-500 hover:bg-calipso-600"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedRol ? (
              <div className="text-center py-8 text-gray-400">
                <Settings className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Selecciona un rol para configurar sus permisos</p>
              </div>
            ) : loadingPermisos ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    <TableHead className="text-center">Crear</TableHead>
                    <TableHead className="text-center">Leer</TableHead>
                    <TableHead className="text-center">Editar</TableHead>
                    <TableHead className="text-center">Eliminar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permisos.map((permiso) => {
                    const modulo = MODULOS.find(m => m.key === permiso.modulo);
                    return (
                      <TableRow key={permiso.modulo}>
                        <TableCell className="font-medium">
                          {modulo?.label || permiso.modulo}
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={permiso.puede_crear}
                            onChange={(e) => handlePermisoChange(permiso.modulo, "puede_crear", e.target.checked)}
                            className="w-4 h-4 accent-calipso-500"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={permiso.puede_leer}
                            onChange={(e) => handlePermisoChange(permiso.modulo, "puede_leer", e.target.checked)}
                            className="w-4 h-4 accent-calipso-500"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={permiso.puede_editar}
                            onChange={(e) => handlePermisoChange(permiso.modulo, "puede_editar", e.target.checked)}
                            className="w-4 h-4 accent-calipso-500"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={permiso.puede_eliminar}
                            onChange={(e) => handlePermisoChange(permiso.modulo, "puede_eliminar", e.target.checked)}
                            className="w-4 h-4 accent-calipso-500"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

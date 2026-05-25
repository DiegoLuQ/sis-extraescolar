"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usuariosApi, colegiosApi } from "@/lib/api";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import type { Usuario, UsuarioCreate, Colegio } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export default function UsuariosPage() {
  const { user } = useAuthStore();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<UsuarioCreate>({
    nombre: "",
    nombre_2: "",
    email: "",
    password: "",
    rol: "monitor",
    colegio_id: undefined,
  });
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  useEffect(() => {
    fetchUsuarios();
    fetchColegios();
  }, []);

  useEffect(() => {
    if (user && user.rol !== "admin" && !editingUsuario) {
      const activeSchoolId = localStorage.getItem("colegio_id");
      if (activeSchoolId) {
        setFormData((prev) => ({ ...prev, colegio_id: activeSchoolId }));
      }
    }
  }, [user]);

  const fetchUsuarios = async () => {
    try {
      // El coordinador debe ver a todos los monitores disponibles para poder gestionarlos
      const onlyWithTalleres = false;
      const data = await usuariosApi.getAll(0, 100, undefined, onlyWithTalleres);
      setUsuarios(data);
    } catch (error) {
      console.error("Error fetching usuarios:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchColegios = async () => {
    try {
      const data = await colegiosApi.getAll();
      setColegios(data);
    } catch (error) {
      console.error("Error fetching colegios:", error);
    }
  };

  const getNombreColegio = (colegioId: string) => {
    const c = colegios.find((c) => c.id === colegioId);
    return c?.nombre_colegio || "—";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUsuario) {
        await usuariosApi.update(editingUsuario.id, {
          nombre: formData.nombre || undefined,
          nombre_2: formData.nombre_2 || undefined,
          email: formData.email || undefined,
          password: formData.password || undefined,
          rol: formData.rol,
          is_active: editIsActive,
          colegio_id: formData.colegio_id || undefined,
        });
      } else {
        await usuariosApi.create(formData);
      }
      await fetchUsuarios();
      setIsDialogOpen(false);
      resetForm();
      toast.success(editingUsuario ? "Usuario actualizado" : "Usuario creado");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setFormData({
      nombre: usuario.nombre,
      nombre_2: usuario.nombre_2 || "",
      email: usuario.email || "",
      password: "",
      rol: usuario.rol,
      colegio_id: usuario.colegio_id,
    });
    setEditIsActive(usuario.is_active);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Eliminar usuario",
      description: "¿Estás seguro de eliminar este usuario?",
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await usuariosApi.delete(id);
      toast.success("Usuario eliminado");
      await fetchUsuarios();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Error al eliminar el usuario");
    }
  };

  const resetForm = () => {
    const activeSchoolId = typeof window !== "undefined" ? localStorage.getItem("colegio_id") : null;
    setFormData({
      nombre: "",
      nombre_2: "",
      email: "",
      password: "",
      rol: "monitor",
      colegio_id: user?.rol !== "admin" ? (activeSchoolId || undefined) : undefined,
    });
    setEditIsActive(true);
    setEditingUsuario(null);
  };

  const filteredUsuarios = usuarios.filter(
    (u) =>
      u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.nombre_2 || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.rol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRolBadge = (rol: string) => {
    switch (rol) {
      case "admin":
        return <Badge variant="destructive">Admin</Badge>;
      case "monitor":
        return <Badge variant="default">Monitor</Badge>;
      case "coordinador":
        return <Badge variant="secondary">Coordinador</Badge>;
      default:
        return <Badge>{rol}</Badge>;
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
          <h1 className="text-3xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500 mt-1">Gestión de usuarios del sistema</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              resetForm();
            } else if (!editingUsuario) {
              const activeSchoolId = localStorage.getItem("colegio_id");
              setFormData((prev) => ({
                ...prev,
                colegio_id: user?.rol !== "admin" ? (activeSchoolId || undefined) : undefined,
              }));
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-calipso-500 hover:bg-calipso-600">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingUsuario ? "Editar Usuario" : "Nuevo Usuario"}
              </DialogTitle>
              <DialogDescription>
                {editingUsuario
                  ? "Modifica los datos del usuario"
                  : "Ingresa los datos del nuevo usuario"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre de Usuario (Login)</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value.replace(/\s+/g, '') })
                    }
                    placeholder="jdoe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nombre_2">Nombre Completo</Label>
                  <Input
                    id="nombre_2"
                    value={formData.nombre_2}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre_2: e.target.value })
                    }
                    placeholder="Juan Pérez"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="juan.perez@ejemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Contraseña {editingUsuario && "(opcional)"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder={editingUsuario ? "••••••••" : "Contraseña"}
                    required={!editingUsuario}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rol">Rol</Label>
                  <Select
                    value={formData.rol}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, rol: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {user?.rol === "admin" && (
                        <>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="coordinador">Coordinador</SelectItem>
                        </>
                      )}
                      <SelectItem value="monitor">Monitor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="colegio">Colegio</Label>
                  {user?.rol === "admin" ? (
                    <Select
                      value={formData.colegio_id || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, colegio_id: value === "none" ? undefined : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un colegio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar (Global)</SelectItem>
                        {colegios.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nombre_colegio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 font-medium">
                      {user?.nombre_colegio || getNombreColegio(formData.colegio_id || "")}
                    </div>
                  )}
                </div>
                {editingUsuario && (
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Select
                      value={editIsActive ? "true" : "false"}
                      onValueChange={(value) => setEditIsActive(value === "true")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Activo</SelectItem>
                        <SelectItem value="false">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingUsuario ? "Guardar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar usuarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre Completo</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Colegio</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsuarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                    No hay usuarios registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsuarios.map((usuario) => (
                  <TableRow key={usuario.id}>
                    <TableCell className="font-medium">{usuario.nombre_2 || "—"}</TableCell>
                    <TableCell className="text-gray-500">{usuario.nombre}</TableCell>
                    <TableCell className="text-gray-500">{usuario.email || "—"}</TableCell>
                    <TableCell>{getNombreColegio(usuario.colegio_id)}</TableCell>
                    <TableCell>{getRolBadge(usuario.rol)}</TableCell>
                    <TableCell>
                      <Badge variant={usuario.is_active ? "success" : "secondary"}>
                        {usuario.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(usuario)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(usuario.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

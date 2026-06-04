"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { colegiosApi } from "@/lib/api";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { formatRut, cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Colegio, ColegioCreate } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Loader2, School } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export default function ColegiosPage() {
  const { user } = useAuthStore();
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [usuariosCount, setUsuariosCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingColegio, setEditingColegio] = useState<Colegio | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<ColegioCreate>({
    nombre_colegio: "",
    rut_sostenedor: "",
    meta_asistencia: 85,
    tema_color: "calipso",
    logo_url: "",
  });

  useEffect(() => {
    if (user?.rol === "admin") {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // El conteo de usuarios por colegio se obtiene cross-tenant desde el backend
      // (usuariosApi.getAll está filtrado por el colegio activo y no sirve para esto).
      const [colegiosData, countData] = await Promise.all([
        colegiosApi.getAll(),
        colegiosApi.getUsuariosCount(),
      ]);
      setColegios(colegiosData);
      setUsuariosCount(countData);
    } catch (error) {
      console.error("Error fetching colegios data:", error);
      toast.error("Error al cargar los establecimientos");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingColegio) {
        await colegiosApi.update(editingColegio.id, formData);
      } else {
        await colegiosApi.create(formData);
      }
      await fetchData();
      setIsDialogOpen(false);
      resetForm();
      toast.success(editingColegio ? "Colegio actualizado" : "Colegio registrado exitosamente");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al guardar el colegio");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (colegio: Colegio) => {
    setEditingColegio(colegio);
    setFormData({
      nombre_colegio: colegio.nombre_colegio,
      rut_sostenedor: formatRut(colegio.rut_sostenedor),
      meta_asistencia: colegio.meta_asistencia ?? 85,
      tema_color: colegio.tema_color ?? "calipso",
      logo_url: colegio.logo_url ?? "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Eliminar colegio",
      description: "¿Estás seguro de dar de baja este establecimiento? Esta acción deshabilitará su acceso.",
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await colegiosApi.delete(id);
      toast.success("Colegio eliminado exitosamente");
      await fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Error al eliminar el colegio");
    }
  };

  const resetForm = () => {
    setFormData({
      nombre_colegio: "",
      rut_sostenedor: "",
      meta_asistencia: 85,
      tema_color: "calipso",
      logo_url: "",
    });
    setEditingColegio(null);
  };

  const getCantidadUsuarios = (colegioId: string) => {
    return usuariosCount[colegioId] ?? 0;
  };

  const filteredColegios = colegios.filter(
    (c) =>
      c.nombre_colegio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.rut_sostenedor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
      </div>
    );
  }

  if (user?.rol !== "admin") {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-700">Acceso Denegado</h2>
        <p className="text-gray-500 mt-2">Esta sección está restringida únicamente para administradores globales.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Colegios</h1>
          <p className="text-gray-500 mt-1">Gestión de establecimientos educacionales</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-calipso-500 hover:bg-calipso-600">
              <Plus className="h-4 w-4 mr-2" />
              Registrar Colegio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingColegio ? "Editar Colegio" : "Registrar Colegio"}
              </DialogTitle>
              <DialogDescription>
                {editingColegio
                  ? "Modifica los datos del establecimiento educacional"
                  : "Ingresa los datos del nuevo establecimiento educacional"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre_colegio">Nombre del Colegio</Label>
                  <Input
                    id="nombre_colegio"
                    value={formData.nombre_colegio}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre_colegio: e.target.value })
                    }
                    placeholder="Liceo Diego Portales"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rut_sostenedor">RUT Sostenedor / Establecimiento</Label>
                  <Input
                    id="rut_sostenedor"
                    value={formData.rut_sostenedor}
                    onChange={(e) =>
                      setFormData({ ...formData, rut_sostenedor: formatRut(e.target.value) })
                    }
                    placeholder="12345678-9"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta_asistencia">Meta de Asistencia (%)</Label>
                  <Input
                    id="meta_asistencia"
                    type="number"
                    min={0}
                    max={100}
                    value={formData.meta_asistencia ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        meta_asistencia: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="85"
                  />
                  <p className="text-xs text-gray-500">
                    Meta por defecto para todos los talleres del colegio. Cada taller puede tener su propia meta.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tema_color">Tema de Color</Label>
                  <Select
                    value={formData.tema_color || "calipso"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, tema_color: value })
                    }
                  >
                    <SelectTrigger id="tema_color">
                      <SelectValue placeholder="Selecciona un tema" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calipso">Calipso (Por defecto)</SelectItem>
                      <SelectItem value="verde-oscuro">Verde Oscuro</SelectItem>
                      <SelectItem value="burdeo">Burdeo</SelectItem>
                      <SelectItem value="azul">Azul</SelectItem>
                      <SelectItem value="anaranjado">Anaranjado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo_url">URL del Logo (Opcional)</Label>
                  <Input
                    id="logo_url"
                    value={formData.logo_url || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, logo_url: e.target.value })
                    }
                    placeholder="https://ejemplo.com/logo.png"
                  />
                </div>
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
                  {editingColegio ? "Guardar" : "Registrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Colegios</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{colegios.length}</h3>
              </div>
              <div className="bg-calipso-50 p-3 rounded-full">
                <School className="h-6 w-6 text-calipso-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar colegios por nombre o RUT..."
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
                <TableHead>Nombre del Colegio</TableHead>
                <TableHead>RUT Sostenedor</TableHead>
                <TableHead className="text-center">Usuarios Asociados</TableHead>
                <TableHead>Tema</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredColegios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                    No hay colegios registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredColegios.map((colegio) => (
                  <TableRow key={colegio.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {colegio.logo_url ? (
                          <img src={colegio.logo_url} alt="Logo" className="h-6 w-6 object-contain rounded bg-gray-50 border p-0.5" />
                        ) : (
                          <School className="h-4 w-4 text-calipso-500" />
                        )}
                        {colegio.nombre_colegio}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">{formatRut(colegio.rut_sostenedor)}</TableCell>
                    <TableCell className="text-center font-semibold text-gray-700">
                      {getCantidadUsuarios(colegio.id)}
                    </TableCell>
                    <TableCell className="capitalize">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "inline-block w-3 h-3 rounded-full border",
                          colegio.tema_color === "verde-oscuro" && "bg-green-700",
                          colegio.tema_color === "burdeo" && "bg-red-800",
                          colegio.tema_color === "azul" && "bg-blue-700",
                          colegio.tema_color === "anaranjado" && "bg-orange-500",
                          (colegio.tema_color === "calipso" || !colegio.tema_color) && "bg-cyan-500"
                        )} />
                        {colegio.tema_color || "Calipso"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={colegio.is_active ? "success" : "secondary"}>
                        {colegio.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(colegio)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(colegio.id)}
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

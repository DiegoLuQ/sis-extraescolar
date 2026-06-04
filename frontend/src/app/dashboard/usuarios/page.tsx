"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usuariosApi, colegiosApi, talleresApi } from "@/lib/api";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import type { Usuario, UsuarioCreate, Colegio, Taller } from "@/types";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Pencil, Trash2, Loader2, Users, FileDown, Upload, FileSpreadsheet } from "lucide-react";
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

  const [isOtrosMonitoresOpen, setIsOtrosMonitoresOpen] = useState(false);
  const [monitoresCompartidos, setMonitoresCompartidos] = useState<{ monitor: Usuario; talleres: Taller[] }[]>([]);
  const [desasignando, setDesasignando] = useState<string | null>(null);

  const [loadingModal, setLoadingModal] = useState(false);

  // Carga masiva por Excel
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [selectedColegioId, setSelectedColegioId] = useState<string>("");

  // Eliminación masiva (admin y coordinador)
  const puedeEliminar = user?.rol === "admin" || user?.rol === "coordinador";
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState<"activos" | "inactivos" | "todos">("activos");

  // Modal de eliminación en cascada (con confirmación por nombre)
  const [deleteModal, setDeleteModal] = useState<{
    ids: string[];
    usuarios: { id: string; nombre: string; nombre_2: string | null }[];
    impacto: { talleres: number; sesiones: number; inscripciones: number; asistencias: number; notas: number };
    expected: string;
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [processingDelete, setProcessingDelete] = useState(false);

  useEffect(() => {
    fetchUsuarios();
    fetchColegios();
  }, []);

  useEffect(() => {
    if (user) {
      if (user.rol === "admin") {
        setEstadoFilter("todos");
      } else if (!editingUsuario) {
        const activeSchoolId = localStorage.getItem("colegio_id");
        if (activeSchoolId) {
          setFormData((prev) => ({ ...prev, colegio_id: activeSchoolId }));
        }
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

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await usuariosApi.downloadTemplate();
      downloadBlob(blob, "planilla_usuarios.xlsx");
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error("Error al descargar la planilla");
    }
  };

  const handleExport = async () => {
    try {
      const blob = await usuariosApi.exportUsuarios();
      downloadBlob(blob, "usuarios.xlsx");
    } catch (error) {
      console.error("Error exporting users:", error);
      toast.error("Error al exportar usuarios");
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // El admin debe elegir el colegio de destino
    if (user?.rol === "admin") {
      setPendingFile(file);
      setSelectedColegioId("");
      setIsSchoolModalOpen(true);
      e.target.value = "";
      return;
    }

    await executeBulkUpload(file);
    e.target.value = "";
  };

  const executeBulkUpload = async (file: File, colegioId?: string) => {
    setSaving(true);
    try {
      const result = await usuariosApi.bulkUpload(file, colegioId);
      const { stats } = result;
      toast.success(
        `Importación completada — Insertados: ${stats.inserted}, Omitidos: ${stats.skipped}, Errores: ${stats.errors}`
      );
      await fetchUsuarios();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al subir el archivo");
    } finally {
      setSaving(false);
    }
  };

  const confirmBulkUpload = async () => {
    if (!pendingFile || !selectedColegioId) {
      toast.error("Debes seleccionar un colegio");
      return;
    }
    await executeBulkUpload(pendingFile, selectedColegioId);
    setIsSchoolModalOpen(false);
    setPendingFile(null);
    setSelectedColegioId("");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = (ids: string[]) => {
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !ids.includes(id))
        : Array.from(new Set([...selectedIds, ...ids]))
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeletingBulk(true);
    try {
      await openDelete(selectedIds);
    } finally {
      setDeletingBulk(false);
    }
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

  const ejecutarEliminacion = async (ids: string[]) => {
    const res = await usuariosApi.bulkDelete(ids, user?.rol === "admin");
    const r = res.resultado;
    if (res.permanente) {
      toast.success(
        `Eliminado físicamente: ${r.usuarios} usuario(s), ${r.talleres} taller(es), ${r.sesiones} sesión(es), ${r.inscripciones} inscripción(es)`
      );
    } else {
      toast.success(
        `Desactivado(s): ${r.usuarios} usuario(s), ${r.talleres} taller(es) desactivado(s), ${r.inscripciones} inscripción(es) retirada(s)`
      );
    }
    setSelectedIds([]);
    await fetchUsuarios();
  };

  // Punto de entrada para eliminar (individual o masivo). Calcula el impacto y,
  // si hay dependencias, abre el modal que exige digitar el nombre/login.
  const openDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const imp = await usuariosApi.getImpactoEliminacion(ids);
      if (!imp.tiene_dependencias) {
        const ok = await confirmDialog({
          title: ids.length > 1 ? "Eliminar usuarios" : "Eliminar usuario",
          description: "Se desactivará(n) el/los usuario(s) seleccionado(s). Acción reversible reactivándolos.",
          confirmText: "Eliminar",
          destructive: true,
        });
        if (!ok) return;
        await ejecutarEliminacion(ids);
        return;
      }
      const expected = imp.usuarios.length === 1 ? imp.usuarios[0].nombre : "ELIMINAR";
      setConfirmText("");
      setDeleteModal({ ids, usuarios: imp.usuarios, impacto: imp, expected });
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Error al calcular el impacto de la eliminación");
    }
  };

  const handleDelete = (id: string) => openDelete([id]);

  const confirmDeleteCascada = async () => {
    if (!deleteModal) return;
    setProcessingDelete(true);
    try {
      await ejecutarEliminacion(deleteModal.ids);
      setDeleteModal(null);
      setConfirmText("");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Error al eliminar");
    } finally {
      setProcessingDelete(false);
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

  const handleOpenOtrosMonitores = async () => {
    setLoadingModal(true);
    setIsOtrosMonitoresOpen(true);
    try {
      const activoId = localStorage.getItem("colegio_id");
      const [todosMonitores, talleresColegio] = await Promise.all([
        usuariosApi.getAll(0, 200, "monitor"),
        talleresApi.getAll(),
      ]);
      const externos = todosMonitores
        .filter(m => m.colegio_id !== activoId)
        .filter(m => talleresColegio.some(t => t.profesor_id === m.id));
      setMonitoresCompartidos(externos.map(m => ({
        monitor: m,
        talleres: talleresColegio.filter(t => t.profesor_id === m.id),
      })));
    } catch {
      toast.error("Error al cargar monitores compartidos");
      setIsOtrosMonitoresOpen(false);
    } finally {
      setLoadingModal(false);
    }
  };

  const handleDesasignar = async (monitor: Usuario, talleres: Taller[]) => {
    const nombres = talleres.map(t => `"${t.nombre_taller}"`).join(", ");
    const ok = await confirmDialog({
      title: "Desasignar Monitor",
      description: `Se eliminarán los talleres ${nombres} de ${monitor.nombre_2 || monitor.nombre} en este colegio.`,
      confirmText: "Desasignar",
      destructive: true,
    });
    if (!ok) return;
    setDesasignando(monitor.id);
    try {
      await Promise.all(talleres.map(t => talleresApi.delete(t.id)));
      toast.success("Monitor desasignado correctamente");
      setMonitoresCompartidos(prev => prev.filter(mc => mc.monitor.id !== monitor.id));
    } catch {
      toast.error("Error al desasignar el monitor");
    } finally {
      setDesasignando(null);
    }
  };

  const filteredUsuarios = usuarios.filter((u) => {
    // Filtro por estado (activos/inactivos/todos)
    if (estadoFilter === "activos" && !u.is_active) return false;
    if (estadoFilter === "inactivos" && u.is_active) return false;
    const q = searchTerm.toLowerCase();
    return (
      u.nombre.toLowerCase().includes(q) ||
      (u.nombre_2 || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      u.rol.toLowerCase().includes(q)
    );
  });

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
        <div className="flex items-center gap-2">
          {(user?.rol === "admin" || user?.rol === "coordinador") && (
            <>
              <Button variant="outline" onClick={handleOpenOtrosMonitores} className="border-gray-200">
                <Users className="h-4 w-4 mr-2" />
                Otros Monitores
              </Button>
              <Button variant="outline" onClick={handleDownloadTemplate} className="border-gray-200">
                <FileDown className="h-4 w-4 mr-2" />
                Plantilla
              </Button>
              <input
                type="file"
                id="bulk-upload-usuarios"
                accept=".xlsx"
                className="hidden"
                onChange={handleBulkUpload}
              />
              <Button
                variant="outline"
                className="border-gray-200"
                disabled={saving}
                onClick={() => document.getElementById("bulk-upload-usuarios")?.click()}
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Importar Excel
              </Button>
              <Button variant="outline" onClick={handleExport} className="border-gray-200">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </>
          )}
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
      </div>

      {/* Modal: Eliminación en cascada (confirmación por nombre) */}
      <Dialog open={deleteModal !== null} onOpenChange={(open) => { if (!open) { setDeleteModal(null); setConfirmText(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Eliminar {deleteModal && deleteModal.usuarios.length > 1 ? `${deleteModal.usuarios.length} usuarios` : "usuario"}
            </DialogTitle>
            <DialogDescription>
              Esta acción desactivará al/los usuario(s) y, en cascada, lo siguiente:
            </DialogDescription>
          </DialogHeader>

          {deleteModal && (
            <div className="space-y-3 py-1">
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Usuario(s)</p>
                <div className="flex flex-wrap gap-1">
                  {deleteModal.usuarios.map((u) => (
                    <Badge key={u.id} variant="secondary" className="text-[11px]">
                      {u.nombre_2 || u.nombre} <span className="opacity-60 ml-1">({u.nombre})</span>
                    </Badge>
                  ))}
                </div>
              </div>

              <ul className="text-sm text-gray-700 space-y-1">
                <li className="flex justify-between"><span>Talleres que se desactivarán</span><span className="font-bold text-red-600">{deleteModal.impacto.talleres}</span></li>
                <li className="flex justify-between"><span>Inscripciones que se retirarán</span><span className="font-bold text-red-600">{deleteModal.impacto.inscripciones}</span></li>
              </ul>

              <div className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-[12px] text-amber-800">
                Se <b>conservan</b> como histórico: {deleteModal.impacto.sesiones} sesión(es), {deleteModal.impacto.asistencias} asistencia(s) y {deleteModal.impacto.notas} nota(s). Los <b>alumnos no se eliminan</b> (solo se retira su inscripción).
              </div>

              <div className="space-y-2 pt-1">
                <Label htmlFor="confirm-delete" className="text-sm">
                  Para confirmar, escribe{" "}
                  <span className="font-mono font-bold text-gray-900">{deleteModal.expected}</span>
                </Label>
                <Input
                  id="confirm-delete"
                  autoFocus
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={deleteModal.expected}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleteModal(null); setConfirmText(""); }}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={processingDelete || !deleteModal || confirmText.trim() !== deleteModal.expected}
              onClick={confirmDeleteCascada}
            >
              {processingDelete && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Selección de colegio para carga masiva (admin) */}
      <Dialog open={isSchoolModalOpen} onOpenChange={(open) => {
        setIsSchoolModalOpen(open);
        if (!open) { setPendingFile(null); setSelectedColegioId(""); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Colegio de destino</DialogTitle>
            <DialogDescription>
              Selecciona el colegio al que se importarán los usuarios del archivo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="mb-2 block">Colegio</Label>
            <Select value={selectedColegioId} onValueChange={setSelectedColegioId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un colegio..." />
              </SelectTrigger>
              <SelectContent>
                {colegios.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre_colegio}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsSchoolModalOpen(false); setPendingFile(null); setSelectedColegioId(""); }}>
              Cancelar
            </Button>
            <Button onClick={confirmBulkUpload} disabled={!selectedColegioId || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Otros Monitores */}
      <Dialog open={isOtrosMonitoresOpen} onOpenChange={setIsOtrosMonitoresOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-calipso-500" />
              Monitores de Otros Colegios
            </DialogTitle>
            <DialogDescription>
              Monitores con cuenta en otro colegio que tienen talleres asignados en este colegio.
            </DialogDescription>
          </DialogHeader>
          {loadingModal ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-calipso-500" />
            </div>
          ) : monitoresCompartidos.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">
              No hay monitores compartidos en este colegio.
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {monitoresCompartidos.map(({ monitor, talleres }) => (
                <div key={monitor.id} className="flex items-start justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{monitor.nombre_2 || monitor.nombre}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Login: <span className="font-mono">{monitor.nombre}</span> · {getNombreColegio(monitor.colegio_id)}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {talleres.map(t => (
                        <Badge key={t.id} variant="secondary" className="text-[11px]">{t.nombre_taller}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0 ml-3"
                    disabled={desasignando === monitor.id}
                    onClick={() => handleDesasignar(monitor, talleres)}
                  >
                    {desasignando === monitor.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar usuarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              {user?.rol === "admin" && (
                <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as any)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activos">Activos</SelectItem>
                    <SelectItem value="inactivos">Inactivos</SelectItem>
                    <SelectItem value="todos">Todos</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            {puedeEliminar && selectedIds.length > 0 && (
              <Button
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 shrink-0"
                disabled={deletingBulk}
                onClick={handleBulkDelete}
              >
                {deletingBulk ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Eliminar seleccionados ({selectedIds.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {puedeEliminar && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredUsuarios.length > 0 && filteredUsuarios.every((u) => selectedIds.includes(u.id))}
                      onCheckedChange={() => toggleSelectAll(filteredUsuarios.map((u) => u.id))}
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                )}
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
                  <TableCell colSpan={puedeEliminar ? 8 : 7} className="text-center py-8 text-gray-400">
                    No hay usuarios registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsuarios.map((usuario) => (
                  <TableRow key={usuario.id} className={selectedIds.includes(usuario.id) ? "bg-red-50/30" : undefined}>
                    {puedeEliminar && (
                      <TableCell className="w-10">
                        <Checkbox
                          checked={selectedIds.includes(usuario.id)}
                          onCheckedChange={() => toggleSelect(usuario.id)}
                          aria-label={`Seleccionar ${usuario.nombre}`}
                        />
                      </TableCell>
                    )}
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

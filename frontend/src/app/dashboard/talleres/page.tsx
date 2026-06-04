"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { talleresApi, usuariosApi, colegiosApi } from "@/lib/api";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import type { Taller, TallerCreate, User, Colegio, Usuario } from "@/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Loader2, Download, FileUp, BookOpen, Users, Copy, UserPlus } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

function getSiglas(nombreColegio: string): string {
  const palabras = nombreColegio.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 1) return palabras[0].slice(0, 3).toLowerCase();
  return palabras.map(p => p[0]).join('').toLowerCase();
}

function toSlug(nombre: string): string {
  const sinAcentos = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return sinAcentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 35);
}

export default function TalleresPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTaller, setEditingTaller] = useState<Taller | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [soloColegioActual, setSoloColegioActual] = useState(true);
  const [editIsActive, setEditIsActive] = useState(true);

  const [isImportarOpen, setIsImportarOpen] = useState(false);
  const [talleresImportables, setTalleresImportables] = useState<Taller[]>([]);
  const [importando, setImportando] = useState<string | null>(null);
  const [loadingImportar, setLoadingImportar] = useState(false);

  type OpcionImportar = {
    taller: Taller;
    siglas: string;
    loginNombre: string;
    nombre2: string;
    colegio: Colegio;
  };
  const [opcionImportarTaller, setOpcionImportarTaller] = useState<OpcionImportar | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 2030 - 2024 + 1 }, (_, i) => (2024 + i).toString());

  // Estados para carga masiva
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [selectedColegioId, setSelectedColegioId] = useState<string>("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [formData, setFormData] = useState<TallerCreate>({
    nombre_taller: "",
    profesor_id: "",
    cupos_maximos: 20,
    periodo: new Date().getFullYear(),
    cursos_asignados: "",
    meta_asistencia: null,
    colegio_id: undefined,
    horarios: [{ dia: "Lunes", hora_inicio: "", hora_fin: "" }],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [talleresData, usuariosData, colegiosData] = await Promise.all([
        talleresApi.getAll(),
        usuariosApi.getAll(0, 100, "monitor", false), // Monitores globales para asignar
        colegiosApi.getAll(),
      ]);
      setTalleres(talleresData);
      setUsuarios(usuariosData);
      setColegios(colegiosData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const activeSchoolId = localStorage.getItem("colegio_id");
      const payload = {
        ...formData,
        colegio_id: user?.rol !== "admin" ? (activeSchoolId || undefined) : formData.colegio_id,
      };
      if (editingTaller) {
        await talleresApi.update(editingTaller.id, { ...payload, is_active: editIsActive });
      } else {
        await talleresApi.create(payload);
      }
      await fetchData();
      setIsDialogOpen(false);
      resetForm();
      toast.success(editingTaller ? "Taller actualizado" : "Taller creado");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (taller: Taller) => {
    setEditingTaller(taller);
    
    let horarios = taller.horarios || [];
    if (horarios.length === 0 && taller.dia) {
      const dias = taller.dia.split(",").map((d) => d.trim());
      horarios = dias.map((d) => ({
        dia: d || "Lunes",
        hora_inicio: taller.hora_inicio || "",
        hora_fin: taller.hora_fin || "",
      }));
    }
    if (horarios.length === 0) {
      horarios = [{ dia: "Lunes", hora_inicio: "", hora_fin: "" }];
    }

    setFormData({
      nombre_taller: taller.nombre_taller,
      profesor_id: taller.profesor_id,
      cupos_maximos: taller.cupos_maximos,
      periodo: taller.periodo,
      cursos_asignados: taller.cursos_asignados || "",
      meta_asistencia: taller.meta_asistencia ?? null,
      colegio_id: taller.colegio_id,
      horarios: horarios.map((h) => ({
        dia: h.dia,
        hora_inicio: h.hora_inicio || "",
        hora_fin: h.hora_fin || "",
      })),
    });
    const activoColegioId = localStorage.getItem("colegio_id");
    const monitorEsDeEste = usuarios.find(u => u.id === taller.profesor_id)?.colegio_id === activoColegioId;
    setSoloColegioActual(monitorEsDeEste);
    setEditIsActive(taller.is_active);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Eliminar taller",
      description: "¿Estás seguro de eliminar este taller? Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await talleresApi.delete(id);
      toast.success("Taller eliminado");
      await fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Error al eliminar el taller");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await talleresApi.getTemplate();
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "planilla_talleres.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error("Error al descargar la planilla");
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (user?.rol === 'admin') {
      setPendingFile(file);
      try {
        const data = await colegiosApi.getAll();
        setColegios(data);
        setIsSchoolModalOpen(true);
      } catch (error) {
        console.error("Error fetching colegios:", error);
        toast.error("Error al cargar la lista de colegios");
      }
      e.target.value = "";
      return;
    }

    await executeBulkUpload(file);
    e.target.value = "";
  };

  const executeBulkUpload = async (file: File, colegioId?: string) => {
    setSaving(true);
    try {
      const response = await talleresApi.bulkUpload(file, colegioId);
      const { stats } = response.data;
      toast.success(
        `Importación completada — Insertados: ${stats.inserted}, Actualizados: ${stats.updated}, Errores: ${stats.errors}`
      );
      await fetchData();
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

  const handleOpenImportar = async () => {
    setLoadingImportar(true);
    setIsImportarOpen(true);
    try {
      const data = await talleresApi.getTalleresOtrosColegios();
      setTalleresImportables(data);
    } catch {
      toast.error("Error al cargar talleres disponibles");
      setIsImportarOpen(false);
    } finally {
      setLoadingImportar(false);
    }
  };

  const handleImportar = (taller: Taller) => {
    const activoId = localStorage.getItem("colegio_id");
    const colegio = colegios.find(c => c.id === activoId);
    if (!colegio || !activoId) { toast.error("No se pudo determinar el colegio activo"); return; }

    const siglas = getSiglas(colegio.nombre_colegio);
    const loginBase = `${siglas}_${toSlug(taller.nombre_taller)}`;
    let loginNombre = loginBase;
    let n = 2;
    while (usuarios.some(u => u.nombre === loginNombre)) loginNombre = `${loginBase}_${n++}`;

    const prefijo2 = `${siglas}_usuario_`;
    const nums = usuarios
      .map(u => u.nombre_2 || "")
      .filter(v => v.startsWith(prefijo2))
      .map(v => parseInt(v.replace(prefijo2, "")) || 0);
    const nombre2 = `${prefijo2}${nums.length > 0 ? Math.max(...nums) + 1 : 1}`;

    setOpcionImportarTaller({ taller, siglas, loginNombre, nombre2, colegio });
  };

  const handleImportarMismoMonitor = async () => {
    const opcion = opcionImportarTaller;
    if (!opcion) return;
    setOpcionImportarTaller(null);
    const activoId = localStorage.getItem("colegio_id");
    setImportando(opcion.taller.id);
    try {
      const nuevoTaller = await talleresApi.create({
        nombre_taller: opcion.taller.nombre_taller,
        profesor_id: opcion.taller.profesor_id,
        cupos_maximos: 20,
        periodo: opcion.taller.periodo,
        colegio_id: activoId || undefined,
      });
      toast.success(`Taller importado con el monitor original`);
      await fetchData();
      setIsImportarOpen(false);
      const tallerCompleto = await talleresApi.getById(nuevoTaller.id);
      handleEdit(tallerCompleto);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al importar");
    } finally {
      setImportando(null);
    }
  };

  const handleImportarNuevoUsuario = async () => {
    const opcion = opcionImportarTaller;
    if (!opcion) return;
    setOpcionImportarTaller(null);
    const activoId = localStorage.getItem("colegio_id");

    const ok = await confirmDialog({
      title: "Crear usuario monitor",
      description: `Se creará el usuario "${opcion.loginNombre}" (nombre completo: ${opcion.nombre2}) con contraseña "${opcion.siglas}123" en ${opcion.colegio.nombre_colegio}. ¿Deseas continuar?`,
      confirmText: "Crear y continuar",
    });
    if (!ok) return;

    setImportando(opcion.taller.id);
    try {
      const nuevoUsuario = await usuariosApi.create({
        nombre: opcion.loginNombre,
        nombre_2: opcion.nombre2,
        password: `${opcion.siglas}123`,
        rol: "monitor",
        colegio_id: activoId || undefined,
      });
      const nuevoTaller = await talleresApi.create({
        nombre_taller: opcion.taller.nombre_taller,
        profesor_id: nuevoUsuario.id,
        cupos_maximos: 20,
        periodo: opcion.taller.periodo,
      });
      toast.success(`Taller importado. Usuario: "${opcion.loginNombre}" · Clave: ${opcion.siglas}123`);
      await fetchData();
      setIsImportarOpen(false);
      const tallerCompleto = await talleresApi.getById(nuevoTaller.id);
      handleEdit(tallerCompleto);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al importar");
    } finally {
      setImportando(null);
    }
  };

  const resetForm = () => {
    setFormData({
      nombre_taller: "",
      profesor_id: "",
      cupos_maximos: 20,
      periodo: new Date().getFullYear(),
      cursos_asignados: "",
      meta_asistencia: null,
      colegio_id: undefined,
      horarios: [{ dia: "Lunes", hora_inicio: "", hora_fin: "" }],
    });
    setEditingTaller(null);
    setSoloColegioActual(true);
    setEditIsActive(true);
  };

  const getMonitor = (profesorId: string) => {
    const usuario = usuarios.find((u) => u.id === profesorId);
    return usuario?.nombre_2 || usuario?.nombre || "No asignado";
  };

  const filteredTalleres = talleres.filter(
    (t) => {
      const matchSearch = t.nombre_taller.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.cupos_maximos.toString().includes(searchTerm);
      const matchYear = filterYear ? t.periodo.toString() === filterYear : true;
      return matchSearch && matchYear;
    }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-calipso-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Talleres</h1>
          <p className="text-gray-500 mt-1">Gestión de actividades extraescolares</p>
        </div>
        {user?.rol !== 'monitor' && (
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button 
              variant="outline" 
              className="border-calipso-200 text-calipso-700 hover:bg-calipso-50 w-full sm:w-auto"
              onClick={() => router.push("/dashboard/talleres/clonacion")}
            >
              <Copy className="h-4 w-4 mr-2" />
              Abrir Nuevo Año
            </Button>

            <Button variant="outline" onClick={handleDownloadTemplate} disabled={saving} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Descargar Planilla
            </Button>
            
            <input
              type="file"
              id="bulk-upload"
              className="hidden"
              accept=".xlsx"
              onChange={handleBulkUpload}
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('bulk-upload')?.click()}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4 mr-2" />
              )}
              Importar Excel
            </Button>

            <Button
              variant="outline"
              onClick={handleOpenImportar}
              className="border-calipso-200 text-calipso-700 hover:bg-calipso-50 w-full sm:w-auto"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Importar de Otro Colegio
            </Button>

            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-calipso-500 hover:bg-calipso-600 w-full sm:w-auto" disabled={saving}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Taller
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>
                    {editingTaller ? "Editar Taller" : "Nuevo Taller"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingTaller
                      ? "Modifica los datos del taller"
                      : "Ingresa los datos del nuevo taller"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto py-2">
                    {/* Columna Izquierda: Información General */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-calipso-600 border-b pb-2">Información General</h3>
                      <div className="space-y-2">
                        <Label htmlFor="nombre_taller">Nombre del Taller</Label>
                        <Input
                          id="nombre_taller"
                          value={formData.nombre_taller}
                          onChange={(e) =>
                            setFormData({ ...formData, nombre_taller: e.target.value })
                          }
                          placeholder="Taller de Fútbol"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="colegio">Colegio</Label>
                        {user?.rol === "admin" ? (
                          <Select
                            value={formData.colegio_id || "none"}
                            onValueChange={(value) =>
                              setFormData({ ...formData, colegio_id: value === "none" ? undefined : value })
                            }
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un colegio" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Seleccionar colegio...</SelectItem>
                              {colegios.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.nombre_colegio}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={user?.nombre_colegio || "—"}
                            disabled
                            className="bg-gray-50"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="profesor">Monitor Responsable</Label>
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!soloColegioActual}
                              onChange={(e) => setSoloColegioActual(!e.target.checked)}
                              className="h-3.5 w-3.5 rounded accent-calipso-500"
                            />
                            <span className="text-xs text-gray-500">Todos los colegios</span>
                          </label>
                        </div>
                        <Select
                          value={formData.profesor_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, profesor_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un monitor" />
                          </SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const activoColegioId = localStorage.getItem("colegio_id");
                              const lista = soloColegioActual
                                ? usuarios.filter(u => u.colegio_id === activoColegioId)
                                : usuarios;
                              if (lista.length === 0) {
                                return (
                                  <div className="px-3 py-4 text-sm text-center text-gray-400">
                                    No hay monitores en este colegio
                                  </div>
                                );
                              }
                              return lista.map((usuario) => {
                                const esDeOtroColegio = !soloColegioActual && usuario.colegio_id !== activoColegioId;
                                const colegio = esDeOtroColegio
                                  ? colegios.find(c => c.id === usuario.colegio_id)?.nombre_colegio
                                  : null;
                                return (
                                  <SelectItem key={usuario.id} value={usuario.id}>
                                    <span className="flex items-center gap-1.5">
                                      {usuario.nombre_2 || usuario.nombre}
                                      {colegio && (
                                        <span className="text-[11px] text-gray-400 font-normal">— {colegio}</span>
                                      )}
                                    </span>
                                  </SelectItem>
                                );
                              });
                            })()}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label htmlFor="cupos_maximos">Cupos Máx.</Label>
                          <Input
                            id="cupos_maximos"
                            type="number"
                            min="1"
                            value={formData.cupos_maximos}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                cupos_maximos: parseInt(e.target.value) || 0,
                              })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="periodo">Año Académico</Label>
                          <Input
                            id="periodo"
                            type="number"
                            value={formData.periodo}
                            onChange={(e) =>
                              setFormData({ ...formData, periodo: parseInt(e.target.value) || currentYear })
                            }
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cursos_asignados">Cursos Asignados (Opcional)</Label>
                        <Input
                          id="cursos_asignados"
                          value={formData.cursos_asignados || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, cursos_asignados: e.target.value })
                          }
                          placeholder="Ej: 1ºA, 1ºB, 2ºA o Básica"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="meta_asistencia">Meta de Asistencia (%) (Opcional)</Label>
                        <Input
                          id="meta_asistencia"
                          type="number"
                          min={0}
                          max={100}
                          value={formData.meta_asistencia ?? ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              meta_asistencia: e.target.value === "" ? null : parseInt(e.target.value),
                            })
                          }
                          placeholder="Vacío = hereda la meta del colegio"
                        />
                      </div>
                      {editingTaller && (
                        <div className="space-y-2">
                          <Label htmlFor="estado_taller">Estado</Label>
                          <Select
                            value={editIsActive ? "true" : "false"}
                            onValueChange={(v) => setEditIsActive(v === "true")}
                          >
                            <SelectTrigger id="estado_taller">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Activo</SelectItem>
                              <SelectItem value="false">Inactivo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Columna Derecha: Configuración de Horarios */}
                    <div className="space-y-4 flex flex-col h-full">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-sm font-semibold text-calipso-600">Configuración de Horarios</h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 px-2"
                          onClick={() => {
                            const currentHorarios = formData.horarios || [];
                            setFormData({
                              ...formData,
                              horarios: [...currentHorarios, { dia: "Lunes", hora_inicio: "", hora_fin: "" }],
                            });
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Agregar bloque
                        </Button>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2.5 flex-1">
                        {(formData.horarios || []).map((horario, index) => (
                          <div key={index} className="flex items-center gap-1.5 p-2 bg-gray-50/80 border rounded-md">
                            <Select
                              value={horario.dia}
                              onValueChange={(val) => {
                                const updated = [...(formData.horarios || [])];
                                updated[index].dia = val;
                                setFormData({ ...formData, horarios: updated });
                              }}
                            >
                              <SelectTrigger className="w-[110px] bg-white h-8 text-xs">
                                <SelectValue placeholder="Día" />
                              </SelectTrigger>
                              <SelectContent>
                                {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map((d) => (
                                  <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="time"
                              value={horario.hora_inicio || ""}
                              onChange={(e) => {
                                const updated = [...(formData.horarios || [])];
                                updated[index].hora_inicio = e.target.value;
                                setFormData({ ...formData, horarios: updated });
                              }}
                              className="bg-white h-8 text-xs px-1.5"
                              placeholder="Inicio"
                            />
                            <span className="text-gray-400 text-xs">-</span>
                            <Input
                              type="time"
                              value={horario.hora_fin || ""}
                              onChange={(e) => {
                                const updated = [...(formData.horarios || [])];
                                updated[index].hora_fin = e.target.value;
                                setFormData({ ...formData, horarios: updated });
                              }}
                              className="bg-white h-8 text-xs px-1.5"
                              placeholder="Fin"
                            />
                            {(formData.horarios || []).length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0 ml-auto"
                                onClick={() => {
                                  const updated = (formData.horarios || []).filter((_, i) => i !== index);
                                  setFormData({ ...formData, horarios: updated });
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="border-t pt-3 mt-auto">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingTaller ? "Guardar" : "Crear"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium text-gray-500">Total Talleres</h3>
            <BookOpen className="h-4 w-4 text-calipso-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{talleres.length}</div>
            <p className="text-xs text-gray-400 mt-1">Actividades activas</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium text-gray-500">Alumnos Inscritos</h3>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {talleres.reduce((acc, t) => acc + (t.alumnos_inscritos || 0), 0)}
            </div>
            <p className="text-xs text-gray-400 mt-1">Matrícula actual</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium text-gray-500">Cupos Totales</h3>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {talleres.reduce((acc, t) => acc + (t.cupos_maximos || 0), 0)}
            </div>
            <p className="text-xs text-gray-400 mt-1">Capacidad máxima</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium text-gray-500">Ocupación</h3>
            <div className="text-xs font-bold text-calipso-600">
              {talleres.reduce((acc, t) => acc + (t.cupos_maximos || 0), 0) > 0 
                ? Math.round((talleres.reduce((acc, t) => acc + (t.alumnos_inscritos || 0), 0) / talleres.reduce((acc, t) => acc + (t.cupos_maximos || 0), 0)) * 100)
                : 0}%
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
              <div 
                className="bg-calipso-500 h-2 rounded-full transition-all duration-500" 
                style={{ 
                  width: `${talleres.reduce((acc, t) => acc + (t.cupos_maximos || 0), 0) > 0 
                    ? Math.round((talleres.reduce((acc, t) => acc + (t.alumnos_inscritos || 0), 0) / talleres.reduce((acc, t) => acc + (t.cupos_maximos || 0), 0)) * 100)
                    : 0}%` 
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">Porcentaje de uso</p>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Selección de Colegio para Admin */}
      <Dialog open={isSchoolModalOpen} onOpenChange={setIsSchoolModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleccionar Colegio de Destino</DialogTitle>
            <DialogDescription>
              Estás a punto de subir talleres masivamente. Por favor selecciona el colegio al que pertenecen.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Colegio</Label>
              <Select value={selectedColegioId} onValueChange={setSelectedColegioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un colegio..." />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSchoolModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmBulkUpload} disabled={!selectedColegioId || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Comenzar Importación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Elegir tipo de importación */}
      <Dialog open={!!opcionImportarTaller} onOpenChange={(v) => { if (!v) setOpcionImportarTaller(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cómo deseas importar el monitor?</DialogTitle>
            <DialogDescription>
              El taller <span className="font-semibold text-gray-800">{opcionImportarTaller?.taller.nombre_taller}</span> pertenece a{" "}
              <span className="font-semibold text-gray-800">{opcionImportarTaller?.taller.nombre_colegio}</span>
              {opcionImportarTaller?.taller.nombre_profesor && (
                <> y está a cargo de <span className="font-semibold text-gray-800">{opcionImportarTaller.taller.nombre_profesor}</span></>
              )}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <button
              onClick={handleImportarMismoMonitor}
              className="flex flex-col gap-1 text-left p-4 rounded-lg border border-calipso-200 bg-calipso-50/50 hover:bg-calipso-100/60 transition-colors"
            >
              <span className="font-semibold text-calipso-700 text-sm">Usar el mismo monitor</span>
              <span className="text-xs text-gray-500">
                El monitor <span className="font-mono">{opcionImportarTaller?.taller.nombre_profesor}</span> tendrá acceso a ambos colegios. No se crea ningún usuario nuevo.
              </span>
            </button>
            <button
              onClick={handleImportarNuevoUsuario}
              className="flex flex-col gap-1 text-left p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <span className="font-semibold text-gray-700 text-sm">Crear nuevo usuario</span>
              <span className="text-xs text-gray-500">
                Se creará el login <span className="font-mono">{opcionImportarTaller?.loginNombre}</span> con contraseña <span className="font-mono">{opcionImportarTaller?.siglas}123</span>.
              </span>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpcionImportarTaller(null)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Importar de Otro Colegio */}
      <Dialog open={isImportarOpen} onOpenChange={setIsImportarOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-calipso-500" />
              Importar Taller desde Otro Colegio
            </DialogTitle>
            <DialogDescription>
              Selecciona un taller. Se creará un usuario monitor y el taller en este colegio. Luego podrás completar horarios, cupos y cursos.
            </DialogDescription>
          </DialogHeader>
          {loadingImportar ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-calipso-500" />
            </div>
          ) : talleresImportables.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">
              No hay talleres disponibles para importar.
            </p>
          ) : (
            <>
              {(() => {
                const activoId = localStorage.getItem("colegio_id");
                const colegio = colegios.find(c => c.id === activoId);
                const siglas = colegio ? getSiglas(colegio.nombre_colegio) : "???";
                return (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-md p-2.5 border border-gray-100">
                    Prefijo de usuario: <span className="font-mono font-bold text-gray-700">{siglas}_</span>
                    {" · "}Contraseña por defecto: <span className="font-mono font-bold text-gray-700">{siglas}123</span>
                  </p>
                );
              })()}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {talleresImportables.map(taller => (
                  <div key={taller.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{taller.nombre_taller}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {taller.nombre_colegio} · {taller.periodo}
                        {taller.nombre_profesor && ` · ${taller.nombre_profesor}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={importando === taller.id}
                      onClick={() => handleImportar(taller)}
                      className="ml-3 shrink-0 bg-calipso-500 hover:bg-calipso-600 text-white"
                    >
                      {importando === taller.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : "Importar"}
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3 flex-1 min-w-[200px] w-full">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <Input
                placeholder="Buscar talleres..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:max-w-sm"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest mr-1">Año:</span>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-28 h-9 text-xs font-bold border-gray-200">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Monitor</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Alumnos (Inscritos / Cupos)</TableHead>
                <TableHead>Estado</TableHead>
                {user?.rol !== 'monitor' && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTalleres.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                    No hay talleres registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredTalleres.map((taller) => (
                  <TableRow key={taller.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-calipso-500 shrink-0" />
                          <span className="font-semibold text-gray-900">{taller.nombre_taller}</span>
                        </div>
                        <span className="text-xs text-gray-500 ml-6">
                          {taller.nombre_colegio}
                        </span>
                        {taller.cursos_asignados && (
                          <span className="text-xs text-calipso-600 bg-calipso-50/80 px-1.5 py-0.5 rounded border border-calipso-100 w-fit ml-6 mt-0.5 font-medium">
                            Cursos: {taller.cursos_asignados}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        {getMonitor(taller.profesor_id)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {taller.horarios && taller.horarios.length > 0 ? (
                          taller.horarios.map((h, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-xs bg-gray-50 px-2 py-0.5 rounded border max-w-fit">
                              <span className="font-bold text-gray-700">{h.dia}:</span>
                              <span className="text-gray-500">{h.hora_inicio} - {h.hora_fin}</span>
                            </div>
                          ))
                        ) : (
                          <>
                            <span className="font-medium text-xs">{taller.dia}</span>
                            {taller.hora_inicio && taller.hora_fin && (
                              <span className="text-xs text-gray-500">
                                {taller.hora_inicio} - {taller.hora_fin}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${taller.alumnos_inscritos >= taller.cupos_maximos ? 'text-red-500' : 'text-green-600'}`}>
                          {taller.alumnos_inscritos}
                        </span>
                        <span className="text-gray-400">/</span>
                        <span>{taller.cupos_maximos}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={taller.is_active ? "success" : "secondary"}>
                        {taller.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    {user?.rol !== 'monitor' && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEdit(taller)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDelete(taller.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
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

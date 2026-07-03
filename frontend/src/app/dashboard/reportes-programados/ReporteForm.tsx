"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  reportesProgramadosApi,
  correosApi,
  authApi,
  type FrecuenciaReporte,
  type CorreoReporte,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CalendarClock, Loader2, Mail, School, Eye, AlertTriangle } from "lucide-react";
import type { Colegio } from "@/types";
import { FRECUENCIA_LABEL } from "./constants";

export default function ReporteForm({ reporteId }: { reporteId?: string }) {
  const router = useRouter();
  const isEditing = !!reporteId;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [activeColegioId, setActiveColegioId] = useState<string | null>(null);
  const [selectedColegioId, setSelectedColegioId] = useState<string>("");

  const [nombre, setNombre] = useState("");
  const [frecuencia, setFrecuencia] = useState<FrecuenciaReporte>("semanal");
  const [destinatarios, setDestinatarios] = useState<string[]>([]);

  const [correosDelColegio, setCorreosDelColegio] = useState<CorreoReporte[]>([]);
  const [loadingCorreos, setLoadingCorreos] = useState(false);

  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewEtiqueta, setPreviewEtiqueta] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const isVistaGlobal = !activeColegioId;

  // Carga inicial: colegios disponibles y, si estamos editando, el reporte existente.
  useEffect(() => {
    const init = async () => {
      const currentColegio = localStorage.getItem("colegio_id");
      setActiveColegioId(currentColegio || null);

      try {
        const dataColegios = await authApi.getMisColegios();
        setColegios(dataColegios);

        if (isEditing && reporteId) {
          const reporte = await reportesProgramadosApi.getById(reporteId);
          setNombre(reporte.nombre || "");
          setFrecuencia(reporte.frecuencia);
          setDestinatarios(reporte.destinatarios);
          setSelectedColegioId(reporte.colegio_id);
        } else {
          setSelectedColegioId(currentColegio || dataColegios[0]?.id || "");
        }
      } catch (error) {
        console.error("Error cargando datos del reporte:", error);
        toast.error("No se pudo cargar la información del reporte");
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Correos registrados disponibles para el colegio seleccionado.
  useEffect(() => {
    if (!selectedColegioId) {
      setCorreosDelColegio([]);
      return;
    }
    setLoadingCorreos(true);
    correosApi
      .getAll()
      .then((data) => setCorreosDelColegio(data.filter((c) => c.colegio_id === selectedColegioId)))
      .catch(() => setCorreosDelColegio([]))
      .finally(() => setLoadingCorreos(false));
  }, [selectedColegioId]);

  // Vista previa del cuerpo del correo, en base a datos reales del período actual.
  useEffect(() => {
    if (!selectedColegioId) {
      setPreviewHtml("");
      return;
    }
    setLoadingPreview(true);
    reportesProgramadosApi
      .preview(selectedColegioId, frecuencia)
      .then((data) => {
        setPreviewHtml(data.html);
        setPreviewEtiqueta(data.etiqueta_periodo);
      })
      .catch(() => {
        setPreviewHtml("");
        toast.error("No se pudo generar la vista previa del correo");
      })
      .finally(() => setLoadingPreview(false));
  }, [selectedColegioId, frecuencia]);

  const toggleDestinatario = (email: string) => {
    setDestinatarios((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));
  };

  // Destinatarios ya guardados que ya no figuran en la lista de correos del colegio (no se pierden al editar).
  const destinatariosNoRegistrados = destinatarios.filter(
    (email) => !correosDelColegio.some((c) => c.email === email)
  );

  const handleSave = async () => {
    if (destinatarios.length === 0) {
      toast.error("Selecciona al menos un correo destinatario");
      return;
    }
    if (!selectedColegioId) {
      toast.error("Selecciona el colegio para este reporte");
      return;
    }

    setSaving(true);
    try {
      if (isEditing && reporteId) {
        await reportesProgramadosApi.update(reporteId, {
          nombre: nombre.trim() || undefined,
          frecuencia,
          destinatarios,
          colegio_id: selectedColegioId,
        });
        toast.success("Reporte actualizado exitosamente");
      } else {
        await reportesProgramadosApi.create({
          nombre: nombre.trim() || undefined,
          frecuencia,
          destinatarios,
          colegio_id: selectedColegioId,
        });
        toast.success("Reporte programado creado exitosamente");
      }
      router.push("/dashboard/reportes-programados");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al guardar el reporte");
    } finally {
      setSaving(false);
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
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.push("/dashboard/reportes-programados")} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {isEditing ? "Editar Reporte Programado" : "Nuevo Reporte Programado"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Se enviará automáticamente a las 9:00am según la frecuencia seleccionada, con el total de asistencia del período correspondiente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md bg-white/70 backdrop-blur-sm">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 px-6 py-4">
            <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-calipso-500" />
              Configuración
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {isVistaGlobal && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <School className="h-3.5 w-3.5 text-calipso-500" />
                  Establecimiento
                </Label>
                <Select value={selectedColegioId} onValueChange={(v) => { setSelectedColegioId(v); setDestinatarios([]); }}>
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
              <Label htmlFor="nombre" className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                Nombre del Reporte (opcional)
              </Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="ej. Reporte semanal dirección"
                className="focus-visible:ring-calipso-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Frecuencia</Label>
              <Select value={frecuencia} onValueChange={(v) => setFrecuencia(v as FrecuenciaReporte)}>
                <SelectTrigger className="focus:ring-calipso-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FRECUENCIA_LABEL) as FrecuenciaReporte[]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {FRECUENCIA_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wider">
                <Mail className="h-3.5 w-3.5 text-calipso-500" />
                Destinatarios
              </Label>

              {!selectedColegioId ? (
                <p className="text-xs text-gray-400 py-2">Selecciona primero un establecimiento.</p>
              ) : loadingCorreos ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando correos registrados...
                </div>
              ) : correosDelColegio.length === 0 && destinatariosNoRegistrados.length === 0 ? (
                <div className="text-xs text-gray-500 border border-dashed border-gray-200 rounded-lg p-3">
                  No hay correos registrados para este colegio.{" "}
                  <Link href="/dashboard/correos" className="text-calipso-600 font-medium hover:underline">
                    Agrégalos en Correos de Reportes
                  </Link>
                  .
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
                  {correosDelColegio.map((correo) => (
                    <label
                      key={correo.id}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={destinatarios.includes(correo.email)}
                        onCheckedChange={() => toggleDestinatario(correo.email)}
                      />
                      <span className="flex-1 truncate">{correo.email}</span>
                      {!correo.estado && (
                        <span className="text-[10px] text-gray-400 uppercase">Deshabilitado</span>
                      )}
                    </label>
                  ))}
                  {destinatariosNoRegistrados.map((email) => (
                    <label key={email} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                      <Checkbox checked onCheckedChange={() => toggleDestinatario(email)} />
                      <span className="flex-1 truncate">{email}</span>
                      <span className="text-[10px] text-amber-500 uppercase flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> No registrado
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/70 backdrop-blur-sm">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 px-6 py-4">
            <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Eye className="h-4 w-4 text-calipso-500" />
              Vista Previa del Correo
            </CardTitle>
            <CardDescription className="text-xs">
              {previewEtiqueta || "Cuerpo del correo que recibirán los destinatarios, con datos reales del período actual."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {!selectedColegioId ? (
              <div className="flex items-center justify-center h-72 text-sm text-gray-400">
                Selecciona un establecimiento para ver la vista previa.
              </div>
            ) : loadingPreview ? (
              <div className="flex items-center justify-center h-72">
                <Loader2 className="h-6 w-6 animate-spin text-calipso-500" />
              </div>
            ) : (
              <iframe
                title="Vista previa del correo"
                srcDoc={previewHtml}
                className="w-full h-96 rounded-lg border border-gray-200 bg-white"
                sandbox=""
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/dashboard/reportes-programados")} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} className="bg-calipso-500 hover:bg-calipso-600" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : isEditing ? (
            "Guardar Cambios"
          ) : (
            "Crear Reporte"
          )}
        </Button>
      </div>
    </div>
  );
}

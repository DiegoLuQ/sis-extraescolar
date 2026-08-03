"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Lock,
  ShieldCheck,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock3,
  ChevronDown,
  ChevronUp,
  Sparkles,
  School,
  LogOut,
  Loader2,
  HelpCircle,
  FileText,
  UserCheck,
  BookOpen,
} from "lucide-react";
import { buscadorApi, BuscadorAlumnoResult, BuscadorResponse, BuscadorTaller } from "@/lib/api";

export default function BuscarAlumnosPage() {
  // Estado para PIN
  const [pin, setPin] = useState<string[]>(["", "", "", "", ""]);
  const [isPinValid, setIsPinValid] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string>("");
  const [validatingPin, setValidatingPin] = useState<boolean>(false);
  const [savedPin, setSavedPin] = useState<string>("");

  // Estado para Búsqueda
  const [query, setQuery] = useState<string>("");
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [searchResponse, setSearchResponse] = useState<BuscadorResponse | null>(null);
  const [expandedTalleres, setExpandedTalleres] = useState<Record<string, boolean>>({});

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cargar PIN guardado en sessionStorage si existe
  useEffect(() => {
    const storedPin = sessionStorage.getItem("buscar_alumnos_pin");
    if (storedPin && storedPin.length === 5) {
      setSavedPin(storedPin);
      validarPinDirecto(storedPin);
    }
  }, []);

  const validarPinDirecto = async (pinStr: string) => {
    setValidatingPin(true);
    setPinError("");
    try {
      const res = await buscadorApi.validarPin(pinStr);
      if (res.valid) {
        setIsPinValid(true);
        setSavedPin(pinStr);
        sessionStorage.setItem("buscar_alumnos_pin", pinStr);
      } else {
        setIsPinValid(false);
        setPinError("PIN incorrecto. Intenta nuevamente.");
        sessionStorage.removeItem("buscar_alumnos_pin");
      }
    } catch (err: any) {
      setPinError("Error al verificar el PIN. Inténtalo más tarde.");
    } finally {
      setValidatingPin(false);
    }
  };

  // Manejo de entrada de PIN casilla por casilla
  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);

    // Avanzar foco si ingresó un dígito
    if (value && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }

    // Si completó los 5 dígitos, validar automáticamente
    const fullPin = newPin.join("");
    if (fullPin.length === 5) {
      validarPinDirecto(fullPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (/^\d{5}$/.test(pasteData)) {
      const digits = pasteData.split("");
      setPin(digits);
      inputRefs.current[4]?.focus();
      validarPinDirecto(pasteData);
    }
  };

  const handleLogoutPin = () => {
    sessionStorage.removeItem("buscar_alumnos_pin");
    setIsPinValid(false);
    setPin(["", "", "", "", ""]);
    setSavedPin("");
    setSearchResponse(null);
    setQuery("");
  };

  // Búsqueda en tiempo real con Debounce
  useEffect(() => {
    if (!isPinValid || !savedPin) return;

    if (!query.trim()) {
      setSearchResponse(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res = await buscadorApi.buscar(savedPin, query);
        setSearchResponse(res);
      } catch (err) {
        console.error("Error al buscar alumnos:", err);
      } finally {
        setLoadingSearch(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query, isPinValid, savedPin]);

  const toggleTallerExpand = (key: string) => {
    setExpandedTalleres((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Renderizar estado de asistencia con badge coloreado
  const renderEstadoBadge = (estado: string) => {
    switch (estado.toLowerCase()) {
      case "presente":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Presente
          </span>
        );
      case "ausente":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> Ausente
          </span>
        );
      case "atraso":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock3 className="w-3.5 h-3.5" /> Atraso
          </span>
        );
      case "justificado":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <AlertCircle className="w-3.5 h-3.5" /> Justificado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Sin registro
          </span>
        );
    }
  };

  // PANTALLA DE INGRESO POR PIN
  if (!isPinValid) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Fondo decorativo con gradientes suaves */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-8 shadow-2xl relative z-10 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-6">
            <Lock className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight">Acceso al Buscador</h1>
          <p className="text-slate-400 text-sm mt-2">
            Ingresa el PIN de 5 dígitos autorizado para acceder a la búsqueda en tiempo real de alumnos y talleres.
          </p>

          <div className="flex justify-center gap-3 my-8" onPaste={handlePaste}>
            {pin.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePinChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                disabled={validatingPin}
                className="w-12 h-14 text-center text-2xl font-bold bg-slate-800/90 text-white border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all disabled:opacity-50"
              />
            ))}
          </div>

          {pinError && (
            <div className="mb-4 text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/50 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {pinError}
            </div>
          )}

          {validatingPin && (
            <div className="flex items-center justify-center gap-2 text-cyan-400 text-xs font-medium py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Verificando PIN...
            </div>
          )}

          <div className="mt-6 text-xs text-slate-500">
            Sistema de Asistencia Extraescolar · Módulos Institucionales
          </div>
        </div>
      </div>
    );
  }

  // PANTALLA PRINCIPAL DEL BUSCADOR
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Header Superior Limpio */}
      <header className="sticky top-0 z-40 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Buscador de Alumnos
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                  Tiempo Real / Regex
                </span>
              </h1>
              <p className="text-xs text-slate-400">Consulta talleres, monitores, asistencias y ubicación según el día</p>
            </div>
          </div>

          <button
            onClick={handleLogoutPin}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all border border-slate-700"
            title="Bloquear sesión por PIN"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" /> Salir / Bloquear
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Barra de Búsqueda Principal */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm space-y-3">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Ingrese Nombre o RUT del Alumno (Regex Activado)
          </label>

          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: Juan Pérez, 19.123, ^maria, o patrón regex..."
              autoFocus
              className="w-full bg-slate-900/90 text-white placeholder-slate-500 pl-12 pr-10 py-3.5 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 text-sm sm:text-base font-medium transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-4 text-slate-400 hover:text-slate-200 text-xs font-bold bg-slate-800 px-2 py-1 rounded-md"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                <HelpCircle className="w-3 h-3 text-cyan-400" /> Búsqueda flexible por subcadena o expresión regular Regex
              </span>
            </div>

            {searchResponse && (
              <div className="text-slate-300 font-medium flex items-center gap-3">
                <span>Día Actual: <strong className="text-cyan-400">{searchResponse.dia_actual}</strong></span>
                <span>•</span>
                <span>Coincidencias: <strong className="text-white">{searchResponse.total_resultados}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Indicador de Carga */}
        {loadingSearch && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-sm font-medium">Buscando alumnos y procesando historial de asistencias...</p>
          </div>
        )}

        {/* Sin resultados / Estado Inicial */}
        {!loadingSearch && !searchResponse && (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
              <User className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Comienza a escribir para buscar</h3>
            <p className="text-xs max-w-md mx-auto text-slate-500">
              Puedes ingresar parte del nombre, apellido o RUT del alumno. La búsqueda es instantánea y responderá con sus talleres actuales, monitor asignado y asistencias.
            </p>
          </div>
        )}

        {!loadingSearch && searchResponse && searchResponse.results.length === 0 && (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 bg-rose-950/40 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-800/50">
              <XCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">No se encontraron alumnos</h3>
            <p className="text-xs text-slate-500">
              No existen coincidencias para &quot;<strong className="text-slate-300">{query}</strong>&quot;. Intenta con otro nombre o RUT.
            </p>
          </div>
        )}

        {/* LISTADO DE RESULTADOS DE ALUMNOS */}
        {!loadingSearch && searchResponse && searchResponse.results.length > 0 && (
          <div className="space-y-6">
            {searchResponse.results.map((alumno: BuscadorAlumnoResult) => (
              <div
                key={alumno.alumno_id}
                className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl"
              >
                {/* Encabezado del Alumno */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-5 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-lg">
                      {alumno.nombre_completo.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        {alumno.nombre_completo}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">RUT: {alumno.rut}</span>
                        <span>•</span>
                        <span className="text-cyan-300 font-medium">Curso: {alumno.curso}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-300">
                          <School className="w-3.5 h-3.5 text-slate-400" /> {alumno.nombre_colegio}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Talleres Inscritos</span>
                    <span className="text-lg font-bold text-cyan-400">{alumno.talleres.length}</span>
                  </div>
                </div>

                {/* Contenido de Talleres del Alumno */}
                <div className="p-5 space-y-4">
                  {alumno.talleres.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-2">
                      El alumno no registra talleres extraescolares activos actualmente.
                    </div>
                  ) : (
                    alumno.talleres.map((taller: BuscadorTaller) => {
                      const expandKey = `${alumno.alumno_id}_${taller.taller_id}`;
                      const isExpanded = !!expandedTalleres[expandKey];

                      return (
                        <div
                          key={taller.taller_id}
                          className={`rounded-xl border transition-all ${
                            taller.es_hoy
                              ? "bg-slate-900/90 border-cyan-500/50 ring-1 ring-cyan-500/30"
                              : "bg-slate-900/50 border-slate-700/60"
                          }`}
                        >
                          {/* Ficha Resumen del Taller */}
                          <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                            <div className="space-y-1.5 max-w-lg">
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-white">{taller.nombre_taller}</h3>
                                {taller.es_hoy && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500 text-slate-950 animate-pulse shadow-sm shadow-cyan-500/50">
                                    <Clock className="w-3.5 h-3.5" /> Taller Hoy ({searchResponse.dia_actual})
                                  </span>
                                )}
                              </div>

                              {/* Monitor y Días */}
                              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                                <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                                  <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Monitor: <strong className="text-white">{taller.monitor.nombre}</strong></span>
                                </div>

                                <div className="flex items-center gap-1.5 text-slate-400">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Días: <strong className="text-slate-200">{taller.dias_resumen || "No especificado"}</strong></span>
                                </div>
                              </div>
                            </div>

                            {/* Estadísticas de Asistencia */}
                            <div className="flex items-center gap-6">
                              <div className="text-center">
                                <span className="text-[11px] text-slate-400 block uppercase font-semibold">Asistencia</span>
                                <span
                                  className={`text-lg font-extrabold ${
                                    taller.estadisticas.porcentaje_asistencia >= 85
                                      ? "text-emerald-400"
                                      : taller.estadisticas.porcentaje_asistencia >= 75
                                      ? "text-amber-400"
                                      : "text-rose-400"
                                  }`}
                                >
                                  {taller.estadisticas.porcentaje_asistencia}%
                                </span>
                              </div>

                              <button
                                onClick={() => toggleTallerExpand(expandKey)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all"
                              >
                                {isExpanded ? (
                                  <>
                                    <span>Ocultar Sesiones</span> <ChevronUp className="w-4 h-4 text-cyan-400" />
                                  </>
                                ) : (
                                  <>
                                    <span>Ver Sesiones ({taller.sesiones.length})</span> <ChevronDown className="w-4 h-4 text-cyan-400" />
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Acordeón Desplegable de Sesiones */}
                          {isExpanded && (
                            <div className="border-t border-slate-800 bg-slate-950/60 p-4 space-y-3">
                              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> Historial de Sesiones y Registro de Asistencia
                              </h4>

                              {taller.sesiones.length === 0 ? (
                                <p className="text-xs text-slate-500 py-2">No hay sesiones registradas aún para este taller.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/80">
                                        <th className="py-2.5 px-3">Fecha</th>
                                        <th className="py-2.5 px-3">Temática / Contenido</th>
                                        <th className="py-2.5 px-3">Estado de Asistencia</th>
                                        <th className="py-2.5 px-3">Observaciones</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                      {taller.sesiones.map((ses) => (
                                        <tr key={ses.sesion_id} className="hover:bg-slate-900/40">
                                          <td className="py-2.5 px-3 font-semibold text-slate-200 whitespace-nowrap">
                                            {ses.fecha}
                                          </td>
                                          <td className="py-2.5 px-3 text-slate-300">
                                            {ses.tematica}
                                          </td>
                                          <td className="py-2.5 px-3 whitespace-nowrap">
                                            {renderEstadoBadge(ses.estado)}
                                          </td>
                                          <td className="py-2.5 px-3 text-slate-400 italic">
                                            {ses.observaciones || "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

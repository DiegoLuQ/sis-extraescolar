"use client";

import { useState, useEffect } from "react";
import { authApi } from "@/lib/api";
import type { Permiso, Modulo, Accion } from "@/types/permisos";

export function usePermisos() {
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPermisos();
  }, []);

  const fetchPermisos = async () => {
    try {
      const data = await authApi.getMisPermisos();
      setPermisos(data);
    } catch (err: any) {
      console.error("Error fetching permisos:", err);
      setError(err.message);
      // Si hay error, permitir todo
      setPermisos([
        { modulo: 'usuarios', puede_crear: true, puede_leer: true, puede_editar: true, puede_eliminar: true },
        { modulo: 'alumnos', puede_crear: true, puede_leer: true, puede_editar: true, puede_eliminar: true },
        { modulo: 'talleres', puede_crear: true, puede_leer: true, puede_editar: true, puede_eliminar: true },
        { modulo: 'inscripciones', puede_crear: true, puede_leer: true, puede_editar: true, puede_eliminar: true },
        { modulo: 'sesiones', puede_crear: true, puede_leer: true, puede_editar: true, puede_eliminar: true },
        { modulo: 'asistencias', puede_crear: true, puede_leer: true, puede_editar: true, puede_eliminar: true },
        { modulo: 'roles', puede_crear: true, puede_leer: true, puede_editar: true, puede_eliminar: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const tienePermiso = (modulo: Modulo, accion: Accion): boolean => {
    if (loading) return true;
    
    const permiso = permisos.find(p => p.modulo === modulo);
    if (!permiso) return false;

    switch (accion) {
      case 'crear':
        return permiso.puede_crear;
      case 'leer':
        return permiso.puede_leer;
      case 'editar':
        return permiso.puede_editar;
      case 'eliminar':
        return permiso.puede_eliminar;
      default:
        return false;
    }
  };

  return {
    permisos,
    loading,
    error,
    tienePermiso,
    refetch: fetchPermisos,
  };
}

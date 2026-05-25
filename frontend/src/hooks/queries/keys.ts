/**
 * Claves de TanStack Query centralizadas.
 *
 * Permiten invalidación granular sin acoplar strings sueltos en cada hook:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.talleres.all })
 */
export const queryKeys = {
  talleres: {
    all: ["talleres"] as const,
    list: () => [...queryKeys.talleres.all, "list"] as const,
    detail: (id: string) => [...queryKeys.talleres.all, "detail", id] as const,
  },
  alumnos: {
    all: ["alumnos"] as const,
    list: () => [...queryKeys.alumnos.all, "list"] as const,
    detail: (id: string) => [...queryKeys.alumnos.all, "detail", id] as const,
  },
  usuarios: {
    all: ["usuarios"] as const,
    list: () => [...queryKeys.usuarios.all, "list"] as const,
    detail: (id: string) => [...queryKeys.usuarios.all, "detail", id] as const,
  },
  inscripciones: {
    all: ["inscripciones"] as const,
    list: (tallerId?: string) => [...queryKeys.inscripciones.all, "list", tallerId ?? "all"] as const,
    resumen: () => [...queryKeys.inscripciones.all, "resumen"] as const,
    statsByTaller: (tallerId: string) => [...queryKeys.inscripciones.all, "stats", tallerId] as const,
  },
  sesiones: {
    all: ["sesiones"] as const,
    list: (tallerId?: string) => [...queryKeys.sesiones.all, "list", tallerId ?? "all"] as const,
  },
  colegios: {
    all: ["colegios"] as const,
  },
  estadisticas: {
    ocupacion: ["estadisticas", "ocupacion"] as const,
    ausentismo: ["estadisticas", "ausentismo"] as const,
    alertas: (umbral: number) => ["estadisticas", "alertas", umbral] as const,
  },
};

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { alumnosApi } from "@/lib/api";
import type { AlumnoCreate, AlumnoUpdate } from "@/types";
import { queryKeys } from "./keys";

export function useAlumnos() {
  return useQuery({
    queryKey: queryKeys.alumnos.list(),
    queryFn: () => alumnosApi.getAll(),
  });
}

export function useCreateAlumno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AlumnoCreate) => alumnosApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alumnos.all });
      toast.success("Alumno creado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al crear alumno"),
  });
}

export function useUpdateAlumno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AlumnoUpdate }) =>
      alumnosApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alumnos.all });
      toast.success("Alumno actualizado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al actualizar alumno"),
  });
}

export function useDeleteAlumno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alumnosApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alumnos.all });
      toast.success("Alumno eliminado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al eliminar alumno"),
  });
}

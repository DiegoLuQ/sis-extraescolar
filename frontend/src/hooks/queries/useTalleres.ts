import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { talleresApi } from "@/lib/api";
import type { TallerCreate, TallerUpdate } from "@/types";
import { queryKeys } from "./keys";

export function useTalleres() {
  return useQuery({
    queryKey: queryKeys.talleres.list(),
    queryFn: () => talleresApi.getAll(),
  });
}

export function useTaller(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.talleres.detail(id ?? ""),
    queryFn: () => talleresApi.getById(id!),
    enabled: !!id,
  });
}

export function useCreateTaller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TallerCreate) => talleresApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.talleres.all });
      toast.success("Taller creado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al crear taller"),
  });
}

export function useUpdateTaller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TallerUpdate }) =>
      talleresApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.talleres.all });
      toast.success("Taller actualizado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al actualizar taller"),
  });
}

export function useDeleteTaller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => talleresApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.talleres.all });
      toast.success("Taller eliminado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al eliminar taller"),
  });
}

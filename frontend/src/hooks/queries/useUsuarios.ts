import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usuariosApi } from "@/lib/api";
import type { UsuarioCreate, UsuarioUpdate } from "@/types";
import { queryKeys } from "./keys";

export function useUsuarios() {
  return useQuery({
    queryKey: queryKeys.usuarios.list(),
    queryFn: () => usuariosApi.getAll(),
  });
}

export function useCreateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UsuarioCreate) => usuariosApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      toast.success("Usuario creado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al crear usuario"),
  });
}

export function useUpdateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UsuarioUpdate }) =>
      usuariosApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      toast.success("Usuario actualizado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al actualizar usuario"),
  });
}

export function useDeleteUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usuariosApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      toast.success("Usuario eliminado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al eliminar usuario"),
  });
}

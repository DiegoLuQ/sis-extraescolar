import type { FrecuenciaReporte } from "@/lib/api";

export const FRECUENCIA_LABEL: Record<FrecuenciaReporte, string> = {
  diario: "Diario (todos los días 9am)",
  semanal: "Semanal (lunes 9am)",
  mensual: "Mensual (día 1 de mes, 9am)",
};

"use client";

import { useParams } from "next/navigation";
import ReporteForm from "../ReporteForm";

export default function EditarReporteProgramadoPage() {
  const params = useParams();
  const id = params.id as string;
  return <ReporteForm reporteId={id} />;
}

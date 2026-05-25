import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { QueryProvider } from "@/lib/query-client";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sis-Extraescolar",
  description: "Sistema de Gestión de Actividades Extraescolares",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <QueryProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
          <ConfirmDialogHost />
        </QueryProvider>
      </body>
    </html>
  );
}

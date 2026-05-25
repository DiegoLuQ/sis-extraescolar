"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { School, Loader2 } from "lucide-react";
import { colegiosApi } from "@/lib/api";
import type { Colegio } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, isAuthenticated, isHydrated, clearError } = useAuthStore();
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [colegioId, setColegioId] = useState("");
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [loadingColegios, setLoadingColegios] = useState(true);

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isHydrated, isAuthenticated, router]);

  useEffect(() => {
    const fetchColegios = async () => {
      try {
        const data = await colegiosApi.getAll();
        setColegios(data);
      } catch (err) {
        console.error("Error cargando colegios:", err);
      } finally {
        setLoadingColegios(false);
      }
    };
    fetchColegios();
  }, []);

  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(nombre, password, colegioId || undefined);
      router.push("/dashboard");
    } catch {
      // Error ya manejado por el store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-calipso-500 via-calipso-600 to-calipso-700 p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30"></div>
      
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-calipso-100">
            <School className="h-8 w-8 text-calipso-600" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">Sis-Extraescolar</CardTitle>
            <CardDescription className="text-gray-500">
              Ingresa tus credenciales para acceder al sistema
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre de Usuario</Label>
              <Input
                id="nombre"
                type="text"
                placeholder="Nombre de usuario"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="colegio">Colegio (Opcional para Admin/Monitores)</Label>
              {loadingColegios ? (
                <div className="h-11 flex items-center justify-center bg-gray-50 rounded-md border">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              ) : (
                <select
                  id="colegio"
                  value={colegioId}
                  onChange={(e) => setColegioId(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Selección automática / Global</option>
                  {colegios.map((colegio) => (
                    <option key={colegio.id} value={colegio.id}>
                      {colegio.nombre_colegio}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 bg-calipso-500 hover:bg-calipso-600 font-bold"
              disabled={isLoading || loadingColegios}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>

            <div className="pt-4 text-center border-t border-gray-100 mt-6">
              <p className="text-xs text-gray-400 font-medium tracking-wide">
                {"Sistema creado por "}
                <span className="font-bold text-gray-600">
                  {"TIC's e Innovación Tecnológica"}
                </span>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

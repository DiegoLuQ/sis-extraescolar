"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Calendar,
  User,
  LogOut,
  School,
  Settings,
  X,
  AlertTriangle,
  BarChart3,
  Mail,
  Clock,
  CalendarClock,
  KeyRound,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { usePermisos } from "@/hooks/usePermisos";
import { authApi, usuariosApi } from "@/lib/api";
import { useEffect, useState } from "react";
import type { Colegio } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const navigationAdmin = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, modulo: "dashboard" },
  { name: "Colegios", href: "/dashboard/colegios", icon: School, modulo: "colegios" },
  { name: "Usuarios", href: "/dashboard/usuarios", icon: Users, modulo: "usuarios" },
  { name: "Alumnos", href: "/dashboard/alumnos", icon: GraduationCap, modulo: "alumnos" },
  { name: "Talleres", href: "/dashboard/talleres", icon: BookOpen, modulo: "talleres" },
  { name: "Inscripciones", href: "/dashboard/inscripciones", icon: ClipboardList, modulo: "inscripciones" },
  { name: "Sesiones", href: "/dashboard/sesiones", icon: Calendar, modulo: "sesiones" },
  { name: "Horario", href: "/dashboard/horario", icon: Clock, modulo: "horario" },
  { name: "Alta Inasistencia", href: "/dashboard/alta-inasistencia", icon: AlertTriangle, modulo: "alertas" },
  { name: "Alertas", href: "/dashboard/alertas", icon: AlertTriangle, modulo: "alertas" },
  { name: "Reportes", href: "/dashboard/reportes", icon: BarChart3, modulo: "reportes" },
  { name: "Correos", href: "/dashboard/correos", icon: Mail, modulo: "correos" },
  { name: "Reportes Programados", href: "/dashboard/reportes-programados", icon: CalendarClock, modulo: "reportes_programados" },
  { name: "Roles y Permisos", href: "/dashboard/roles", icon: Settings, modulo: "roles" },
];

const navigationCoordinador = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, modulo: "dashboard" },
  { name: "Usuarios", href: "/dashboard/usuarios", icon: Users, modulo: "usuarios" },
  { name: "Alumnos", href: "/dashboard/alumnos", icon: GraduationCap, modulo: "alumnos" },
  { name: "Talleres", href: "/dashboard/talleres", icon: BookOpen, modulo: "talleres" },
  { name: "Inscripciones", href: "/dashboard/inscripciones", icon: ClipboardList, modulo: "inscripciones" },
  { name: "Sesiones", href: "/dashboard/sesiones", icon: Calendar, modulo: "sesiones" },
  { name: "Horario", href: "/dashboard/horario", icon: Clock, modulo: "horario" },
  { name: "Alta Inasistencia", href: "/dashboard/alta-inasistencia", icon: AlertTriangle, modulo: "alertas" },
  { name: "Alertas", href: "/dashboard/alertas", icon: AlertTriangle, modulo: "alertas" },
  { name: "Reportes", href: "/dashboard/reportes", icon: BarChart3, modulo: "reportes" },
];

const navigationMonitor = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, modulo: "dashboard" },
  { name: "Alumnos", href: "/dashboard/alumnos", icon: GraduationCap, modulo: "alumnos" },
  { name: "Talleres", href: "/dashboard/talleres", icon: BookOpen, modulo: "talleres" },
  { name: "Inscripciones", href: "/dashboard/inscripciones", icon: ClipboardList, modulo: "inscripciones" },
  { name: "Sesiones", href: "/dashboard/sesiones", icon: Calendar, modulo: "sesiones" },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout, setColegio } = useAuthStore();
  const { permisos, loading } = usePermisos();
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [loadingColegios, setLoadingColegios] = useState(true);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const fetchColegios = async () => {
      try {
        const data = await authApi.getMisColegios();
        setColegios(data);
      } catch (error) {
        console.error("Error fetching colegios:", error);
      } finally {
        setLoadingColegios(false);
      }
    };
    if (user) fetchColegios();
  }, [user]);

  const getNavigation = () => {
    if (!user) return [];
    switch (user.rol) {
      case "admin":
        return navigationAdmin;
      case "coordinador":
        return navigationCoordinador;
      case "monitor":
        return navigationMonitor;
      default:
        return navigationMonitor;
    }
  };

  const navigation = getNavigation();

  const puedeVer = (modulo: string) => {
    if (modulo === "dashboard") return true;
    if (modulo === "correos") return user?.rol === "admin";
    if (modulo === "reportes_programados") return user?.rol === "admin";
    if (modulo === "horario") return user?.rol === "admin" || user?.rol === "coordinador";
    if (loading || !permisos) return true;
    const permiso = permisos.find(p => p.modulo === modulo);
    return permiso?.puede_leer ?? true;
  };

  const filteredNavigation = navigation.filter(item => puedeVer(item.modulo));

  const closePasswordDialog = () => {
    setIsPasswordDialogOpen(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setChangingPassword(true);
    try {
      await usuariosApi.cambiarMiPassword(newPassword);
      toast.success("Contraseña actualizada exitosamente");
      closePasswordDialog();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al cambiar la contraseña");
    } finally {
      setChangingPassword(false);
    }
  };

  const activeSchoolId = typeof window !== "undefined" ? localStorage.getItem("colegio_id") : null;
  const activeColegio = colegios.find((c) => c.id === activeSchoolId);

  return (
    <div className="flex h-screen w-64 flex-col bg-calipso-900">
      <div className="flex h-16 items-center justify-between px-6 border-b border-calipso-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {activeColegio?.logo_url ? (
            <img src={activeColegio.logo_url} alt="Logo" className="h-8 w-8 object-contain rounded-md bg-white p-0.5" />
          ) : (
            <School className="h-8 w-8 text-white" />
          )}
          <span className="text-lg font-bold text-white truncate">
            {activeColegio ? activeColegio.nombre_colegio : "Sis-Extraescolar"}
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-calipso-300 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Selector de Colegio */}
      <div className="px-4 py-4 border-b border-calipso-800">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-calipso-300 uppercase tracking-wider px-2">
            Colegio Activo
          </label>
          <select
            value={localStorage.getItem("colegio_id") || ""}
            onChange={(e) => {
              const id = e.target.value;
              const nombre = e.target.options[e.target.selectedIndex].text;
              setColegio(id || null, nombre);
              window.location.reload(); // Recargar para limpiar estados de tablas
            }}
            className="w-full bg-calipso-800 text-white text-xs rounded-md border-none focus:ring-1 focus:ring-calipso-400 py-2 px-2"
          >
            {user?.rol === "admin" && (
              <option value="">Vista Global</option>
            )}
            {colegios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_colegio}
              </option>
            ))}
            {colegios.length === 0 && !loadingColegios && (
              <option disabled>Sin colegios asignados</option>
            )}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-calipso-700 text-white"
                    : "text-calipso-100 hover:bg-calipso-800 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-calipso-800 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-calipso-700">
            <User className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.nombre_2 || user?.nombre}
            </p>
            <p className="text-xs text-calipso-200 capitalize">
              {user?.rol}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsPasswordDialogOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-calipso-100 hover:bg-calipso-800 hover:text-white transition-colors"
        >
          <KeyRound className="h-5 w-5" />
          Cambiar Contraseña
        </button>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-calipso-100 hover:bg-calipso-800 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Cerrar sesión
        </button>
      </div>

      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={(open) => {
          if (open) setIsPasswordDialogOpen(true);
          else closePasswordDialog();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-calipso-500" />
              Cambiar Contraseña
            </DialogTitle>
            <DialogDescription>
              Define tu nueva contraseña de acceso al sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                Nueva Contraseña
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="focus-visible:ring-calipso-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                Confirmar Contraseña
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la nueva contraseña"
                className="focus-visible:ring-calipso-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleChangePassword();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePasswordDialog} disabled={changingPassword}>
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} className="bg-calipso-500 hover:bg-calipso-600" disabled={changingPassword}>
              {changingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

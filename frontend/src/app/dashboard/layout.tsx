"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Sidebar } from "@/components/Sidebar";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isHydrated } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f0f7ff]">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-calipso-500 border-t-transparent"></div>
          <div className="text-gray-500 text-sm">Cargando sesión...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // El useEffect manejará la redirección
  }

  return (
    <div className="flex h-screen bg-[#f0f7ff] overflow-hidden">
      {/* Sidebar Desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar Mobile */}
      <div className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="fixed inset-0 bg-black/50" onClick={() => setIsSidebarOpen(false)}></div>
        <div className={`fixed inset-y-0 left-0 w-64 bg-calipso-900 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <Sidebar onClose={() => setIsSidebarOpen(false)} />
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header Mobile */}
        <header className="flex lg:hidden h-16 items-center justify-between border-b bg-white px-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 ml-1">Sis-Extraescolar</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto focus:outline-none">
          <div className="container mx-auto p-4 md:p-8 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

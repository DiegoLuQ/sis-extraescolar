import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { authApi } from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
  setColegio: (colegioId: string | null, nombreColegio?: string) => void;
  login: (nombre: string, password: string, clientId?: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,
      error: null,

      setColegio: (colegioId: string | null, nombreColegio?: string) => {
        if (typeof window !== 'undefined') {
          if (colegioId) {
            localStorage.setItem('colegio_id', colegioId);
          } else {
            localStorage.removeItem('colegio_id');
          }
        }
        
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: {
              ...currentUser,
              nombre_colegio: nombreColegio || (colegioId ? currentUser.nombre_colegio : '')
            }
          });
        }
      },

      login: async (nombre: string, password: string, clientId?: string) => {
        set({ isLoading: true, error: null });
        try {
          const tokenResponse = await authApi.login(nombre, password, clientId);
          const token = tokenResponse.access_token;

          const payload = JSON.parse(atob(token.split('.')[1]));
          const user: User = {
            id: payload.usuario_id,
            nombre: payload.sub,
            nombre_2: payload.nombre_2 || '',
            nombre_colegio: payload.nombre_colegio || '',
            rol: payload.rol as 'admin' | 'monitor' | 'coordinador',
          };

          localStorage.setItem('token', token);
          if (clientId) {
            localStorage.setItem('colegio_id', clientId);
          } else if (payload.colegio_id) {
            localStorage.setItem('colegio_id', payload.colegio_id);
          } else {
            localStorage.removeItem('colegio_id');
          }
          
          set({ 
            user, 
            token, 
            isAuthenticated: true, 
            isLoading: false 
          });
        } catch (error: any) {
          const message = error.response?.data?.detail || 'Error al iniciar sesión';
          set({ 
            error: message, 
            isLoading: false 
          });
          throw error;
        }
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('colegio_id');
          localStorage.removeItem('auth-storage'); // Opcional, pero asegura limpieza total
        }
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false 
        });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated 
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;
        }
      },
    }
  )
);

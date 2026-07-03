import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import type {
  Token,
  Usuario, UsuarioCreate, UsuarioUpdate,
  Alumno, AlumnoCreate, AlumnoUpdate,
  Taller, TallerCreate, TallerUpdate,
  Inscripcion, InscripcionCreate, InscripcionUpdate,
  Sesion, SesionCreate,
  Asistencia, AsistenciaCreate,
  NotaComportamiento, NotaComportamientoCreate,
  TallerOcupacion, AusentismoTaller, AlertaInasistencia, AlumnoAsistenciaDetalle,
  Colegio, ColegioCreate, ColegioUpdate,
  MetasReport
} from '@/types';
import type { Permiso } from '@/types/permisos';

export type { Permiso };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    const colegioId = localStorage.getItem('colegio_id');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (colegioId && config.headers) {
      config.headers['X-Colegio-ID'] = colegioId;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    const status = error.response?.status;
    const isLogin = error.config?.url?.includes('/api/auth/login');

    if (status === 401) {
      if (typeof window !== 'undefined' && !isLogin) {
        // Limpiamos todo para evitar el bucle de redirección
        localStorage.removeItem('token');
        localStorage.removeItem('colegio_id');
        localStorage.removeItem('auth-storage');
        
        toast.error('Sesión expirada. Vuelve a iniciar sesión.');
        window.location.href = '/login';
      }
    } else if (status === 403) {
      toast.error('No tienes permisos para realizar esta acción.');
    } else if (status && status >= 500) {
      toast.error('Error del servidor. Intenta nuevamente en unos minutos.');
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (username: string, password: string, clientId?: string): Promise<Token> => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    if (clientId) {
      params.append('client_id', clientId);
    }
    const response = await api.post<Token>('/api/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  },
  getMisPermisos: async (): Promise<Permiso[]> => {
    const response = await api.get<Permiso[]>('/api/auth/mis-permisos');
    return response.data;
  },
  getMisColegios: async (): Promise<Colegio[]> => {
    const response = await api.get<Colegio[]>('/api/auth/me/colegios');
    return response.data;
  },
};

export const usuariosApi = {
  getAll: async (skip = 0, limit = 100, role_filter?: string, only_with_talleres?: boolean): Promise<Usuario[]> => {
    const response = await api.get<Usuario[]>('/api/usuarios', { 
      params: { skip, limit, role_filter, only_with_talleres } 
    });
    return response.data;
  },
  getById: async (id: string): Promise<Usuario> => {
    const response = await api.get<Usuario>(`/api/usuarios/${id}`);
    return response.data;
  },
  create: async (data: UsuarioCreate): Promise<Usuario> => {
    const response = await api.post<Usuario>('/api/usuarios', data);
    return response.data;
  },
  update: async (id: string, data: UsuarioUpdate): Promise<Usuario> => {
    const response = await api.patch<Usuario>(`/api/usuarios/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/usuarios/${id}`);
  },
  cambiarMiPassword: async (password: string): Promise<void> => {
    await api.patch('/api/usuarios/me/password', { password });
  },
  downloadTemplate: async (): Promise<Blob> => {
    const response = await api.get('/api/usuarios/template', { responseType: 'blob' });
    return response.data;
  },
  exportUsuarios: async (): Promise<Blob> => {
    const response = await api.get('/api/usuarios/export', { responseType: 'blob' });
    return response.data;
  },
  bulkUpload: async (file: File, targetColegioId?: string): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const url = targetColegioId
      ? `/api/usuarios/bulk-upload?target_colegio_id=${targetColegioId}`
      : '/api/usuarios/bulk-upload';
    const response = await api.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  getImpactoEliminacion: async (ids: string[]): Promise<{
    usuarios: { id: string; nombre: string; nombre_2: string | null }[];
    talleres: number;
    sesiones: number;
    inscripciones: number;
    asistencias: number;
    notas: number;
    tiene_dependencias: boolean;
  }> => {
    const response = await api.post('/api/usuarios/impacto-eliminacion', { ids });
    return response.data;
  },
  bulkDelete: async (ids: string[], permanente = false): Promise<{ detail: string; permanente: boolean; resultado: any }> => {
    const response = await api.post('/api/usuarios/bulk-delete', { ids, permanente });
    return response.data;
  },
};

export const alumnosApi = {
  getAll: async (skip = 0, limit = 5000, tallerId?: string, forEnrollment?: boolean): Promise<Alumno[]> => {
    const response = await api.get<Alumno[]>('/api/alumnos', {
      params: { skip, limit, taller_id: tallerId, for_enrollment: forEnrollment || undefined }
    });
    return response.data;
  },
  getById: async (id: string): Promise<Alumno> => {
    const response = await api.get<Alumno>(`/api/alumnos/${id}`);
    return response.data;
  },
  create: async (data: AlumnoCreate): Promise<Alumno> => {
    const response = await api.post<Alumno>('/api/alumnos', data);
    return response.data;
  },
  update: async (id: string, data: AlumnoUpdate): Promise<Alumno> => {
    const response = await api.patch<Alumno>(`/api/alumnos/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/alumnos/${id}`);
  },
  downloadTemplate: async (): Promise<Blob> => {
    const response = await api.get('/api/alumnos/template', {
      responseType: 'blob',
    });
    return response.data;
  },
  exportAlumnos: async (): Promise<Blob> => {
    const response = await api.get('/api/alumnos/export', {
      responseType: 'blob',
    });
    return response.data;
  },
  bulkUpload: async (file: File, targetColegioId?: string): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const url = targetColegioId 
      ? `/api/alumnos/bulk-upload?target_colegio_id=${targetColegioId}` 
      : '/api/alumnos/bulk-upload';
    const response = await api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  getStats: async (): Promise<{ inscritos: number; retirados: number; total: number }> => {
    const response = await api.get('/api/alumnos/stats');
    return response.data;
  },
  syncExternal: async (): Promise<any> => {
    const response = await api.post('/api/alumnos/sync-external');
    return response.data;
  },
};

export const talleresApi = {
  getAll: async (skip = 0, limit = 100): Promise<Taller[]> => {
    const response = await api.get<Taller[]>('/api/talleres', { params: { skip, limit } });
    return response.data;
  },
  getById: async (id: string): Promise<Taller> => {
    const response = await api.get<Taller>(`/api/talleres/${id}`);
    return response.data;
  },
  create: async (data: TallerCreate): Promise<Taller> => {
    const response = await api.post<Taller>('/api/talleres', data);
    return response.data;
  },
  update: async (id: string, data: TallerUpdate): Promise<Taller> => {
    const response = await api.patch<Taller>(`/api/talleres/${id}`, data);
    return response.data;
  },
  delete: (id: string) => api.delete(`/api/talleres/${id}`),
  bulkUpload: (file: File, target_colegio_id?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    const url = target_colegio_id 
      ? `/api/talleres/bulk-upload?target_colegio_id=${target_colegio_id}`
      : '/api/talleres/bulk-upload';
    return api.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getTemplate: () => api.get('/api/talleres/template', { responseType: 'blob' }),
  getTalleresOtrosColegios: async (): Promise<Taller[]> => {
    const response = await api.get<Taller[]>('/api/talleres/otros-colegios');
    return response.data;
  },
  clonarPeriodo: (data: { source_periodo: number, target_periodo: number, taller_ids: string[] }) => 
    api.post('/api/talleres/clonar-periodo', data),
};

export const inscripcionesApi = {
  getAll: async (tallerId?: string): Promise<Inscripcion[]> => {
    const response = await api.get<Inscripcion[]>('/api/inscripciones', { 
      params: tallerId ? { taller_id: tallerId } : {} 
    });
    return response.data;
  },
  create: async (data: InscripcionCreate): Promise<Inscripcion> => {
    const response = await api.post<Inscripcion>('/api/inscripciones', data);
    return response.data;
  },
  update: async (id: string, data: InscripcionUpdate): Promise<Inscripcion> => {
    const response = await api.patch<Inscripcion>(`/api/inscripciones/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/inscripciones/${id}`);
  },
  getResumen: () => api.get<any[]>('/api/inscripciones/resumen'),
  vaciarTaller: (tallerId: string) => api.delete<{ deleted: number }>(`/api/inscripciones/taller/${tallerId}/vaciar`),
  getStatsByTaller: (tallerId: string) => api.get<any[]>(`/api/inscripciones/taller/${tallerId}/stats`),
  exportByTaller: (tallerId: string) => api.get(`/api/inscripciones/taller/${tallerId}/export`, { responseType: 'blob' }),
  bulkUpload: (tallerId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/api/inscripciones/bulk-upload/${tallerId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getTemplate: () => api.get('/api/inscripciones/template', { responseType: 'blob' }),
};

export const sesionesApi = {
  getAll: async (tallerId?: string): Promise<Sesion[]> => {
    const response = await api.get<Sesion[]>('/api/sesiones', { 
      params: tallerId ? { taller_id: tallerId } : {} 
    });
    return response.data;
  },
  getById: async (id: string): Promise<Sesion> => {
    const response = await api.get<Sesion>(`/api/sesiones/${id}`);
    return response.data;
  },
  create: async (data: SesionCreate): Promise<Sesion> => {
    const response = await api.post<Sesion>('/api/sesiones', data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/sesiones/${id}`);
  },
  getAbsentFromSchool: async (id: string): Promise<any[]> => {
    const response = await api.get<any[]>(`/api/sesiones/${id}/absent-from-school`);
    return response.data;
  },
  toggleCierre: async (id: string, bloqueada: boolean): Promise<any> => {
    const response = await api.post(`/api/sesiones/${id}/cerrar`, { bloqueada });
    return response.data;
  },
  cierreGlobal: async (fecha: string): Promise<any> => {
    const response = await api.post('/api/sesiones/cierre-global', { fecha });
    return response.data;
  },
  notificarInconsistencia: async (sesionId: string, alumnoId: string): Promise<any> => {
    const response = await api.post(`/api/sesiones/${sesionId}/notificar-inconsistencia`, { alumno_id: alumnoId });
    return response.data;
  },
};

export const asistenciaApi = {
  getBySesion: async (sesionId: string): Promise<Asistencia[]> => {
    const response = await api.get<Asistencia[]>(`/api/asistencias/${sesionId}`);
    return response.data;
  },
  bulk: async (data: AsistenciaCreate): Promise<Asistencia[]> => {
    const response = await api.post<Asistencia[]>('/api/asistencias/bulk', data);
    return response.data;
  },
  getAlertasHistorial: async (): Promise<any[]> => {
    const response = await api.get<any[]>('/api/asistencias/historial/alertas');
    return response.data;
  },
  getNotasComportamiento: async (sesionId: string): Promise<NotaComportamiento[]> => {
    const response = await api.get<NotaComportamiento[]>(`/api/asistencias/comportamiento/${sesionId}`);
    return response.data;
  },
  createNotaComportamiento: async (data: NotaComportamientoCreate): Promise<NotaComportamiento> => {
    const response = await api.post<NotaComportamiento>('/api/asistencias/comportamiento', data);
    return response.data;
  },
  deleteNotaComportamiento: async (notaId: string): Promise<void> => {
    await api.delete(`/api/asistencias/comportamiento/${notaId}`);
  },
};

export const colegiosApi = {
  getAll: async (): Promise<Colegio[]> => {
    const response = await api.get<Colegio[]>('/api/colegios');
    return response.data;
  },
  getUsuariosCount: async (): Promise<Record<string, number>> => {
    const response = await api.get<Record<string, number>>('/api/colegios/usuarios-count');
    return response.data;
  },
  getById: async (id: string): Promise<Colegio> => {
    const response = await api.get<Colegio>(`/api/colegios/${id}`);
    return response.data;
  },
  create: async (data: ColegioCreate): Promise<Colegio> => {
    const response = await api.post<Colegio>('/api/colegios', data);
    return response.data;
  },
  update: async (id: string, data: ColegioUpdate): Promise<Colegio> => {
    const response = await api.patch<Colegio>(`/api/colegios/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/colegios/${id}`);
  },
};

export interface Rol {
  id: string;
  nombre: string;
  descripcion: string;
  is_active: boolean;
}

export interface RolCreate {
  nombre: string;
  descripcion?: string;
}

export const rolesApi = {
  getAll: async (): Promise<Rol[]> => {
    const response = await api.get<Rol[]>('/api/roles');
    return response.data;
  },
  getById: async (id: string): Promise<Rol> => {
    const response = await api.get<Rol>(`/api/roles/${id}`);
    return response.data;
  },
  create: async (data: RolCreate): Promise<Rol> => {
    const response = await api.post<Rol>('/api/roles', data);
    return response.data;
  },
  update: async (id: string, data: Partial<RolCreate>): Promise<Rol> => {
    const response = await api.patch<Rol>(`/api/roles/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/roles/${id}`);
  },
  getPermisos: async (rolId: string): Promise<Permiso[]> => {
    const response = await api.get<Permiso[]>(`/api/roles/${rolId}/permisos`);
    return response.data;
  },
  updatePermisos: async (rolId: string, permisos: Permiso[]): Promise<Permiso[]> => {
    const response = await api.put<Permiso[]>(`/api/roles/${rolId}/permisos`, { permisos });
    return response.data;
  },
};

export const estadisticasApi = {
  ocupacion: async (): Promise<TallerOcupacion[]> => {
    const response = await api.get<TallerOcupacion[]>('/api/estadisticas/ocupacion');
    return response.data;
  },
  ausentismo: async (): Promise<AusentismoTaller[]> => {
    const response = await api.get<AusentismoTaller[]>('/api/estadisticas/ausentismo');
    return response.data;
  },
  alertasInasistencias: async (): Promise<AlertaInasistencia[]> => {
    const response = await api.get<AlertaInasistencia[]>('/api/estadisticas/alertas-inasistencias');
    return response.data;
  },
  detalleAsistencia: async (alumnoId: string): Promise<AlumnoAsistenciaDetalle> => {
    const response = await api.get<AlumnoAsistenciaDetalle>(`/api/estadisticas/detalle-asistencia/${alumnoId}`);
    return response.data;
  },
};

export const reportesApi = {
  getAsistenciaMensual: async (mes: number, anio: number) => {
    const response = await api.get('/api/reportes/asistencia-mensual', { params: { mes, anio } });
    return response.data;
  },
  getAsistenciaSemanal: async (mes: number, anio: number) => {
    const response = await api.get('/api/reportes/asistencia-semanal', { params: { mes, anio } });
    return response.data;
  },
  getAsistenciaAnual: async (anio: number) => {
    const response = await api.get('/api/reportes/asistencia-anual', { params: { anio } });
    return response.data;
  },
  getResumenSemana: async (semanasAtras: number = 0) => {
    const response = await api.get('/api/reportes/resumen-semana', { params: { semanas_atras: semanasAtras } });
    return response.data;
  },
  getMetas: async (mes: number, anio: number): Promise<MetasReport> => {
    const response = await api.get('/api/reportes/metas', { params: { mes, anio } });
    return response.data;
  },
};

export interface CorreoReporte {
  id: string;
  colegio_id: string;
  email: string;
  estado: boolean;
}

export const correosApi = {
  getAll: async (): Promise<CorreoReporte[]> => {
    const response = await api.get<CorreoReporte[]>('/api/correos');
    return response.data;
  },
  create: async (data: { email: string; estado?: boolean; colegio_id?: string }): Promise<CorreoReporte> => {
    const response = await api.post<CorreoReporte>('/api/correos', data);
    return response.data;
  },
  toggle: async (id: string, estado: boolean): Promise<CorreoReporte> => {
    const response = await api.patch<CorreoReporte>(`/api/correos/${id}/toggle`, { estado });
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/correos/${id}`);
  },
  enviarPrueba: async (id: string): Promise<{ status: string; sent: boolean }> => {
    const response = await api.post(`/api/correos/${id}/enviar-prueba`);
    return response.data;
  },
};

export type FrecuenciaReporte = "diario" | "semanal" | "mensual";

export interface ReporteProgramado {
  id: string;
  colegio_id: string;
  nombre: string | null;
  frecuencia: FrecuenciaReporte;
  destinatarios: string[];
  activo: boolean;
  ultima_ejecucion: string | null;
  ultimo_estado: string | null;
  creado_at: string | null;
}

export const reportesProgramadosApi = {
  getAll: async (): Promise<ReporteProgramado[]> => {
    const response = await api.get<ReporteProgramado[]>('/api/reportes-programados');
    return response.data;
  },
  getById: async (id: string): Promise<ReporteProgramado> => {
    const response = await api.get<ReporteProgramado>(`/api/reportes-programados/${id}`);
    return response.data;
  },
  preview: async (colegioId: string, frecuencia: FrecuenciaReporte): Promise<{ html: string; etiqueta_periodo: string }> => {
    const response = await api.get('/api/reportes-programados/preview', {
      params: { colegio_id: colegioId, frecuencia },
    });
    return response.data;
  },
  create: async (data: { nombre?: string; frecuencia: FrecuenciaReporte; destinatarios: string[]; colegio_id?: string }): Promise<ReporteProgramado> => {
    const response = await api.post<ReporteProgramado>('/api/reportes-programados', data);
    return response.data;
  },
  update: async (id: string, data: { nombre?: string; frecuencia?: FrecuenciaReporte; destinatarios?: string[]; colegio_id?: string }): Promise<ReporteProgramado> => {
    const response = await api.put<ReporteProgramado>(`/api/reportes-programados/${id}`, data);
    return response.data;
  },
  toggle: async (id: string, activo: boolean): Promise<ReporteProgramado> => {
    const response = await api.patch<ReporteProgramado>(`/api/reportes-programados/${id}/toggle`, { activo });
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/reportes-programados/${id}`);
  },
  enviarAhora: async (id: string): Promise<{ status: string; sent: boolean; recipients?: number }> => {
    const response = await api.post(`/api/reportes-programados/${id}/enviar`);
    return response.data;
  },
};

export default api;

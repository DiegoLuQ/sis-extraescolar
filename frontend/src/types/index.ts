export type UUID = string;

export interface Usuario {
  id: UUID;
  nombre: string;
  nombre_2: string | null;
  email: string | null;
  colegio_id: UUID;
  rol: 'admin' | 'monitor' | 'coordinador';
  is_active: boolean;
}

export interface UsuarioCreate {
  nombre: string;
  nombre_2?: string;
  email?: string;
  password: string;
  rol: 'admin' | 'monitor' | 'coordinador';
  colegio_id?: UUID;
}

export interface UsuarioUpdate {
  nombre?: string;
  nombre_2?: string;
  email?: string;
  password?: string;
  rol?: 'admin' | 'monitor' | 'coordinador';
  is_active?: boolean;
  colegio_id?: UUID;
}

export interface Alumno {
  id: UUID;
  rut: string;
  nombre_completo: string;
  curso: string;
  colegio_id: UUID;
  is_active: boolean;
}

export interface AlumnoCreate {
  rut: string;
  nombre_completo: string;
  curso: string;
}

export interface AlumnoUpdate {
  rut?: string;
  nombre_completo?: string;
  curso?: string;
  is_active?: boolean;
}

export interface TallerHorario {
  id?: string;
  dia: string;
  hora_inicio?: string;
  hora_fin?: string;
}

export interface Taller {
  id: UUID;
  nombre_taller: string;
  profesor_id: UUID;
  nombre_profesor?: string;
  cupos_maximos: number;
  dia: string;
  hora_inicio?: string;
  hora_fin?: string;
  colegio_id: UUID;
  nombre_colegio: string;
  alumnos_inscritos: number;
  is_active: boolean;
  periodo: number;
  cursos_asignados?: string;
  horarios?: TallerHorario[];
}

export interface TallerCreate {
  nombre_taller: string;
  profesor_id: UUID;
  cupos_maximos: number;
  dia?: string;
  hora_inicio?: string;
  hora_fin?: string;
  periodo: number;
  cursos_asignados?: string;
  colegio_id?: UUID;
  horarios?: TallerHorario[];
}

export interface TallerUpdate {
  nombre_taller?: string;
  profesor_id?: UUID;
  cupos_maximos?: number;
  dia?: string;
  hora_inicio?: string;
  hora_fin?: string;
  periodo?: number;
  cursos_asignados?: string;
  is_active?: boolean;
  colegio_id?: UUID;
  horarios?: TallerHorario[];
}

export interface Inscripcion {
  id: UUID;
  taller_id: UUID;
  alumno_id: UUID;
  estado: 'inscrito' | 'retirado';
  colegio_id: UUID;
}

export interface InscripcionCreate {
  taller_id: UUID;
  alumno_id: UUID;
}

export interface InscripcionUpdate {
  estado?: 'inscrito' | 'retirado';
}

export interface Sesion {
  id: UUID;
  taller_id: UUID;
  fecha_sesion: string;
  tematica?: string;
  colegio_id: UUID;
  creado_por: UUID;
  total_presentes?: number;
  total_ausentes?: number;
  total_inscritos?: number;
  cupos_disponibles?: number;
  nombre_taller?: string;
  bloqueada?: boolean;
}

export interface SesionCreate {
  taller_id: UUID;
  fecha_sesion: string;
  tematica?: string;
}

export interface Asistencia {
  id: UUID;
  sesion_id: UUID;
  alumno_id: UUID;
  estado_asistencia: 'presente' | 'ausente' | 'justificado' | 'atraso';
  observaciones?: string;
  colegio_id: UUID;
}

export interface AsistenciaCreate {
  sesion_id: UUID;
  lista: {
    alumno_id: UUID;
    estado_asistencia: 'presente' | 'ausente' | 'justificado' | 'atraso';
    observaciones?: string;
  }[];
}

export interface Colegio {
  id: UUID;
  nombre_colegio: string;
  rut_sostenedor: string;
  is_active: boolean;
}

export interface ColegioCreate {
  nombre_colegio: string;
  rut_sostenedor: string;
}

export interface ColegioUpdate {
  nombre_colegio?: string;
  rut_sostenedor?: string;
  is_active?: boolean;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  usuario_id: string;
  nombre: string;
  nombre_colegio: string;
  rol: string;
}

export interface TallerOcupacion {
  taller_id: UUID;
  nombre_taller: string;
  cupos_maximos: number;
  inscripciones_activas: number;
  porcentaje_ocupacion: number;
}

export interface AusentismoTaller {
  taller_id: UUID;
  nombre_taller: string;
  total_sesiones: number;
  total_asistencias: number;
  total_ausencias: number;
  porcentaje_ausentismo: number;
}

export interface AlertaInasistencia {
  alumno_id: UUID;
  rut: string;
  nombre_completo: string;
  taller: string;
  inasistencias_consecutivas: number;
}

export interface User {
  id: string;
  nombre: string;
  nombre_2: string;
  nombre_colegio: string;
  rol: 'admin' | 'monitor' | 'coordinador';
}

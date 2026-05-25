export type Modulo = 'usuarios' | 'alumnos' | 'talleres' | 'inscripciones' | 'sesiones' | 'asistencias' | 'colegios' | 'roles' | 'dashboard';
export type Accion = 'crear' | 'leer' | 'editar' | 'eliminar';

export interface Permiso {
  modulo: Modulo;
  puede_crear: boolean;
  puede_leer: boolean;
  puede_editar: boolean;
  puede_eliminar: boolean;
}

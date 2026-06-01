from sqlalchemy.orm import Session
from sqlalchemy import func, extract, distinct
from modules.talleres.models import Taller
from modules.sesiones.models import Sesion
from modules.asistencias.models import Asistencia
from modules.inscripciones.models import Inscripcion, EstadoInscripcionEnum
from typing import List, Dict
import datetime

def get_monthly_attendance_report(db: Session, colegio_id: str, mes: int, anio: int):
    # 1. Obtener todos los talleres del colegio y periodo
    talleres = db.query(Taller).filter(
        Taller.colegio_id == colegio_id,
        Taller.periodo == anio,
        Taller.is_active == True
    ).all()
    
    if not talleres:
        return {
            "active_days": [],
            "workshops": [],
            "daily_stats": {},
            "total_enrollment": 0
        }
        
    taller_ids = [t.id for t in talleres]
    
    # 2. Obtener sesiones del mes (excluyendo fines de semana)
    sesiones = db.query(Sesion).filter(
        Sesion.taller_id.in_(taller_ids),
        extract('month', Sesion.fecha_sesion) == mes,
        extract('year', Sesion.fecha_sesion) == anio,
        func.dayofweek(Sesion.fecha_sesion).notin_([1, 7])
    ).all()
    
    # 3. Obtener matrícula por taller
    enrollment_query = db.query(Inscripcion.taller_id, func.count(Inscripcion.id).label("count")).filter(
        Inscripcion.taller_id.in_(taller_ids),
        Inscripcion.estado == EstadoInscripcionEnum.inscrito
    ).group_by(Inscripcion.taller_id).all()
    enrollment_map = {str(r.taller_id): r.count for r in enrollment_query}
    total_enrollment = sum(enrollment_map.values())
    
    # 4. Obtener datos de asistencia por sesión
    asistencias_raw = db.query(
        Asistencia.sesion_id,
        func.count(Asistencia.id).label("presentes")
    ).filter(
        Asistencia.sesion_id.in_([s.id for s in sesiones]),
        Asistencia.estado_asistencia == "presente"
    ).group_by(Asistencia.sesion_id).all()
    asistencias_map = {str(r.sesion_id): r.presentes for r in asistencias_raw}
    
    # 5. Organizar datos para la matriz
    active_days = sorted(list(set([s.fecha_sesion.strftime("%Y-%m-%d") for s in sesiones])))
    workshops_report = []
    
    for t in talleres:
        matriculados_taller = enrollment_map.get(str(t.id), 0)
        taller_asistencias = {}
        total_taller = 0
        for day in active_days:
            sesion_hoy = next((s for s in sesiones if str(s.taller_id) == str(t.id) and s.fecha_sesion.strftime("%Y-%m-%d") == day), None)
            if sesion_hoy:
                count = asistencias_map.get(str(sesion_hoy.id), 0)
                taller_asistencias[day] = count
                total_taller += count
            else:
                taller_asistencias[day] = None
        
        workshops_report.append({
            "id": t.id,
            "nombre_taller": t.nombre_taller,
            "matriculados": matriculados_taller,
            "asistencias": taller_asistencias,
            "total_taller": total_taller
        })
        
    # 6. Estadísticas diarias
    daily_stats = {}
    for day in active_days:
        presentes_dia = sum([w["asistencias"].get(day) or 0 for w in workshops_report])
        capacidad_dia = sum([w["matriculados"] for w in workshops_report if w["asistencias"].get(day) is not None])
        porcentaje = (presentes_dia / capacidad_dia * 100) if capacidad_dia > 0 else 0
        daily_stats[day] = {
            "presentes": presentes_dia,
            "matricula_total": capacidad_dia,
            "porcentaje": round(porcentaje, 1)
        }
        
    return {
        "active_days": active_days,
        "workshops": workshops_report,
        "daily_stats": daily_stats,
        "total_enrollment": total_enrollment
    }

def get_weekly_attendance_report(db: Session, colegio_id: str, mes: int, anio: int):
    talleres = db.query(Taller).filter(Taller.colegio_id == colegio_id, Taller.periodo == anio).all()
    taller_ids = [t.id for t in talleres]
    
    # 1. Matrícula por taller
    enrollment_query = db.query(Inscripcion.taller_id, func.count(Inscripcion.id).label("count")).filter(
        Inscripcion.taller_id.in_(taller_ids),
        Inscripcion.estado == EstadoInscripcionEnum.inscrito
    ).group_by(Inscripcion.taller_id).all()
    enrollment_map = {str(r.taller_id): r.count for r in enrollment_query}
    total_enrollment = sum(enrollment_map.values())

    # 2. Sesiones del mes
    sesiones = db.query(Sesion).filter(
        Sesion.colegio_id == colegio_id,
        extract('month', Sesion.fecha_sesion) == mes,
        extract('year', Sesion.fecha_sesion) == anio
    ).all()
    
    # 3. Asistencias presentes por sesión
    asistencias_raw = db.query(
        Asistencia.sesion_id,
        func.count(Asistencia.id).label("presentes")
    ).filter(
        Asistencia.sesion_id.in_([s.id for s in sesiones]),
        Asistencia.estado_asistencia == "presente"
    ).group_by(Asistencia.sesion_id).all()
    asistencias_map = {str(r.sesion_id): r.presentes for r in asistencias_raw}

    # 4. Agrupar por semana
    from itertools import groupby
    def get_week_label(s):
        return s.fecha_sesion.isocalendar()[1]
    
    sesiones_sorted = sorted(sesiones, key=lambda s: s.fecha_sesion)
    weeks_data = []
    
    for i, (week_num, group) in enumerate(groupby(sesiones_sorted, key=get_week_label)):
        group_list = list(group)
        presentes = sum([asistencias_map.get(str(s.id), 0) for s in group_list])
        capacidad = sum([enrollment_map.get(str(s.taller_id), 0) for s in group_list])
        porcentaje = (presentes / capacidad * 100) if capacidad > 0 else 0
        
        weeks_data.append({
            "week_label": f"Semana {i+1}",
            "presentes": presentes,
            "capacidad": capacidad,
            "porcentaje": round(min(porcentaje, 100), 1)
        })

    return {
        "weeks": weeks_data,
        "total_enrollment": total_enrollment,
        "active_days_count": len(set([s.fecha_sesion for s in sesiones]))
    }

def get_annual_attendance_report(db: Session, colegio_id: str, anio: int):
    talleres = db.query(Taller).filter(Taller.colegio_id == colegio_id, Taller.periodo == anio).all()
    taller_ids = [t.id for t in talleres]
    
    # 1. Matrícula por taller
    enrollment_query = db.query(Inscripcion.taller_id, func.count(Inscripcion.id).label("count")).filter(
        Inscripcion.taller_id.in_(taller_ids),
        Inscripcion.estado == EstadoInscripcionEnum.inscrito
    ).group_by(Inscripcion.taller_id).all()
    enrollment_map = {str(r.taller_id): r.count for r in enrollment_query}
    total_enrollment = sum(enrollment_map.values())

    # 2. Todas las sesiones del año
    sesiones = db.query(Sesion).filter(
        Sesion.colegio_id == colegio_id,
        extract('year', Sesion.fecha_sesion) == anio
    ).all()
    
    # 3. Asistencias presentes por sesión
    asistencias_raw = db.query(
        Asistencia.sesion_id,
        func.count(Asistencia.id).label("presentes")
    ).filter(
        Asistencia.sesion_id.in_([s.id for s in sesiones]),
        Asistencia.estado_asistencia == "presente"
    ).group_by(Asistencia.sesion_id).all()
    asistencias_map = {str(r.sesion_id): r.presentes for r in asistencias_raw}

    meses_nombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    months_data = []
    
    total_presentes_anio = 0
    total_capacidad_anio = 0
    
    for m_idx in range(1, 13):
        mes_sesiones = [s for s in sesiones if s.fecha_sesion.month == m_idx]
        if not mes_sesiones:
            continue
            
        presentes = sum([asistencias_map.get(str(s.id), 0) for s in mes_sesiones])
        capacidad = sum([enrollment_map.get(str(s.taller_id), 0) for s in mes_sesiones])
        porcentaje = (presentes / capacidad * 100) if capacidad > 0 else 0
        
        total_presentes_anio += presentes
        total_capacidad_anio += capacidad
        
        months_data.append({
            "month_label": meses_nombres[m_idx - 1],
            "presentes": presentes,
            "capacidad": capacidad,
            "porcentaje": round(min(porcentaje, 100), 1)
        })

    return {
        "months": months_data,
        "total_enrollment": total_enrollment,
        "total_presentes_anio": total_presentes_anio,
        "promedio_anual": round((total_presentes_anio / total_capacidad_anio * 100), 1) if total_capacidad_anio > 0 else 0
    }

def get_weekly_summary_report(db: Session, colegio_id: str, semanas_atras: int = 0):
    hoy = datetime.date.today()
    
    # Calcular el lunes de la semana actual (hoy - su día de la semana)
    # hoy.weekday() es 0 para lunes, 6 para domingo
    inicio_semana_actual = hoy - datetime.timedelta(days=hoy.weekday())
    
    # Aplicar el offset de semanas
    inicio_semana_seleccionada = inicio_semana_actual - datetime.timedelta(weeks=semanas_atras)
    fin_semana_seleccionada = inicio_semana_seleccionada + datetime.timedelta(days=4)  # Lunes a Viernes
    
    # Semana anterior relativa a la seleccionada
    inicio_semana_anterior = inicio_semana_seleccionada - datetime.timedelta(weeks=1)
    fin_semana_anterior = inicio_semana_anterior + datetime.timedelta(days=4)  # Lunes a Viernes
    
    # Rango extendido para incluir el día anterior (el domingo anterior)
    rango_sel_inicio = inicio_semana_seleccionada - datetime.timedelta(days=1)
    rango_ant_inicio = inicio_semana_anterior - datetime.timedelta(days=1)
    
    # Sesiones en las semanas respectivas (incluyendo el día anterior)
    sesiones_seleccionadas = db.query(Sesion).filter(
        Sesion.colegio_id == colegio_id,
        Sesion.fecha_sesion >= rango_sel_inicio,
        Sesion.fecha_sesion <= fin_semana_seleccionada
    ).all()
    
    sesiones_anteriores = db.query(Sesion).filter(
        Sesion.colegio_id == colegio_id,
        Sesion.fecha_sesion >= rango_ant_inicio,
        Sesion.fecha_sesion <= fin_semana_anterior
    ).all()
    
    sesiones_hoy = db.query(Sesion).filter(
        Sesion.colegio_id == colegio_id,
        Sesion.fecha_sesion == hoy
    ).all()
    
    # Obtener matrícula por taller
    talleres = db.query(Taller).filter(Taller.colegio_id == colegio_id).all()
    taller_ids = [t.id for t in talleres]
    enrollment_map = {}
    if taller_ids:
        enrollment_query = db.query(Inscripcion.taller_id, func.count(Inscripcion.id).label("count")).filter(
            Inscripcion.taller_id.in_(taller_ids),
            Inscripcion.estado == EstadoInscripcionEnum.inscrito
        ).group_by(Inscripcion.taller_id).all()
        enrollment_map = {str(r.taller_id): r.count for r in enrollment_query}
    
    def get_attendance_for_sessions(sesion_ids):
        if not sesion_ids:
            return {}
        res = db.query(
            Asistencia.sesion_id,
            func.count(Asistencia.id).label("presentes")
        ).filter(
            Asistencia.sesion_id.in_(sesion_ids),
            Asistencia.estado_asistencia == "presente"
        ).group_by(Asistencia.sesion_id).all()
        return {str(row.sesion_id): row.presentes for row in res}
    
    asistencias_sel_map = get_attendance_for_sessions([s.id for s in sesiones_seleccionadas])
    asistencias_ant_map = get_attendance_for_sessions([s.id for s in sesiones_anteriores])
    asistencias_hoy_map = get_attendance_for_sessions([s.id for s in sesiones_hoy])
    
    total_hoy = sum(asistencias_hoy_map.values())
    
    dias_nombres = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
    
    def build_weekly_list(inicio_lunes, sesiones_lista, asistencias_map):
        days_list = []
        date_to_sessions = {}
        sesion_obj_map = {s.id: s for s in sesiones_lista}
        
        for s in sesiones_lista:
            dt_str = s.fecha_sesion.strftime("%Y-%m-%d")
            if dt_str not in date_to_sessions:
                date_to_sessions[dt_str] = []
            date_to_sessions[dt_str].append(s.id)
            
        for i in range(5):  # Lunes a Viernes
            day_date = inicio_lunes + datetime.timedelta(days=i)
            day_date_str = day_date.strftime("%Y-%m-%d")
            session_ids = date_to_sessions.get(day_date_str, [])
            presentes_dia = sum(asistencias_map.get(sid, 0) for sid in session_ids)
            
            # Calcular matrícula de los talleres con sesiones hoy
            unique_taller_ids = set(sesion_obj_map[sid].taller_id for sid in session_ids if sid in sesion_obj_map)
            matricula_total_dia = sum(enrollment_map.get(str(tid), 0) for tid in unique_taller_ids)
            
            porcentaje_asistencia = round((presentes_dia / matricula_total_dia) * 100, 1) if matricula_total_dia > 0 else 0.0
            
            # Obtener asistencia del día anterior
            prev_date = day_date - datetime.timedelta(days=1)
            prev_date_str = prev_date.strftime("%Y-%m-%d")
            prev_session_ids = date_to_sessions.get(prev_date_str, [])
            presentes_anterior = sum(asistencias_map.get(sid, 0) for sid in prev_session_ids)
            
            diferencia_anterior = None
            if i > 0:  # No se calcula para el lunes
                if presentes_anterior > 0:
                    diferencia_anterior = round(((presentes_dia - presentes_anterior) / presentes_anterior) * 100, 1)
                else:
                    diferencia_anterior = 100.0 if presentes_dia > 0 else 0.0
            
            days_list.append({
                "fecha": day_date_str,
                "dia": dias_nombres[i],
                "presentes": presentes_dia,
                "matricula_total": matricula_total_dia,
                "porcentaje_asistencia": porcentaje_asistencia,
                "diferencia_anterior": diferencia_anterior
            })
        return days_list
        
    semana_actual_list = build_weekly_list(inicio_semana_seleccionada, sesiones_seleccionadas, asistencias_sel_map)
    semana_anterior_list = build_weekly_list(inicio_semana_anterior, sesiones_anteriores, asistencias_ant_map)
    
    total_semana_actual = sum(d["presentes"] for d in semana_actual_list)
    total_semana_anterior = sum(d["presentes"] for d in semana_anterior_list)
    
    comparativa_totales_porcentaje = None
    if total_semana_anterior > 0:
        comparativa_totales_porcentaje = round(((total_semana_actual - total_semana_anterior) / total_semana_anterior) * 100, 1)
        
    return {
        "total_hoy": total_hoy,
        "semana_actual": semana_actual_list,
        "semana_anterior": semana_anterior_list,
        "total_semana_actual": total_semana_actual,
        "total_semana_anterior": total_semana_anterior,
        "comparativa_totales_porcentaje": comparativa_totales_porcentaje
    }


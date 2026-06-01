from typing import List
from sqlalchemy.orm import Session
from uuid import UUID
from modules.talleres.models import Taller, TallerHorario
from modules.talleres.schemas import TallerCreate, TallerUpdate
from modules.usuarios.models import Usuario
from modules.alumnos.crud import format_rut
from sqlalchemy import func, select
from modules.inscripciones.models import Inscripcion, EstadoInscripcionEnum
from modules.colegios.models import Colegio


def _nombre_profesor_expr():
    """Subquery correlated que obtiene el nombre del monitor sin pasar por with_loader_criteria.
    Usa la tabla raw de usuarios para evitar que el filtro de tenant descarte monitores de otro colegio.
    Prioriza nombre_2 (nombre visible) y cae a nombre (login) si está vacío."""
    _ut = Usuario.__table__
    return (
        select(func.coalesce(_ut.c.nombre_2, _ut.c.nombre))
        .where(_ut.c.id == Taller.profesor_id)
        .correlate(Taller)
        .scalar_subquery()
    )


def get_talleres(db: Session, colegio_id: UUID = None, skip: int = 0, limit: int = 100, usuario_id: str = None, rol: str = None):
    # Subquery para contar inscripciones activas
    inscritos_subquery = (
        db.query(Inscripcion.taller_id, func.count(Inscripcion.id).label("count"))
        .filter(Inscripcion.estado == EstadoInscripcionEnum.inscrito)
        .group_by(Inscripcion.taller_id)
        .subquery()
    )

    query = db.query(
        Taller,
        func.coalesce(inscritos_subquery.c.count, 0).label("alumnos_inscritos"),
        Colegio.nombre_colegio,
        _nombre_profesor_expr().label("nombre_profesor")
    ).outerjoin(inscritos_subquery, Taller.id == inscritos_subquery.c.taller_id)\
     .join(Colegio, Taller.colegio_id == Colegio.id)\
     .filter(Taller.is_active == True)

    if colegio_id:
        query = query.filter(Taller.colegio_id == str(colegio_id))
    
    if rol == "monitor" and usuario_id:
        query = query.filter(Taller.profesor_id == str(usuario_id))
        
    results = query.offset(skip).limit(limit).all()
    
    # Mapear los resultados para que coincidan con el esquema TallerResponse
    talleres_con_conteo = []
    for db_taller, count, nombre_co, nombre_prof in results:
        db_taller.alumnos_inscritos = count
        db_taller.nombre_colegio = nombre_co
        db_taller.nombre_profesor = nombre_prof
        talleres_con_conteo.append(db_taller)
        
    return talleres_con_conteo


def get_taller_by_id(db: Session, taller_id: UUID, colegio_id: str = None):
    # También incluimos el conteo y el nombre del colegio en el detalle por ID
    query = db.query(Taller, Colegio.nombre_colegio, _nombre_profesor_expr().label("nombre_profesor"))\
            .join(Colegio, Taller.colegio_id == Colegio.id)\
            .filter(Taller.id == str(taller_id))
    
    if colegio_id:
        query = query.filter(Taller.colegio_id == str(colegio_id))
        
    res = query.first()
    
    if not res:
        return None
        
    db_taller, nombre_co, nombre_prof = res
    
    inscritos_count = (
        db.query(func.count(Inscripcion.id))
        .filter(Inscripcion.taller_id == str(taller_id), Inscripcion.estado == EstadoInscripcionEnum.inscrito)
        .scalar()
    )
    
    db_taller.alumnos_inscritos = inscritos_count or 0
    db_taller.nombre_colegio = nombre_co
    db_taller.nombre_profesor = nombre_prof
        
    return db_taller


def get_talleres_otros_colegios(db: Session, colegio_id: str = None):
    query = (
        db.query(Taller, Colegio.nombre_colegio, _nombre_profesor_expr().label("nombre_profesor"))
        .join(Colegio, Taller.colegio_id == Colegio.id)
        .filter(Taller.is_active == True)
        .execution_options(skip_tenant_filter=True)
    )
    if colegio_id:
        query = query.filter(Taller.colegio_id != str(colegio_id))
    results = query.all()
    talleres = []
    for db_taller, nombre_co, nombre_prof in results:
        db_taller.alumnos_inscritos = 0
        db_taller.nombre_colegio = nombre_co
        db_taller.nombre_profesor = nombre_prof
        talleres.append(db_taller)
    return talleres


def get_taller_by_nombre(db: Session, nombre: str, colegio_id: str = None):
    query = db.query(Taller).filter(Taller.nombre_taller == nombre)
    if colegio_id:
        query = query.filter(Taller.colegio_id == str(colegio_id))
    return query.first()


def create_taller(db: Session, taller: TallerCreate, colegio_id: UUID):
    data = taller.model_dump()
    horarios_data = data.pop("horarios", [])
    
    if horarios_data:
        dias_list = []
        for h in horarios_data:
            d = h.get("dia")
            if d and d not in dias_list:
                dias_list.append(d)
        resumen_dia = ", ".join(dias_list) if dias_list else "Varios"
        if len(resumen_dia) > 20:
            resumen_dia = "Varios días"
        data["dia"] = resumen_dia
        data["hora_inicio"] = horarios_data[0].get("hora_inicio")
        data["hora_fin"] = horarios_data[0].get("hora_fin")
        
    db_taller = Taller(**data, colegio_id=str(colegio_id))
    db.add(db_taller)
    db.commit()
    db.refresh(db_taller)
    
    for h in horarios_data:
        db_horario = TallerHorario(
            taller_id=db_taller.id,
            dia=h.get("dia", "Lunes"),
            hora_inicio=h.get("hora_inicio"),
            hora_fin=h.get("hora_fin")
        )
        db.add(db_horario)
    if horarios_data:
        db.commit()
        db.refresh(db_taller)
    return db_taller


def update_taller(db: Session, taller_id: UUID, taller: TallerUpdate, colegio_id: UUID):
    db_taller = get_taller_by_id(db, taller_id, colegio_id)
    if db_taller:
        data = taller.model_dump(exclude_unset=True)
        horarios_data = data.pop("horarios", None)
        
        if horarios_data is not None:
            # Eliminar horarios satélite existentes
            db.query(TallerHorario).filter(TallerHorario.taller_id == str(taller_id)).delete()
            dias_list = []
            for h in horarios_data:
                d = h.get("dia")
                if d and d not in dias_list:
                    dias_list.append(d)
            resumen_dia = ", ".join(dias_list) if dias_list else "Varios"
            if len(resumen_dia) > 20:
                resumen_dia = "Varios días"
            data["dia"] = resumen_dia
            if horarios_data:
                data["hora_inicio"] = horarios_data[0].get("hora_inicio")
                data["hora_fin"] = horarios_data[0].get("hora_fin")
            for h in horarios_data:
                db_h = TallerHorario(
                    taller_id=str(taller_id),
                    dia=h.get("dia", "Lunes"),
                    hora_inicio=h.get("hora_inicio"),
                    hora_fin=h.get("hora_fin")
                )
                db.add(db_h)
                
        for key, value in data.items():
            setattr(db_taller, key, value)
        db.commit()
        db.refresh(db_taller)
    return db_taller


def delete_taller(db: Session, taller_id: UUID, colegio_id: UUID):
    db_taller = get_taller_by_id(db, taller_id, colegio_id)
    if db_taller:
        setattr(db_taller, "is_active", False)
        db.commit()
        db.refresh(db_taller)
    return db_taller

def bulk_upsert_talleres(db: Session, talleres_data: list, colegio_id: str):
    """
    Inserta o actualiza masivamente una lista de talleres agrupando múltiples filas por nombre
    para construir o recrear todos los horarios asociados de forma unificada con control de savepoints.
    """
    def clean_time(v):
        if v is None:
            return None
        s = str(v).strip()
        return s[:5] if s else None

    # Agrupar por nombre de taller (case-insensitive para clave, pero preservando el nombre original)
    talleres_agrupados = {}
    for item in talleres_data:
        nombre = item.get("nombre_taller")
        if not nombre:
            continue
        key = nombre.strip().lower()
        if key not in talleres_agrupados:
            talleres_agrupados[key] = {
                "nombre_taller": nombre.strip(),
                "profesor_id": item.get("profesor_id"),
                "cupos_maximos": item.get("cupos_maximos"),
                "cursos_asignados": item.get("cursos_asignados"),
                "periodo": item.get("periodo"),
                "colegio_id": item.get("colegio_id") or colegio_id,
                "horarios": []
            }
        # Si la fila subsiguiente tiene valores en propiedades maestras, completarlas si faltaban
        if not talleres_agrupados[key]["profesor_id"] and item.get("profesor_id"):
            talleres_agrupados[key]["profesor_id"] = item.get("profesor_id")
        if not talleres_agrupados[key]["cursos_asignados"] and item.get("cursos_asignados"):
            talleres_agrupados[key]["cursos_asignados"] = item.get("cursos_asignados")
        if not talleres_agrupados[key]["periodo"] and item.get("periodo"):
            talleres_agrupados[key]["periodo"] = item.get("periodo")
            
        dia = item.get("dia")
        if dia:
            talleres_agrupados[key]["horarios"].append({
                "dia": dia.strip(),
                "hora_inicio": clean_time(item.get("hora_inicio")),
                "hora_fin": clean_time(item.get("hora_fin"))
            })

    stats = {"inserted": 0, "updated": 0, "errors": 0}
    for key, data in talleres_agrupados.items():
        try:
            nombre = data["nombre_taller"]
            prof_id_or_name = str(data["profesor_id"]).strip() if data["profesor_id"] else ""
            cupos = data["cupos_maximos"]
            cursos = data["cursos_asignados"]
            periodo = data["periodo"] or 2026
            item_colegio_id = str(data["colegio_id"])
            horarios = data["horarios"]
            
            if not nombre or not prof_id_or_name:
                stats["errors"] += 1
                continue
            
            is_update = False
            # Aislar errores individuales usando un savepoint anidado
            with db.begin_nested():
                # Buscar profesor por ID o por nombre de usuario (login) en el colegio destino
                profesor = db.query(Usuario).filter(
                    (Usuario.id == prof_id_or_name) | (Usuario.nombre == prof_id_or_name),
                    Usuario.colegio_id == item_colegio_id
                ).first()
                
                if not profesor:
                    raise ValueError("Profesor no encontrado")
                    
                # Construir cadena resumen de días
                dias_list = []
                for h in horarios:
                    d = h["dia"]
                    if d and d not in dias_list:
                        dias_list.append(d)
                resumen_dia = ", ".join(dias_list) if dias_list else "Varios"
                if len(resumen_dia) > 20:
                    resumen_dia = "Varios días"
                    
                h_inicio = horarios[0]["hora_inicio"] if horarios else None
                h_fin = horarios[0]["hora_fin"] if horarios else None
                
                existing = get_taller_by_nombre(db, nombre, item_colegio_id)
                if existing:
                    existing.profesor_id = profesor.id
                    if cupos: existing.cupos_maximos = cupos
                    existing.dia = resumen_dia
                    existing.hora_inicio = h_inicio
                    existing.hora_fin = h_fin
                    if cursos is not None: existing.cursos_asignados = cursos
                    if periodo: existing.periodo = periodo
                    
                    # Recrear horarios satélite
                    db.query(TallerHorario).filter(TallerHorario.taller_id == existing.id).delete()
                    db.flush()
                    
                    for h in horarios:
                        nh = TallerHorario(
                            taller_id=existing.id,
                            dia=h["dia"],
                            hora_inicio=h["hora_inicio"],
                            hora_fin=h["hora_fin"]
                        )
                        db.add(nh)
                    db.flush()
                    is_update = True
                else:
                    new_taller = Taller(
                        nombre_taller=nombre,
                        profesor_id=profesor.id,
                        cupos_maximos=cupos if cupos else 20,
                        dia=resumen_dia,
                        hora_inicio=h_inicio,
                        hora_fin=h_fin,
                        cursos_asignados=cursos,
                        periodo=periodo,
                        colegio_id=item_colegio_id
                    )
                    db.add(new_taller)
                    db.flush()
                    
                    for h in horarios:
                        nh = TallerHorario(
                            taller_id=new_taller.id,
                            dia=h["dia"],
                            hora_inicio=h["hora_inicio"],
                            hora_fin=h["hora_fin"]
                        )
                        db.add(nh)
                    db.flush()
                    is_update = False
                    
            if is_update:
                stats["updated"] += 1
            else:
                stats["inserted"] += 1
        except Exception:
            stats["errors"] += 1
    
    db.commit()
    return stats

def clonar_periodo(db: Session, source_periodo: int, target_periodo: int, taller_ids: List[UUID], colegio_id: str):
    clonados = 0
    for t_id in taller_ids:
        # Buscar taller original
        source_taller = db.query(Taller).filter(Taller.id == str(t_id), Taller.colegio_id == colegio_id).first()
        if not source_taller:
            continue
            
        # Verificar si ya existe en el target
        exists = db.query(Taller).filter(
            Taller.nombre_taller == source_taller.nombre_taller,
            Taller.colegio_id == colegio_id,
            Taller.periodo == target_periodo
        ).first()
        
        if exists:
            continue
            
        # Clonar
        new_taller = Taller(
            nombre_taller=source_taller.nombre_taller,
            profesor_id=source_taller.profesor_id,
            cupos_maximos=source_taller.cupos_maximos,
            dia=source_taller.dia,
            hora_inicio=source_taller.hora_inicio,
            hora_fin=source_taller.hora_fin,
            colegio_id=colegio_id,
            periodo=target_periodo,
            cursos_asignados=source_taller.cursos_asignados,
            is_active=True
        )
        db.add(new_taller)
        db.flush()
        
        source_horarios = db.query(TallerHorario).filter(TallerHorario.taller_id == source_taller.id).all()
        for sh in source_horarios:
            nh = TallerHorario(
                taller_id=new_taller.id,
                dia=sh.dia,
                hora_inicio=sh.hora_inicio,
                hora_fin=sh.hora_fin
            )
            db.add(nh)
            
        clonados += 1
    
    db.commit()
    return clonados

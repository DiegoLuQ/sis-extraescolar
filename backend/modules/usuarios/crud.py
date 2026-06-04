from sqlalchemy.orm import Session
from uuid import UUID
from modules.usuarios.models import Usuario, RolEnum
from modules.usuarios.schemas import UsuarioCreate, UsuarioUpdate
from core.security import get_password_hash


def get_usuarios(
    db: Session,
    colegio_id: UUID = None,
    skip: int = 0,
    limit: int = 100,
    role_filter: str = None,
    only_with_talleres: bool = False,
    requester_role: str = None,
    include_inactive: bool = False
):
    from modules.talleres.models import Taller

    query = db.query(Usuario)
    # Por defecto solo usuarios activos. El admin puede ver también los inactivos.
    if not include_inactive:
        query = query.filter(Usuario.is_active == True)

    # Si el filtro es por monitor, mostramos TODOS los monitores (según requerimiento de visibilidad global)
    if role_filter and role_filter.lower() == "monitor":
        query = query.filter(Usuario.rol == RolEnum.monitor).execution_options(skip_tenant_filter=True)
    else:
        # Lógica de visibilidad normal para otros roles o sin filtro
        if requester_role == "coordinador":
            query = query.filter(Usuario.rol == RolEnum.monitor)
            if only_with_talleres and colegio_id:
                query = query.join(Taller, Taller.profesor_id == Usuario.id)\
                             .filter(Taller.colegio_id == str(colegio_id))\
                             .distinct()
        elif colegio_id:
            from sqlalchemy import or_
            query = query.filter(or_(Usuario.colegio_id == str(colegio_id), Usuario.colegio_id == None))

    if role_filter and not (role_filter.lower() == "monitor"):
        query = query.filter(Usuario.rol == RolEnum[role_filter.lower()])
        
    return query.offset(skip).limit(limit).all()


def get_usuario_by_id(db: Session, usuario_id: UUID, colegio_id: UUID = None):
    query = db.query(Usuario).filter(Usuario.id == str(usuario_id))
    if colegio_id:
        query = query.filter(Usuario.colegio_id == str(colegio_id))
    return query.first()


def get_usuario_by_nombre(db: Session, nombre: str, colegio_id: UUID = None):
    query = db.query(Usuario).filter(Usuario.nombre == nombre)
    if colegio_id:
        query = query.filter(Usuario.colegio_id == str(colegio_id))
    else:
        query = query.execution_options(skip_tenant_filter=True)
    return query.first()


def create_usuario(db: Session, usuario: UsuarioCreate, colegio_id: UUID = None):
    hashed_password = get_password_hash(usuario.password)
    rol_enum = RolEnum[usuario.rol.lower()]
    
    # Priorizar el colegio del formulario. Si no hay, usar el del contexto.
    if usuario.colegio_id:
        target_colegio_id = str(usuario.colegio_id)
    elif colegio_id:
        target_colegio_id = str(colegio_id)
    else:
        target_colegio_id = None

    db_usuario = Usuario(
        nombre=usuario.nombre,
        nombre_2=usuario.nombre_2,
        email=usuario.email,
        password_hash=hashed_password,
        rol=rol_enum,
        colegio_id=target_colegio_id
    )
    db.add(db_usuario)
    db.commit()
    db.refresh(db_usuario)
    return db_usuario


def get_impacto_eliminacion(db: Session, ids: list, colegio_id: UUID = None):
    """Calcula el impacto de eliminar (lógicamente) uno o varios usuarios:
    talleres que se desactivarán, inscripciones que se retirarán, y sesiones/
    asistencias/notas que se CONSERVAN como histórico."""
    from modules.talleres.models import Taller
    from modules.sesiones.models import Sesion
    from modules.inscripciones.models import Inscripcion, EstadoInscripcionEnum
    from modules.asistencias.models import Asistencia, NotaComportamiento

    usuarios = []
    taller_ids = []
    for uid in ids:
        u = get_usuario_by_id(db, uid, colegio_id)
        if not u:
            continue
        usuarios.append({"id": str(u.id), "nombre": u.nombre, "nombre_2": u.nombre_2})
        tids = [t.id for t in db.query(Taller.id).filter(
            Taller.profesor_id == str(uid), Taller.is_active == True
        ).all()]
        taller_ids.extend(tids)

    taller_ids = list(set(str(t) for t in taller_ids))
    sesion_ids = []
    inscripciones = 0
    if taller_ids:
        sesion_ids = [s.id for s in db.query(Sesion.id).filter(Sesion.taller_id.in_(taller_ids)).all()]
        inscripciones = db.query(Inscripcion).filter(
            Inscripcion.taller_id.in_(taller_ids),
            Inscripcion.estado == EstadoInscripcionEnum.inscrito
        ).count()

    sesion_ids = [str(s) for s in sesion_ids]
    asistencias = 0
    notas = 0
    if sesion_ids:
        asistencias = db.query(Asistencia).filter(Asistencia.sesion_id.in_(sesion_ids)).count()
        notas = db.query(NotaComportamiento).filter(NotaComportamiento.sesion_id.in_(sesion_ids)).count()

    return {
        "usuarios": usuarios,
        "talleres": len(taller_ids),
        "sesiones": len(sesion_ids),
        "inscripciones": inscripciones,
        "asistencias": asistencias,
        "notas": notas,
        "tiene_dependencias": (len(taller_ids) > 0 or inscripciones > 0 or len(sesion_ids) > 0),
    }


def bulk_delete_usuarios(db: Session, ids: list, colegio_id: UUID = None, exclude_id: str = None):
    """Eliminación LÓGICA en cascada de uno o varios usuarios:
    - Desactiva el usuario (is_active=False).
    - Desactiva sus talleres asignados (is_active=False).
    - Retira las inscripciones activas de esos talleres (estado=retirado, fecha_retiro=hoy);
      los alumnos se conservan.
    - Sesiones, asistencias y notas de comportamiento se CONSERVAN como histórico.
    No actúa sobre el propio solicitante."""
    import datetime
    from modules.talleres.models import Taller
    from modules.inscripciones.models import Inscripcion, EstadoInscripcionEnum

    hoy = datetime.date.today()
    res = {"usuarios": 0, "talleres": 0, "inscripciones": 0}

    for uid in ids:
        if exclude_id and str(uid) == str(exclude_id):
            continue
        db_usuario = get_usuario_by_id(db, uid, colegio_id)
        if not db_usuario:
            continue

        talleres = db.query(Taller).filter(
            Taller.profesor_id == str(uid), Taller.is_active == True
        ).all()
        for t in talleres:
            t.is_active = False
            res["talleres"] += 1
            inscripciones = db.query(Inscripcion).filter(
                Inscripcion.taller_id == t.id,
                Inscripcion.estado == EstadoInscripcionEnum.inscrito
            ).all()
            for ins in inscripciones:
                ins.estado = EstadoInscripcionEnum.retirado
                ins.fecha_retiro = hoy
                res["inscripciones"] += 1

        if db_usuario.is_active:
            db_usuario.is_active = False
        res["usuarios"] += 1

    db.commit()
    return res


def hard_delete_usuarios_cascade(db: Session, ids: list, colegio_id: UUID = None, exclude_id: str = None):
    """Eliminación FÍSICA en cascada (irreversible). Borra el usuario y todo lo dependiente:
    talleres, sus sesiones, asistencias, notas, alertas e inscripciones (los alumnos se
    conservan). Reasigna al solicitante las sesiones creadas por el usuario en talleres
    ajenos, y anula creado_por en notas para no violar claves foráneas."""
    from modules.talleres.models import Taller, TallerHorario
    from modules.sesiones.models import Sesion
    from modules.inscripciones.models import Inscripcion
    from modules.asistencias.models import Asistencia, NotaComportamiento, AlertaInconsistencia

    res = {"usuarios": 0, "talleres": 0, "sesiones": 0, "inscripciones": 0, "asistencias": 0, "notas": 0}

    for uid in ids:
        if exclude_id and str(uid) == str(exclude_id):
            continue
        db_usuario = get_usuario_by_id(db, uid, colegio_id)
        if not db_usuario:
            continue

        # Talleres del usuario en CUALQUIER colegio (evita violar FK profesor_id)
        taller_ids = [t.id for t in db.query(Taller.id)
                      .filter(Taller.profesor_id == str(uid))
                      .execution_options(skip_tenant_filter=True).all()]
        taller_ids = [str(t) for t in taller_ids]

        sesion_ids = []
        if taller_ids:
            sesion_ids = [str(s.id) for s in db.query(Sesion.id)
                          .filter(Sesion.taller_id.in_(taller_ids))
                          .execution_options(skip_tenant_filter=True).all()]

        if sesion_ids:
            res["asistencias"] += db.query(Asistencia).filter(Asistencia.sesion_id.in_(sesion_ids)).delete(synchronize_session=False)
            res["notas"] += db.query(NotaComportamiento).filter(NotaComportamiento.sesion_id.in_(sesion_ids)).delete(synchronize_session=False)
            db.query(AlertaInconsistencia).filter(AlertaInconsistencia.sesion_id.in_(sesion_ids)).delete(synchronize_session=False)
            res["sesiones"] += db.query(Sesion).filter(Sesion.id.in_(sesion_ids)).delete(synchronize_session=False)

        if taller_ids:
            res["inscripciones"] += db.query(Inscripcion).filter(Inscripcion.taller_id.in_(taller_ids)).delete(synchronize_session=False)
            db.query(TallerHorario).filter(TallerHorario.taller_id.in_(taller_ids)).delete(synchronize_session=False)
            res["talleres"] += db.query(Taller).filter(Taller.id.in_(taller_ids)).delete(synchronize_session=False)

        # Referencias residuales al usuario (en talleres ajenos no borrados)
        if exclude_id:
            db.query(Sesion).filter(Sesion.creado_por == str(uid)).update(
                {Sesion.creado_por: str(exclude_id)}, synchronize_session=False)
        db.query(NotaComportamiento).filter(NotaComportamiento.creado_por == str(uid)).update(
            {NotaComportamiento.creado_por: None}, synchronize_session=False)

        db.query(Usuario).filter(Usuario.id == str(uid)).delete(synchronize_session=False)
        res["usuarios"] += 1

    db.commit()
    return res


def bulk_create_usuarios(db: Session, usuarios_data: list, colegio_id: str = None):
    """Crea usuarios masivamente. El login (nombre) es único global: si ya existe, se omite.
    Si no se entrega contraseña, se usa '<login>123' por defecto."""
    stats = {"inserted": 0, "skipped": 0, "errors": 0}
    roles_validos = ("admin", "monitor", "coordinador")

    for item in usuarios_data:
        try:
            nombre = (item.get("nombre") or "").strip()
            rol_raw = (item.get("rol") or "").strip().lower()
            if not nombre or rol_raw not in roles_validos:
                stats["errors"] += 1
                continue

            with db.begin_nested():
                # El login es único global → buscar sin filtro de tenant
                existente = (
                    db.query(Usuario)
                    .filter(Usuario.nombre == nombre)
                    .execution_options(skip_tenant_filter=True)
                    .first()
                )
                if existente:
                    stats["skipped"] += 1
                    continue

                pwd = (item.get("password") or "").strip() or f"{nombre}123"
                db_usuario = Usuario(
                    nombre=nombre,
                    nombre_2=(item.get("nombre_2") or "").strip() or None,
                    email=(item.get("email") or "").strip() or None,
                    password_hash=get_password_hash(pwd),
                    rol=RolEnum[rol_raw],
                    colegio_id=str(colegio_id) if colegio_id else None,
                )
                db.add(db_usuario)
            stats["inserted"] += 1
        except Exception:
            stats["errors"] += 1

    db.commit()
    return stats


def update_usuario(db: Session, usuario_id: UUID, usuario: UsuarioUpdate, colegio_id: UUID = None):
    db_usuario = get_usuario_by_id(db, usuario_id, colegio_id)
    if db_usuario:
        update_data = usuario.model_dump(exclude_unset=True)
        
        if "nombre" in update_data:
            existing = get_usuario_by_nombre(db, usuario.nombre, None) # Check global use
            if existing and str(existing.id) != str(usuario_id):
                raise ValueError("El nombre de usuario ya está en uso")
            db_usuario.nombre = update_data["nombre"]
            
        if "password" in update_data and update_data["password"]:
            db_usuario.password_hash = get_password_hash(update_data["password"])
            
        if "rol" in update_data:
            db_usuario.rol = RolEnum[update_data["rol"].lower()]
            
        if "is_active" in update_data:
            db_usuario.is_active = update_data["is_active"]
            
        if "nombre_2" in update_data:
            db_usuario.nombre_2 = update_data["nombre_2"]
            
        if "email" in update_data:
            db_usuario.email = update_data["email"]
            
        if "colegio_id" in update_data:
            val = str(update_data["colegio_id"]) if update_data["colegio_id"] else None
            db_usuario.colegio_id = val
            
        db.commit()
        db.refresh(db_usuario)
    return db_usuario


def delete_usuario(db: Session, usuario_id: UUID, colegio_id: UUID):
    db_usuario = get_usuario_by_id(db, usuario_id, colegio_id)
    if db_usuario:
        setattr(db_usuario, "is_active", False)
        db.commit()
        db.refresh(db_usuario)
    return db_usuario

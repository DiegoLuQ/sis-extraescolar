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
    requester_role: str = None
):
    from modules.talleres.models import Taller
    
    query = db.query(Usuario)
    
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

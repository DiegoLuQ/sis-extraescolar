"""
Script para populate la base de datos con datos de prueba
Ejecutar: python scripts/seed_data.py
"""
import sys
import os
from datetime import datetime, timedelta
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from core.database import SessionLocal
from modules.colegios.models import Colegio
from modules.usuarios.models import Usuario, RolEnum
from modules.alumnos.models import Alumno
from modules.talleres.models import Taller
from modules.inscripciones.models import Inscripcion
from modules.sesiones.models import Sesion
from modules.asistencias.models import Asistencia
from core.security import get_password_hash


def clean_data(db: Session):
    """Limpia todos los datos existentes"""
    print(">>> Limpiando datos existentes...")
    db.query(Asistencia).delete()
    db.query(Sesion).delete()
    db.query(Inscripcion).delete()
    db.query(Taller).delete()
    db.query(Alumno).delete()
    db.query(Usuario).delete()
    db.query(Colegio).delete()
    db.commit()
    print(">>> Datos limpiados")


def create_colegios(db: Session):
    """Crear colegios"""
    print(">>> Creando colegios...")
    
    colegios_data = [
        {"nombre_colegio": "Colegio Santiago Centro", "rut_sostenedor": "12.345.678-9"},
        {"nombre_colegio": "Colegio Norte", "rut_sostenedor": "98.765.432-1"},
        {"nombre_colegio": "Colegio Sur", "rut_sostenedor": "55.444.333-2"},
    ]
    
    colegios = []
    for data in colegios_data:
        colegio = Colegio(**data, is_active=True)
        db.add(colegio)
        colegios.append(colegio)
    
    db.commit()
    for c in colegios:
        db.refresh(c)
    
    print(f">>> {len(colegios)} colegios creados")
    return colegios


def create_usuarios(db: Session, colegios: list):
    """Crear usuarios"""
    print(">>> Creando usuarios...")
    
    usuarios = []
    
    # Roles disponibles
    roles = ["admin", "coordinador", "extraescolar"]
    
    for i, colegio in enumerate(colegios):
        # Admin
        admin = Usuario(
            nombre=f"admin-{i+1}",
            password_hash=get_password_hash("password123"),
            rol=RolEnum.admin,
            is_active=True,
            colegio_id=colegio.id
        )
        db.add(admin)
        usuarios.append(admin)
        
        # Coordinador
        coord = Usuario(
            nombre=f"coord-{i+1}",
            password_hash=get_password_hash("password123"),
            rol=RolEnum.coordinador,
            is_active=True,
            colegio_id=colegio.id
        )
        db.add(coord)
        usuarios.append(coord)
        
        # Extraescolares (2 por colegio)
        for j in range(2):
            extra = Usuario(
                nombre=f"prof{i+1}-{j+1}",
                password_hash=get_password_hash("password123"),
                rol=RolEnum.extraescolar,
                is_active=True,
                colegio_id=colegio.id
            )
            db.add(extra)
            usuarios.append(extra)
    
    db.commit()
    for u in usuarios:
        db.refresh(u)
    
    print(f">>> {len(usuarios)} usuarios creados")
    return usuarios


def generate_rut():
    """Genera un RUT chileno válido"""
    num = random.randint(1000000, 25000000)
    dv = random.choice(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'K'])
    return f"{num}-{dv}"


def create_alumnos(db: Session, colegios: list):
    """Crear alumnos"""
    print(">>> Creando alumnos...")
    
    cursos = ["1A", "1B", "2A", "2B"]
    nombres_hombres = [
        "Juan", "Pedro", "Carlos", "Diego", "Miguel", "Lucas", "Matías", "Gabriel", "Alejandro", "Javier",
        "Nicolás", "Sebastián", "Fernando", "Daniel", "Jorge", "Andrés", "Cristián", "Mauricio", "Roberto", "Francisco"
    ]
    nombres_mujeres = [
        "María", "Ana", "Sofía", "Isabella", "Camila", "Valentina", "Javiera", "Martina", "Antonia", "Emilia",
        "Daniela", "Mariana", "Victoria", "Catalina", "Francisca", "Josefa", "Juana", "Belén", "Sara", "Elena"
    ]
    apellidos = [
        "García", "Rodríguez", "Hernández", "López", "González", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores",
        "Rivera", "Gómez", "Díaz", "Reyes", "Cruz", "Morales", "Ortiz", "Gutiérrez", "Chávez", "Ramos"
    ]
    
    total_alumnos = 0
    
    for i, colegio in enumerate(colegios):
        # 5 alumnos por curso = 20 por colegio
        for curso_idx, curso in enumerate(cursos):
            for j in range(5):
                # Mezclar hombres y mujeres
                if random.random() > 0.5:
                    nombre = random.choice(nombres_hombres)
                else:
                    nombre = random.choice(nombres_mujeres)
                
                apellido = random.choice(apellidos)
                segundo_apellido = random.choice(apellidos)
                
                # Evitar duplicados de nombre completo
                nombre_completo = f"{nombre} {apellido} {segundo_apellido}"
                
                # Ensure unique RUT per school
                existing_ruts = [a.rut for a in db.query(Alumno).filter(Alumno.colegio_id == colegio.id).all()]
                rut = generate_rut()
                while rut in existing_ruts:
                    rut = generate_rut()
                
                alumno = Alumno(
                    rut=rut,
                    nombre_completo=nombre_completo,
                    curso=curso,
                    is_active=True,
                    colegio_id=colegio.id
                )
                db.add(alumno)
                total_alumnos += 1
    
    db.commit()
    print(f">>> {total_alumnos} alumnos creados")
    return db.query(Alumno).all()


def create_talleres(db: Session, colegios: list, usuarios: list):
    """Crear talleres"""
    print(">>> Creando talleres...")
    
    talleres_data = [
        {"nombre_taller": "Computación", "cupos_maximos": 15},
        {"nombre_taller": "Fútbol", "cupos_maximos": 20},
        {"nombre_taller": "Voleibol", "cupos_maximos": 15},
        {"nombre_taller": "Tenis de Mesa", "cupos_maximos": 10},
    ]
    
    # Extraer solo extraescolares
    extraescolares = [u for u in usuarios if u.rol == RolEnum.extraescolar]
    
    talleres = []
    for i, colegio in enumerate(colegios):
        # Obtener extraescolares de este colegio
        extraescolares_colegio = [e for e in extraescolares if e.colegio_id == colegio.id]
        
        for j, taller_data in enumerate(talleres_data):
            # Asignar un profesor (cíclicamente)
            profesor = extraescolares_colegio[j % len(extraescolares_colegio)]
            
            taller = Taller(
                nombre_taller=taller_data["nombre_taller"],
                cupos_maximos=taller_data["cupos_maximos"],
                is_active=True,
                profesor_id=profesor.id,
                colegio_id=colegio.id
            )
            db.add(taller)
            talleres.append(taller)
    
    db.commit()
    for t in talleres:
        db.refresh(t)
    
    print(f">>> {len(talleres)} talleres creados")
    return talleres


def create_inscripciones(db: Session, alumnos: list, talleres: list):
    """Crear inscripciones"""
    print(">>> Creando inscripciones...")
    
    # Agrupar alumnos por colegio
    alumnos_por_colegio = {}
    for a in alumnos:
        if a.colegio_id not in alumnos_por_colegio:
            alumnos_por_colegio[a.colegio_id] = []
        alumnos_por_colegio[a.colegio_id].append(a)
    
    # Agrupar talleres por colegio
    talleres_por_colegio = {}
    for t in talleres:
        if t.colegio_id not in talleres_por_colegio:
            talleres_por_colegio[t.colegio_id] = []
        talleres_por_colegio[t.colegio_id].append(t)
    
    inscripciones_count = 0
    
    for colegio_id in alumnos_por_colegio:
        alumnos_colegio = alumnos_por_colegio[colegio_id]
        talleres_colegio = talleres_por_colegio.get(colegio_id, [])
        
        for taller in talleres_colegio:
            # Inscribir 80% de los cupos
            num_inscripciones = int(taller.cupos_maximos * 0.8)
            
            # Mezclar alumnos y seleccionar
            disponibles = [a for a in alumnos_colegio if a.is_active]
            random.shuffle(disponibles)
            
            # Evitar inscripciones duplicadas
            existentes = set(
                (i.alumno_id, i.taller_id) 
                for i in db.query(Inscripcion).filter(Inscripcion.taller_id == taller.id).all()
            )
            
            for k, alumno in enumerate(disponibles[:num_inscripciones]):
                if (alumno.id, taller.id) in existentes:
                    continue
                    
                # 90% activos, 10% retirados
                estado = "inscrito" if random.random() > 0.1 else "retirado"
                
                inscripcion = Inscripcion(
                    taller_id=taller.id,
                    alumno_id=alumno.id,
                    estado=estado,
                    colegio_id=colegio_id
                )
                db.add(inscripcion)
                inscripciones_count += 1
    
    db.commit()
    print(f">>> {inscripciones_count} inscripciones creadas")
    return db.query(Inscripcion).filter(Inscripcion.estado == "inscrito").all()


def create_sesiones(db: Session, talleres: list, usuarios: list):
    """Crear sesiones"""
    print(">>> Creando sesiones...")
    
    # Extraer usuarios activos
    usuarios_activos = [u for u in usuarios if u.is_active]
    
    temas_por_taller = {
        "Computación": ["Introducción a la programación", "Estructuras de datos", "Desarrollo web", "Proyecto final"],
        "Fútbol": ["Técnica individual", "Juego en equipo", "Táctica y estrategia", "Partido"],
        "Voleibol": ["Fundamentos básicos", "Remate y bloqueo", "Sistema de juego", "Partido"],
        "Tenis de Mesa": ["Posición y agarre", "Servicios", "Golpes básicos", "Partido"],
    }
    
    sesiones_count = 0
    hoy = datetime.now()
    
    for taller in talleres:
        temas = temas_por_taller.get(taller.nombre_taller, ["Tema 1", "Tema 2", "Tema 3", "Tema 4"])
        
        for i in range(4):
            # Una sesión por semana, hace 4 semanas
            fecha = hoy - timedelta(weeks=(3-i))
            
            sesion = Sesion(
                taller_id=taller.id,
                fecha_sesion=fecha.date(),
                tematica=temas[i],
                creado_por=random.choice(usuarios_activos).id,
                colegio_id=taller.colegio_id
            )
            db.add(sesion)
            sesiones_count += 1
    
    db.commit()
    print(f">>> {sesiones_count} sesiones creadas")
    return db.query(Sesion).all()


def create_asistencias(db: Session, sesiones: list, alumnos: list):
    """Crear asistencias"""
    print(">>> Creando asistencias...")
    
    # Agrupar inscripciones por taller
    inscripciones_por_taller = {}
    inscripciones = db.query(Inscripcion).filter(Inscripcion.estado == "inscrito").all()
    for ins in inscripciones:
        if ins.taller_id not in inscripciones_por_taller:
            inscripciones_por_taller[ins.taller_id] = []
        inscripciones_por_taller[ins.taller_id].append(ins.alumno_id)
    
    # Agrupar sesiones por taller
    sesiones_por_taller = {}
    for s in sesiones:
        if s.taller_id not in sesiones_por_taller:
            sesiones_por_taller[s.taller_id] = []
        sesiones_por_taller[s.taller_id].append(s)
    
    estados = ["presente", "presente", "presente", "presente", "presente", "presente",  # 75% presente
                "ausente",  # 15% ausente
                "justificado", "justificado",  # 8% justificado
                "atraso"]  # 2% atraso
    
    assists_count = 0
    
    for taller_id, sesiones_taller in sesiones_por_taller.items():
        inscritos = inscripciones_por_taller.get(taller_id, [])
        
        for sesion in sesiones_taller:
            for alumno_id in inscritos:
                # Evitar duplicados
                existente = db.query(Asistencia).filter(
                    Asistencia.sesion_id == sesion.id,
                    Asistencia.alumno_id == alumno_id
                ).first()
                
                if existente:
                    continue
                
                asistencia = Asistencia(
                    sesion_id=sesion.id,
                    alumno_id=alumno_id,
                    estado_asistencia=random.choice(estados),
                    observaciones="" if random.random() > 0.2 else random.choice([
                        "Falta por enfermedad",
                        "Falta familiar",
                        "Llegó tarde",
                        ""
                    ]),
                    colegio_id=sesion.colegio_id
                )
                db.add(asistencia)
                assists_count += 1
    
    db.commit()
    print(f">>> {assists_count} asistencias creadas")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Seed data para el sistema')
    parser.add_argument('--force', '-f', action='store_true', help='Limpiar y recrear datos sin preguntar')
    args = parser.parse_args()
    
    print("=" * 50)
    print("INICIANDO SCRIPT DE DATOS DE PRUEBA")
    print("=" * 50)
    
    db = SessionLocal()
    
    try:
        # Verificar si ya hay datos
        existing_colegios = db.query(Colegio).count()
        if existing_colegios > 0 and not args.force:
            print(f">>> Ya existen {existing_colegios} colegios en la base de datos")
            respuesta = input(">>> ¿Deseas limpiar y recrear? (si/no): ")
            if respuesta.lower() != "si":
                print(">>> Saliendo sin cambios")
                return
            clean_data(db)
        elif existing_colegios > 0 and args.force:
            print(f">>> Limpiando datos existentes...")
            clean_data(db)
        
        # 1. Crear colegios
        colegios = create_colegios(db)
        
        # 2. Crear usuarios
        usuarios = create_usuarios(db, colegios)
        
        # 3. Crear alumnos
        alumnos = create_alumnos(db, colegios)
        
        # 4. Crear talleres
        talleres = create_talleres(db, colegios, usuarios)
        
        # 5. Crear inscripciones
        inscripciones = create_inscripciones(db, alumnos, talleres)
        
        # 6. Crear sesiones
        sesiones = create_sesiones(db, talleres, usuarios)
        
        # 7. Crear asistencias
        create_asistencias(db, sesiones, alumnos)
        
        print("\n" + "=" * 50)
        print("RESUMEN FINAL")
        print("=" * 50)
        print(f"Colegios: {db.query(Colegio).count()}")
        print(f"Usuarios: {db.query(Usuario).count()}")
        print(f"Alumnos: {db.query(Alumno).count()}")
        print(f"Talleres: {db.query(Taller).count()}")
        print(f"Inscripciones: {db.query(Inscripcion).count()}")
        print(f"Sesiones: {db.query(Sesion).count()}")
        print(f"Asistencias: {db.query(Asistencia).count()}")
        print("\n>>> DATOS DE PRUEBA CREADOS EXITOSAMENTE")
        print("\nCredenciales de acceso:")
        print("  Admin: admin-1 / password123")
        print("  Coordinador: coord-1 / password123")
        print("  Extraescolar: prof1-1 / password123")
        
    except Exception as e:
        print(f">>> ERROR: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()

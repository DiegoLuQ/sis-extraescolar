from sqlalchemy import create_engine, text
from core.config import settings

# Motores para las bases de datos externas
mc_engine = create_engine(settings.EXTERNAL_DB_MC_URL)
dp_engine = create_engine(settings.EXTERNAL_DB_DP_URL)

def get_absent_ruts_from_external(db_name: str, fecha: str):
    """
    Obtiene los RUTs de los alumnos marcados como 'Ausente' en la base de datos externa especificada.
    db_name: 'MC' o 'DP'
    fecha: 'YYYY-MM-DD'
    """
    engine = mc_engine if db_name == 'MC' else dp_engine
    
    query = text("""
        SELECT a.rut 
        FROM asistencia_diaria ad
        JOIN alumnos a ON ad.alumno_id = a.id
        WHERE ad.fecha = :fecha AND ad.estado_napsis = 'Ausente'
    """)
    
    try:
        with engine.connect() as conn:
            result = conn.execute(query, {"fecha": fecha})
            # Limpiar RUTs (quitar puntos si los tienen, aunque vimos que no tienen)
            ruts = [row[0].replace('.', '') for row in result]
            return ruts
    except Exception as e:
        print(f"Error querying external DB {db_name}: {e}")
        return []

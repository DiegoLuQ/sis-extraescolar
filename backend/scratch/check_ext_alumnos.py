import sqlalchemy
from sqlalchemy import create_engine, text

def check_external_alumnos():
    base_url = "mysql+pymysql://mcdp_user:mcdp_password@localhost:3306/"
    engine = create_engine(base_url)
    try:
        with engine.connect() as conn:
            for db in ["colegio_asistencia_mc", "colegio_asistencia_dp"]:
                print(f"\nChecking {db}.alumnos...")
                conn.execute(text(f"USE {db};"))
                cols_result = conn.execute(text("DESCRIBE alumnos;"))
                cols = [row[0] for row in cols_result]
                print(f"Columns: {cols}")
                
                result = conn.execute(text("SELECT id, rut, nombre_completo FROM alumnos LIMIT 3;"))
                for row in result:
                    print(row)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_external_alumnos()

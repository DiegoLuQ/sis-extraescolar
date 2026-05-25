import sqlalchemy
from sqlalchemy import create_engine, text

def inspect_data():
    base_url = "mysql+pymysql://mcdp_user:mcdp_password@localhost:3306/"
    engine = create_engine(base_url)
    try:
        with engine.connect() as conn:
            for db in ["colegio_asistencia_mc", "colegio_asistencia_dp"]:
                print(f"\n--- Data from {db}.asistencia_diaria ---")
                conn.execute(text(f"USE {db};"))
                result = conn.execute(text("SELECT estado_napsis, COUNT(*) FROM asistencia_diaria GROUP BY estado_napsis;"))
                print("Counts by estado_napsis:")
                for row in result:
                    print(row)
                    
                # Also check some actual rows with their meanings if possible
                result = conn.execute(text("SELECT alumno_id, estado_napsis, fecha FROM asistencia_diaria LIMIT 5;"))
                print("\nSample rows:")
                for row in result:
                    print(row)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_data()

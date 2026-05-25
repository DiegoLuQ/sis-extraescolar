import sqlalchemy
from sqlalchemy import create_engine, text
from core.config import settings

def check_databases():
    # Base URL without DB name
    base_url = "mysql+pymysql://mcdp_user:mcdp_password@localhost:3306/"
    engine = create_engine(base_url)
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SHOW DATABASES;"))
            databases = [row[0] for row in result]
            print("Available Databases:", databases)
            
            for db in ["colegio_asistencia_mc", "colegio_asistencia_dp"]:
                if db in databases:
                    print(f"\nChecking {db}...")
                    conn.execute(text(f"USE {db};"))
                    tables_result = conn.execute(text("SHOW TABLES;"))
                    tables = [row[0] for row in tables_result]
                    print(f"Tables in {db}: {tables}")
                    
                    if "asistencia_diaria" in tables:
                        cols_result = conn.execute(text("DESCRIBE asistencia_diaria;"))
                        cols = [row[0] for row in cols_result]
                        print(f"Columns in {db}.asistencia_diaria: {cols}")
                else:
                    print(f"\nDatabase {db} NOT found.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_databases()

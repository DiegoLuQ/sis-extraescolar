import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

# Obtener variables de entorno (ajustadas al string de conexión)
# DATABASE_URL=mysql+pymysql://mcdp_user:mcdp_password@localhost:3306/asis_ext
user = "mcdp_user"
password = "mcdp_password"
database = "asis_ext"
host = "localhost"
port = 3306

try:
    connection = pymysql.connect(
        host=host,
        user=user,
        password=password,
        database=database,
        port=port
    )

    with connection.cursor() as cursor:
        print("Añadiendo columnas a la tabla 'talleres'...")
        
        # Añadir columna dia
        try:
            cursor.execute("ALTER TABLE talleres ADD COLUMN dia VARCHAR(20) NOT NULL DEFAULT 'Lunes'")
            print("Columna 'dia' añadida.")
        except Exception as e:
            print(f"Error al añadir 'dia': {e}")
            
        # Añadir columna hora_inicio
        try:
            cursor.execute("ALTER TABLE talleres ADD COLUMN hora_inicio VARCHAR(5)")
            print("Columna 'hora_inicio' añadida.")
        except Exception as e:
            print(f"Error al añadir 'hora_inicio': {e}")
            
        # Añadir columna hora_fin
        try:
            cursor.execute("ALTER TABLE talleres ADD COLUMN hora_fin VARCHAR(5)")
            print("Columna 'hora_fin' añadida.")
        except Exception as e:
            print(f"Error al añadir 'hora_fin': {e}")
            
    connection.commit()
    print("Migración completada con éxito.")

except Exception as e:
    print(f"Error de conexión: {e}")
finally:
    if 'connection' in locals():
        connection.close()

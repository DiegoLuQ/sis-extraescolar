import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

user = "mcdp_user"
password = "mcdp_password"
database = "asis_ext"
host = "localhost"
port = 3306

try:
    connection = pymysql.connect(
        host=host, user=user, password=password, database=database, port=port
    )
    with connection.cursor() as cursor:
        cursor.execute("SELECT id, nombre_taller, colegio_id FROM talleres")
        rows = cursor.fetchall()
        print("Talleres en la DB:")
        for row in rows:
            print(row)
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'connection' in locals():
        connection.close()

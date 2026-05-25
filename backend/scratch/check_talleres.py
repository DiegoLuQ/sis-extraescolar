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
        host=host,
        user=user,
        password=password,
        database=database,
        port=port
    )
    with connection.cursor() as cursor:
        cursor.execute("DESCRIBE talleres")
        columns = cursor.fetchall()
        print("Estructura de la tabla 'talleres':")
        for col in columns:
            print(col)
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'connection' in locals():
        connection.close()

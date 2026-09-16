import os

import mysql.connector


DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": os.environ["BUDGET_DB_PASSWORD"]
}


def create_database():
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    cursor.execute("CREATE DATABASE IF NOT EXISTS budget_db")

    cursor.close()
    conn.close()


def get_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password=os.environ["BUDGET_DB_PASSWORD"],
        database="budget_db"
    )


def create_table():
    conn = get_connection()
    cursor = conn.cursor()

    sql = """
    CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expense_date DATE NOT NULL,
        place VARCHAR(100) NOT NULL,
        amount INT NOT NULL,
        category VARCHAR(50) NOT NULL
    )
    """

    cursor.execute(sql)

    conn.commit()
    cursor.close()
    conn.close()
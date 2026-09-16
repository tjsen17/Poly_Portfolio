import os

# =========================
# 1. main.py
# =========================

from database import create_database, create_table
from expense import add_expense

create_database()
create_table()

expense_date = input("날짜를 입력하세요 (YYYY-MM-DD): ")
place = input("어디에 사용했나요? ")
amount = int(input("얼마를 사용했나요? "))
category = input("분류를 입력하세요: ")

add_expense(
    expense_date,
    place,
    amount,
    category
)

print("지출내역이 저장되었습니다.")


# =========================
# 2. expense.py
# =========================

from database import get_connection

def add_expense(expense_date, place, amount, category):
    conn = get_connection()
    cursor = conn.cursor()

    sql = """
    INSERT INTO expenses (
        expense_date,
        place,
        amount,
        category
    )
    VALUES (%s, %s, %s, %s)
    """

    values = (
        expense_date,
        place,
        amount,
        category
    )

    cursor.execute(sql, values)
    conn.commit()

    cursor.close()
    conn.close()


# =========================
# 3. database.py
# =========================

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
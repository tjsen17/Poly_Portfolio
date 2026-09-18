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


def get_expenses():
    conn = get_connection()
    cursor = conn.cursor()

    sql = """
    SELECT *
    FROM expenses
    ORDER BY id DESC
    """

    cursor.execute(sql)

    expenses = cursor.fetchall()

    cursor.close()
    conn.close()

    return expenses
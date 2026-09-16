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
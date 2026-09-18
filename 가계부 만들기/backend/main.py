from database import create_database, create_table
from expense import add_expense, get_expenses


create_database()
create_table()


expense_date = input("날짜를 입력하세요 (YYYY-MM-DD): ")
place = input("어디에 사용했나요? ")

amount_input = input("얼마를 사용했나요? ")

amount = int(
    amount_input
    .replace(",", "")
    .replace("원", "")
    .strip()
)

category = input("분류를 입력하세요: ")


add_expense(
    expense_date,
    place,
    amount,
    category
)


print("지출내역이 저장되었습니다.")


expenses = get_expenses()

print("\n저장된 지출내역")

for expense in expenses:
    print(
        f"지출일자 : {expense[1]}, "
        f"지출 내역 : {expense[2]}, "
        f"지출 금액 : {expense[3]:,}원, "
        f"지출 구분 : {expense[4]}"
    )
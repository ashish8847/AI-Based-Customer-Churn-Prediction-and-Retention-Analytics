import re

from src.config import BASE_DIR
from src.database import get_connection, run_query

QUERIES_PATH = BASE_DIR / "database" / "queries.sql"


def load_named_queries(path=QUERIES_PATH):
    text = path.read_text()
    parts = re.split(r"^-- name:\s*(\w+)\s*$", text, flags=re.MULTILINE)
    return {parts[i]: parts[i + 1].strip().rstrip(";") for i in range(1, len(parts), 2)}


def crud_demo():
    test_id = "TEST-0001"
    values = (test_id, "Female", "No", "No", "No", 2, "Yes", "No", "DSL", "No", "No", "No",
              "No", "No", "No", "Month-to-month", "Yes", "Electronic check", 55.5, 111.0, 0)
    conn = get_connection()
    try:
        conn.execute("DELETE FROM customers WHERE customer_id = ?", (test_id,))
        conn.execute("INSERT INTO customers VALUES (" + ",".join("?" * 21) + ")", values)
        conn.commit()
        print("INSERT ->", conn.execute(
            "SELECT customer_id, contract, monthly_charges FROM customers WHERE customer_id = ?",
            (test_id,)).fetchone()[:])

        conn.execute("UPDATE customers SET contract = 'One year', monthly_charges = 50.0 "
                     "WHERE customer_id = ?", (test_id,))
        conn.commit()
        print("UPDATE ->", conn.execute(
            "SELECT customer_id, contract, monthly_charges FROM customers WHERE customer_id = ?",
            (test_id,)).fetchone()[:])

        conn.execute("DELETE FROM customers WHERE customer_id = ?", (test_id,))
        conn.commit()
        remaining = conn.execute("SELECT COUNT(*) FROM customers WHERE customer_id = ?",
                                 (test_id,)).fetchone()[0]
        print("DELETE -> rows remaining for test customer:", remaining)
    finally:
        conn.close()


def main():
    print("=== CRUD demonstration ===")
    crud_demo()
    for name, sql in load_named_queries().items():
        print(f"\n=== {name} ===")
        print(run_query(sql).to_string(index=False))


if __name__ == "__main__":
    main()

import json
import sqlite3
from contextlib import closing

import pandas as pd

from src.config import DB_PATH, PROCESSED_DATA_PATH, SCHEMA_PATH

COLUMN_MAP = {
    "customerID": "customer_id", "gender": "gender", "SeniorCitizen": "senior_citizen",
    "Partner": "partner", "Dependents": "dependents", "tenure": "tenure",
    "PhoneService": "phone_service", "MultipleLines": "multiple_lines",
    "InternetService": "internet_service", "OnlineSecurity": "online_security",
    "OnlineBackup": "online_backup", "DeviceProtection": "device_protection",
    "TechSupport": "tech_support", "StreamingTV": "streaming_tv",
    "StreamingMovies": "streaming_movies", "Contract": "contract",
    "PaperlessBilling": "paperless_billing", "PaymentMethod": "payment_method",
    "MonthlyCharges": "monthly_charges", "TotalCharges": "total_charges", "Churn": "churn",
}

UPDATABLE_CUSTOMER_COLUMNS = {
    "contract", "payment_method", "monthly_charges", "tech_support",
    "online_security", "paperless_billing", "internet_service",
}


def get_connection(path=DB_PATH):
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(path=DB_PATH):
    with closing(get_connection(path)) as conn:
        conn.executescript(SCHEMA_PATH.read_text())
        conn.commit()


def load_customers(df, path=DB_PATH):
    data = df[list(COLUMN_MAP)].rename(columns=COLUMN_MAP)
    with closing(get_connection(path)) as conn:
        conn.execute("DELETE FROM customers")
        data.to_sql("customers", conn, if_exists="append", index=False)
        conn.commit()
    return len(data)


def load_customer_risk(scores, path=DB_PATH):
    data = scores[["customer_id", "churn_probability", "predicted_churn", "risk_level"]]
    with closing(get_connection(path)) as conn:
        conn.execute("DELETE FROM customer_risk")
        data.to_sql("customer_risk", conn, if_exists="append", index=False)
        conn.commit()
    return len(data)


def save_prediction(result, recommendations, customer_ref=None, path=DB_PATH):
    customer = result["customer"]
    with closing(get_connection(path)) as conn:
        cur = conn.execute(
            """INSERT INTO predictions (customer_ref, input_json, tenure, contract,
               monthly_charges, churn_probability, predicted_churn, risk_level)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (customer_ref, json.dumps(customer), int(customer["tenure"]), customer["Contract"],
             float(customer["MonthlyCharges"]), result["churn_probability"],
             int(result["predicted_churn"]), result["risk_level"]),
        )
        prediction_id = cur.lastrowid
        conn.executemany(
            "INSERT INTO recommendations (prediction_id, action, reason) VALUES (?, ?, ?)",
            [(prediction_id, r["action"], r["reason"]) for r in recommendations],
        )
        conn.commit()
    return prediction_id


def get_history(limit=100, path=DB_PATH):
    with closing(get_connection(path)) as conn:
        return pd.read_sql_query(
            """SELECT prediction_id, customer_ref, created_at, tenure, contract,
                      monthly_charges, churn_probability, risk_level
               FROM predictions ORDER BY prediction_id DESC LIMIT ?""",
            conn, params=(limit,))


def get_recommendations_for(prediction_id, path=DB_PATH):
    with closing(get_connection(path)) as conn:
        return pd.read_sql_query(
            "SELECT action, reason FROM recommendations WHERE prediction_id = ?",
            conn, params=(prediction_id,))


def delete_prediction(prediction_id, path=DB_PATH):
    with closing(get_connection(path)) as conn:
        cur = conn.execute("DELETE FROM predictions WHERE prediction_id = ?", (prediction_id,))
        conn.commit()
        return cur.rowcount


def clear_history(path=DB_PATH):
    with closing(get_connection(path)) as conn:
        conn.execute("DELETE FROM predictions")
        conn.commit()


def update_customer(customer_id, changes, path=DB_PATH):
    bad = set(changes) - UPDATABLE_CUSTOMER_COLUMNS
    if bad:
        raise ValueError(f"Columns not allowed for update: {sorted(bad)}")
    if not changes:
        raise ValueError("No changes given.")
    assignments = ", ".join(f"{col} = ?" for col in changes)
    with closing(get_connection(path)) as conn:
        cur = conn.execute(
            f"UPDATE customers SET {assignments} WHERE customer_id = ?",
            (*changes.values(), customer_id))
        conn.commit()
        return cur.rowcount


def run_query(sql, params=(), path=DB_PATH):
    with closing(get_connection(path)) as conn:
        return pd.read_sql_query(sql, conn, params=params)


def main():
    df = pd.read_csv(PROCESSED_DATA_PATH)
    init_db()
    print(f"Loaded {load_customers(df)} customers into {DB_PATH}")


if __name__ == "__main__":
    main()

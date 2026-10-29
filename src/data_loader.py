import pandas as pd

from src.config import ID_COLUMN, PROCESSED_DATA_PATH, RAW_DATA_PATH, TARGET


def load_raw_data(path=RAW_DATA_PATH):
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset not found at {path}. Place the CSV in data/raw/telco_churn.csv."
        )
    return pd.read_csv(path)


def clean_data(df):
    df = df.copy()
    df.columns = df.columns.str.strip()

    text_columns = df.select_dtypes(include=["object", "string"]).columns
    for col in text_columns:
        df[col] = df[col].str.strip()

    df = df.drop_duplicates(subset=ID_COLUMN)

    df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")
    new_customers = df["TotalCharges"].isna() & (df["tenure"] == 0)
    df.loc[new_customers, "TotalCharges"] = 0
    df = df.dropna(subset=["TotalCharges"])

    df["SeniorCitizen"] = df["SeniorCitizen"].map({0: "No", 1: "Yes"})
    df[TARGET] = df[TARGET].map({"No": 0, "Yes": 1})

    return df.reset_index(drop=True)


def quality_report(raw, clean):
    blank_total = int(pd.to_numeric(raw["TotalCharges"], errors="coerce").isna().sum())
    return {
        "raw_rows": int(raw.shape[0]),
        "raw_columns": int(raw.shape[1]),
        "duplicate_customer_ids": int(raw[ID_COLUMN].duplicated().sum()),
        "missing_values_raw": int(raw.isna().sum().sum()),
        "total_charges_not_numeric": blank_total,
        "rows_after_cleaning": int(clean.shape[0]),
        "missing_values_after_cleaning": int(clean.isna().sum().sum()),
        "churned": int(clean[TARGET].sum()),
        "churn_rate": round(float(clean[TARGET].mean()), 4),
    }


def main():
    raw = load_raw_data()
    print("Column types in raw data:")
    print(raw.dtypes.to_string(), "\n")

    clean = clean_data(raw)
    for key, value in quality_report(raw, clean).items():
        print(f"{key}: {value}")

    PROCESSED_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    clean.to_csv(PROCESSED_DATA_PATH, index=False)
    print(f"\nSaved cleaned data to {PROCESSED_DATA_PATH}")


if __name__ == "__main__":
    main()

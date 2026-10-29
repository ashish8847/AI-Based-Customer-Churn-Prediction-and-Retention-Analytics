import pandas as pd

from src.data_loader import clean_data


def make_raw():
    return pd.DataFrame({
        "customerID": ["A", "B", "B", "C"],
        "gender": [" Male", "Female", "Female", "Male"],
        "SeniorCitizen": [0, 1, 1, 0],
        "tenure": [5, 0, 0, 10],
        "TotalCharges": ["100.5", " ", " ", "abc"],
        "Churn": ["No", "Yes", "Yes", "No"],
    })


def test_duplicates_removed():
    assert clean_data(make_raw())["customerID"].is_unique


def test_blank_total_charges_for_new_customer_becomes_zero():
    clean = clean_data(make_raw())
    assert clean.loc[clean["customerID"] == "B", "TotalCharges"].iloc[0] == 0


def test_unfixable_total_charges_row_dropped():
    assert "C" not in clean_data(make_raw())["customerID"].tolist()


def test_types_and_encoding():
    clean = clean_data(make_raw())
    assert pd.api.types.is_numeric_dtype(clean["TotalCharges"])
    assert set(clean["Churn"].unique()) <= {0, 1}
    assert set(clean["SeniorCitizen"].unique()) <= {"Yes", "No"}


def test_whitespace_stripped():
    assert clean_data(make_raw()).loc[0, "gender"] == "Male"

from functools import lru_cache

import joblib
import pandas as pd

from src.config import (
    CATEGORICAL_FEATURES,
    CATEGORY_OPTIONS,
    FEATURES,
    HIGH_RISK_MIN,
    INTERNET_ADDONS,
    LOW_RISK_MAX,
    MODEL_PATH,
    NUMERIC_FEATURES,
)

DISCLAIMER = (
    "This is a machine learning estimate based on patterns in historical data. "
    "It is not a guarantee of what the customer will actually do."
)

FACTOR_GROUPS = {
    "Tenure and total charges": ["tenure", "TotalCharges"],
    "Monthly charges": ["MonthlyCharges"],
    "Contract type": ["Contract"],
    "Internet service": ["InternetService"],
    "Payment method": ["PaymentMethod"],
    "Paperless billing": ["PaperlessBilling"],
    "Online security": ["OnlineSecurity"],
    "Online backup": ["OnlineBackup"],
    "Device protection": ["DeviceProtection"],
    "Tech support": ["TechSupport"],
    "Streaming TV": ["StreamingTV"],
    "Streaming movies": ["StreamingMovies"],
    "Phone service / multiple lines": ["PhoneService", "MultipleLines"],
    "Senior citizen": ["SeniorCitizen"],
    "Partner": ["Partner"],
    "Dependents": ["Dependents"],
    "Gender": ["gender"],
}

NUMERIC_LIMITS = {"tenure": (0, 120), "MonthlyCharges": (0, 500), "TotalCharges": (0, 100000)}


class ValidationError(ValueError):
    def __init__(self, messages):
        self.messages = list(messages)
        super().__init__("; ".join(self.messages))


@lru_cache(maxsize=1)
def load_bundle(path=MODEL_PATH):
    if not path.exists():
        raise FileNotFoundError("Trained model not found. Run: python -m src.train")
    return joblib.load(path)


def risk_level(probability):
    if probability < LOW_RISK_MAX:
        return "Low"
    if probability < HIGH_RISK_MIN:
        return "Medium"
    return "High"


def validate_and_normalize(raw):
    errors = []
    data = dict(raw)

    for col in ("tenure", "MonthlyCharges"):
        if data.get(col) in (None, ""):
            errors.append(f"{col} is required.")
    if errors:
        raise ValidationError(errors)

    for col in NUMERIC_FEATURES:
        value = data.get(col)
        if value in (None, "") and col == "TotalCharges":
            continue
        try:
            data[col] = float(value)
        except (TypeError, ValueError):
            errors.append(f"{col} must be a number.")
            continue
        low, high = NUMERIC_LIMITS[col]
        if not low <= data[col] <= high:
            errors.append(f"{col} must be between {low} and {high}.")

    for col in CATEGORICAL_FEATURES:
        if col not in data or data[col] in (None, ""):
            errors.append(f"{col} is required.")
        elif data[col] not in CATEGORY_OPTIONS[col]:
            errors.append(f"{col} must be one of {CATEGORY_OPTIONS[col]}.")
    if errors:
        raise ValidationError(errors)

    if data["PhoneService"] == "No" and data["MultipleLines"] != "No phone service":
        errors.append("MultipleLines must be 'No phone service' when PhoneService is 'No'.")
    if data["PhoneService"] == "Yes" and data["MultipleLines"] == "No phone service":
        errors.append("MultipleLines cannot be 'No phone service' when PhoneService is 'Yes'.")
    for col in INTERNET_ADDONS:
        if data["InternetService"] == "No" and data[col] != "No internet service":
            errors.append(f"{col} must be 'No internet service' when InternetService is 'No'.")
        if data["InternetService"] != "No" and data[col] == "No internet service":
            errors.append(f"{col} cannot be 'No internet service' when the customer has internet.")
    if errors:
        raise ValidationError(errors)

    if data.get("TotalCharges") in (None, "") or pd.isna(data.get("TotalCharges")):
        data["TotalCharges"] = round(data["tenure"] * data["MonthlyCharges"], 2)
        data["_total_estimated"] = True
    return data


def _to_frame(rows):
    return pd.DataFrame(rows)[FEATURES]


def explain(customer, bundle=None, top_n=5):
    bundle = bundle or load_bundle()
    pipeline, background = bundle["pipeline"], bundle["background"]
    base_row = {col: customer[col] for col in FEATURES}
    full = float(pipeline.predict_proba(_to_frame([base_row]))[:, 1][0])

    factors = []
    for label, columns in FACTOR_GROUPS.items():
        variants = pd.DataFrame([base_row] * len(background))
        for col in columns:
            variants[col] = background[col].to_numpy()
        average_without = float(pipeline.predict_proba(variants[FEATURES])[:, 1].mean())
        impact = full - average_without
        if abs(impact) < 0.005:
            continue
        value = ", ".join(f"{c}={customer[c]}" for c in columns if c != "TotalCharges")
        factors.append({
            "factor": label,
            "value": value,
            "impact": round(impact, 4),
            "direction": "raises risk" if impact > 0 else "lowers risk",
        })
    factors.sort(key=lambda f: abs(f["impact"]), reverse=True)
    return factors[:top_n]


def predict_customer(raw, with_explanation=True):
    bundle = load_bundle()
    customer = validate_and_normalize(raw)
    probability = float(bundle["pipeline"].predict_proba(_to_frame([customer]))[:, 1][0])

    result = {
        "churn_probability": round(probability, 4),
        "predicted_churn": probability >= 0.5,
        "prediction": "Likely to churn" if probability >= 0.5 else "Likely to stay",
        "risk_level": risk_level(probability),
        "total_charges_estimated": customer.pop("_total_estimated", False),
        "customer": customer,
        "disclaimer": DISCLAIMER,
    }
    result["top_factors"] = explain(customer, bundle) if with_explanation else []
    return result


def predict_dataframe(df):
    bundle = load_bundle()
    probs = bundle["pipeline"].predict_proba(df[FEATURES])[:, 1]
    return pd.DataFrame({
        "churn_probability": probs.round(4),
        "predicted_churn": (probs >= 0.5).astype(int),
        "risk_level": [risk_level(p) for p in probs],
    }, index=df.index)

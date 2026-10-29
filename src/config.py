import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

RAW_DATA_PATH = BASE_DIR / "data" / "raw" / "telco_churn.csv"
PROCESSED_DATA_PATH = BASE_DIR / "data" / "processed" / "telco_clean.csv"
POWERBI_DATA_PATH = BASE_DIR / "data" / "processed" / "powerbi_customers.csv"
MODELS_DIR = BASE_DIR / "models"
MODEL_PATH = MODELS_DIR / "churn_model.joblib"
REPORTS_DIR = BASE_DIR / "reports"
FIGURES_DIR = REPORTS_DIR / "figures"
METRICS_PATH = REPORTS_DIR / "model_comparison.csv"
SUMMARY_PATH = REPORTS_DIR / "training_summary.json"
DB_PATH = Path(os.environ.get("CHURN_DB_PATH", BASE_DIR / "database" / "churn.db"))
SCHEMA_PATH = BASE_DIR / "database" / "schema.sql"

RANDOM_STATE = 42
TEST_SIZE = 0.2
CV_FOLDS = 5

TARGET = "Churn"
ID_COLUMN = "customerID"

NUMERIC_FEATURES = ["tenure", "MonthlyCharges", "TotalCharges"]

CATEGORICAL_FEATURES = [
    "gender", "SeniorCitizen", "Partner", "Dependents",
    "PhoneService", "MultipleLines", "InternetService",
    "OnlineSecurity", "OnlineBackup", "DeviceProtection",
    "TechSupport", "StreamingTV", "StreamingMovies",
    "Contract", "PaperlessBilling", "PaymentMethod",
]

FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES

INTERNET_ADDONS = [
    "OnlineSecurity", "OnlineBackup", "DeviceProtection",
    "TechSupport", "StreamingTV", "StreamingMovies",
]

CATEGORY_OPTIONS = {
    "gender": ["Female", "Male"],
    "SeniorCitizen": ["No", "Yes"],
    "Partner": ["No", "Yes"],
    "Dependents": ["No", "Yes"],
    "PhoneService": ["No", "Yes"],
    "MultipleLines": ["No phone service", "No", "Yes"],
    "InternetService": ["DSL", "Fiber optic", "No"],
    "OnlineSecurity": ["No internet service", "No", "Yes"],
    "OnlineBackup": ["No internet service", "No", "Yes"],
    "DeviceProtection": ["No internet service", "No", "Yes"],
    "TechSupport": ["No internet service", "No", "Yes"],
    "StreamingTV": ["No internet service", "No", "Yes"],
    "StreamingMovies": ["No internet service", "No", "Yes"],
    "Contract": ["Month-to-month", "One year", "Two year"],
    "PaperlessBilling": ["No", "Yes"],
    "PaymentMethod": [
        "Electronic check", "Mailed check",
        "Bank transfer (automatic)", "Credit card (automatic)",
    ],
}

TENURE_BINS = [-1, 12, 24, 48, 72]
TENURE_LABELS = ["0-12 months", "13-24 months", "25-48 months", "49-72 months"]

LOW_RISK_MAX = 0.30
HIGH_RISK_MIN = 0.60

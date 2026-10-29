import os
import shutil
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="churn_test_"))
_real_db = Path(__file__).resolve().parent.parent / "database" / "churn.db"
if _real_db.exists():
    shutil.copy(_real_db, _tmp / "churn.db")
os.environ["CHURN_DB_PATH"] = str(_tmp / "churn.db")

import pytest

VALID_CUSTOMER = {
    "gender": "Male", "SeniorCitizen": "No", "Partner": "No", "Dependents": "No",
    "tenure": 3, "PhoneService": "Yes", "MultipleLines": "No",
    "InternetService": "Fiber optic", "OnlineSecurity": "No", "OnlineBackup": "No",
    "DeviceProtection": "No", "TechSupport": "No", "StreamingTV": "Yes",
    "StreamingMovies": "Yes", "Contract": "Month-to-month", "PaperlessBilling": "Yes",
    "PaymentMethod": "Electronic check", "MonthlyCharges": 95.5, "TotalCharges": None,
}


@pytest.fixture
def customer():
    return dict(VALID_CUSTOMER)


@pytest.fixture
def loyal_customer():
    c = dict(VALID_CUSTOMER)
    c.update(tenure=60, MonthlyCharges=45.0, Contract="Two year", InternetService="DSL",
             OnlineSecurity="Yes", TechSupport="Yes", StreamingTV="No", StreamingMovies="No",
             PaymentMethod="Credit card (automatic)", PaperlessBilling="No")
    return c

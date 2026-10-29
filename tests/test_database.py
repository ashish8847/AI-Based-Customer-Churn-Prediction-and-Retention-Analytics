import sqlite3

import pandas as pd
import pytest

from src import database as db
from src.config import PROCESSED_DATA_PATH


@pytest.fixture
def path(tmp_path):
    p = tmp_path / "test.db"
    db.init_db(p)
    return p


@pytest.fixture
def sample_customers():
    if not PROCESSED_DATA_PATH.exists():
        pytest.skip("Run python -m src.data_loader first")
    return pd.read_csv(PROCESSED_DATA_PATH).head(20)


FAKE_RESULT = {
    "customer": {"tenure": 5, "Contract": "Month-to-month", "MonthlyCharges": 70.0},
    "churn_probability": 0.72, "predicted_churn": True, "risk_level": "High",
}
FAKE_RECS = [{"action": "Offer contract", "reason": "Because"},
             {"action": "Offer support", "reason": "Because"}]


def test_insert_and_select_customers(path, sample_customers):
    assert db.load_customers(sample_customers, path) == 20
    count = db.run_query("SELECT COUNT(*) AS n FROM customers", path=path)["n"][0]
    assert count == 20


def test_save_and_read_prediction(path):
    pid = db.save_prediction(FAKE_RESULT, FAKE_RECS, "C-1", path)
    history = db.get_history(path=path)
    assert history.loc[0, "prediction_id"] == pid
    assert history.loc[0, "risk_level"] == "High"
    assert len(db.get_recommendations_for(pid, path)) == 2


def test_delete_prediction_cascades_to_recommendations(path):
    pid = db.save_prediction(FAKE_RESULT, FAKE_RECS, None, path)
    assert db.delete_prediction(pid, path) == 1
    assert db.get_recommendations_for(pid, path).empty


def test_update_customer(path, sample_customers):
    db.load_customers(sample_customers, path)
    cid = sample_customers.iloc[0]["customerID"]
    assert db.update_customer(cid, {"contract": "Two year"}, path) == 1
    row = db.run_query("SELECT contract FROM customers WHERE customer_id = ?", (cid,), path)
    assert row["contract"][0] == "Two year"


def test_update_rejects_unlisted_column(path):
    with pytest.raises(ValueError):
        db.update_customer("X", {"churn": 1}, path)


def test_invalid_risk_level_rejected_by_constraint(path):
    bad = dict(FAKE_RESULT, risk_level="Extreme")
    with pytest.raises(sqlite3.IntegrityError):
        db.save_prediction(bad, FAKE_RECS, None, path)


def test_clear_history(path):
    db.save_prediction(FAKE_RESULT, FAKE_RECS, None, path)
    db.clear_history(path)
    assert db.get_history(path=path).empty

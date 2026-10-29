import numpy as np
import pandas as pd
import pytest

from src.config import PROCESSED_DATA_PATH
from src.preprocessing import build_preprocessor, split_data

pytestmark = pytest.mark.skipif(not PROCESSED_DATA_PATH.exists(),
                                reason="Run python -m src.data_loader first")


@pytest.fixture(scope="module")
def df():
    return pd.read_csv(PROCESSED_DATA_PATH)


def test_split_sizes_and_no_overlap(df):
    X_train, X_test, y_train, y_test = split_data(df)
    assert len(X_train) + len(X_test) == len(df)
    assert set(X_train.index).isdisjoint(X_test.index)


def test_split_is_stratified(df):
    _, _, y_train, y_test = split_data(df)
    assert abs(y_train.mean() - y_test.mean()) < 0.005


def test_id_and_target_not_in_features(df):
    X_train, *_ = split_data(df)
    assert "customerID" not in X_train.columns and "Churn" not in X_train.columns


def test_scaler_fitted_on_train_only(df):
    X_train, X_test, _, _ = split_data(df)
    pre = build_preprocessor().fit(X_train)
    scaler = pre.named_transformers_["num"]
    assert np.isclose(scaler.mean_[0], X_train["tenure"].mean())
    assert not np.isclose(scaler.mean_[0], df["tenure"].mean(), atol=1e-9)


def test_unseen_category_does_not_crash(df):
    X_train, X_test, _, _ = split_data(df)
    pre = build_preprocessor().fit(X_train)
    row = X_test.head(1).copy()
    row["PaymentMethod"] = "Cryptocurrency"
    assert pre.transform(row).shape[0] == 1

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold

from src.config import (
    CV_FOLDS, FEATURES, ID_COLUMN, POWERBI_DATA_PATH, RANDOM_STATE, TARGET,
    TENURE_BINS, TENURE_LABELS,
)
from src.database import init_db, load_customer_risk, load_customers
from src.predict import load_bundle, risk_level
from src.preprocessing import load_clean_data
from src.train import fit_pipeline, get_models, make_pipeline


def out_of_fold_scores(df, model_name):
    X, y = df[FEATURES], df[TARGET]
    pos_weight = float((y == 0).sum() / (y == 1).sum())
    skf = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    probs = np.zeros(len(df))
    for train_idx, val_idx in skf.split(X, y):
        pipe = make_pipeline(get_models(True, pos_weight)[model_name])
        fit_pipeline(pipe, X.iloc[train_idx], y.iloc[train_idx], model_name, True)
        probs[val_idx] = pipe.predict_proba(X.iloc[val_idx])[:, 1]
    return probs


def build_scored_table(df, probs):
    out = df.copy()
    out["ChurnProbability"] = probs.round(4)
    out["PredictedChurn"] = (probs >= 0.5).astype(int)
    out["RiskLevel"] = [risk_level(p) for p in probs]
    out["RiskOrder"] = out["RiskLevel"].map({"Low": 1, "Medium": 2, "High": 3})
    out["ChurnStatus"] = out[TARGET].map({0: "Active", 1: "Churned"})
    out["TenureGroup"] = pd.cut(out["tenure"], bins=TENURE_BINS, labels=TENURE_LABELS).astype(str)
    band_labels = ["Up to 35", "35-70", "70-90", "Above 90"]
    out["ChargeBand"] = pd.cut(out["MonthlyCharges"], [0, 35, 70, 90, 1000], labels=band_labels).astype(str)
    out["ChargeBandOrder"] = out["ChargeBand"].map({l: i + 1 for i, l in enumerate(band_labels)})
    out["TenureGroupOrder"] = out["TenureGroup"].map({l: i + 1 for i, l in enumerate(TENURE_LABELS)})
    return out


def main():
    df = load_clean_data()
    model_name = load_bundle()["model_name"]
    print(f"Scoring all {len(df)} customers with out-of-fold predictions ({model_name})...")
    probs = out_of_fold_scores(df, model_name)
    scored = build_scored_table(df, probs)

    scored.to_csv(POWERBI_DATA_PATH, index=False)
    print(f"Saved Power BI data to {POWERBI_DATA_PATH}")

    init_db()
    load_customers(df)
    db_scores = scored.rename(columns={
        ID_COLUMN: "customer_id", "ChurnProbability": "churn_probability",
        "PredictedChurn": "predicted_churn", "RiskLevel": "risk_level"})
    load_customer_risk(db_scores)
    print("Loaded customers and risk scores into the SQLite database.")
    print(scored["RiskLevel"].value_counts().to_string())
    print(scored.groupby("RiskLevel")[TARGET].mean().mul(100).round(2).to_string())


if __name__ == "__main__":
    main()

import json

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

from src import evaluate
from src.config import (
    CV_FOLDS,
    FEATURES,
    METRICS_PATH,
    MODEL_PATH,
    MODELS_DIR,
    RANDOM_STATE,
    REPORTS_DIR,
    SUMMARY_PATH,
)
from src.preprocessing import build_preprocessor, load_clean_data, split_data


def get_models(balanced=True, pos_weight=1.0):
    cw = "balanced" if balanced else None
    return {
        "Logistic Regression": LogisticRegression(
            max_iter=1000, class_weight=cw, random_state=RANDOM_STATE),
        "Decision Tree": DecisionTreeClassifier(
            max_depth=5, min_samples_leaf=20, class_weight=cw, random_state=RANDOM_STATE),
        "Random Forest": RandomForestClassifier(
            n_estimators=300, max_depth=8, min_samples_leaf=5, class_weight=cw,
            random_state=RANDOM_STATE, n_jobs=-1),
        "Gradient Boosting": GradientBoostingClassifier(
            n_estimators=150, learning_rate=0.05, max_depth=3, random_state=RANDOM_STATE),
        "XGBoost": XGBClassifier(
            n_estimators=300, learning_rate=0.05, max_depth=3, subsample=0.8,
            colsample_bytree=0.8, scale_pos_weight=pos_weight if balanced else 1.0,
            eval_metric="logloss", random_state=RANDOM_STATE, n_jobs=1),
    }


def make_pipeline(model):
    return Pipeline([("preprocess", build_preprocessor()), ("model", model)])


def fit_pipeline(pipeline, X, y, name, balanced):
    if balanced and name == "Gradient Boosting":
        pipeline.fit(X, y, model__sample_weight=compute_sample_weight("balanced", y))
    else:
        pipeline.fit(X, y)
    return pipeline


def cross_validate(name, balanced, X_train, y_train, pos_weight):
    skf = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    scores = {"f1": [], "recall": [], "roc_auc": []}
    for train_idx, val_idx in skf.split(X_train, y_train):
        X_tr, X_val = X_train.iloc[train_idx], X_train.iloc[val_idx]
        y_tr, y_val = y_train.iloc[train_idx], y_train.iloc[val_idx]
        pipe = make_pipeline(get_models(balanced, pos_weight)[name])
        fit_pipeline(pipe, X_tr, y_tr, name, balanced)
        prob = pipe.predict_proba(X_val)[:, 1]
        m = evaluate.compute_metrics(y_val, (prob >= 0.5).astype(int), prob)
        for key in scores:
            scores[key].append(m[key])
    return {k: float(np.mean(v)) for k, v in scores.items()}


def run_experiment(balanced, X_train, X_test, y_train, y_test, pos_weight):
    results = {}
    for name in get_models(balanced, pos_weight):
        cv = cross_validate(name, balanced, X_train, y_train, pos_weight)
        pipe = make_pipeline(get_models(balanced, pos_weight)[name])
        fit_pipeline(pipe, X_train, y_train, name, balanced)
        prob = pipe.predict_proba(X_test)[:, 1]
        pred = (prob >= 0.5).astype(int)
        results[name] = {
            "pipeline": pipe, "y_prob": prob, "y_pred": pred,
            "metrics": evaluate.compute_metrics(y_test, pred, prob), "cv": cv,
        }
        print(f"{name:20s} CV-F1={cv['f1']:.3f}  Test recall={results[name]['metrics']['recall']:.3f}"
              f"  Test ROC-AUC={results[name]['metrics']['roc_auc']:.3f}")
    return results


def results_to_table(results):
    rows = []
    for name, res in results.items():
        row = {"model": name}
        row.update({f"cv_{k}": v for k, v in res["cv"].items()})
        row.update({f"test_{k}": v for k, v in res["metrics"].items()})
        rows.append(row)
    return pd.DataFrame(rows)


def build_background(X_train, size=100):
    return X_train.sample(n=size, random_state=RANDOM_STATE).reset_index(drop=True)


def main():
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    df = load_clean_data()
    X_train, X_test, y_train, y_test = split_data(df)
    pos_weight = float((y_train == 0).sum() / (y_train == 1).sum())

    print("=== With class imbalance handling ===")
    results = run_experiment(True, X_train, X_test, y_train, y_test, pos_weight)
    table = results_to_table(results)

    print("\n=== Without class imbalance handling (for comparison) ===")
    plain = run_experiment(False, X_train, X_test, y_train, y_test, pos_weight)
    results_to_table(plain).to_csv(REPORTS_DIR / "imbalance_effect.csv", index=False)

    best_name = table.sort_values("cv_f1", ascending=False).iloc[0]["model"]
    best = results[best_name]
    print(f"\nSelected model (highest cross-validated F1 on training data): {best_name}")

    table["selected"] = table["model"] == best_name
    table.to_csv(METRICS_PATH, index=False)

    evaluate.plot_confusion_matrices(results, y_test)
    evaluate.plot_roc_curves(results, y_test)
    evaluate.plot_metric_comparison(table)

    skf = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    oof_pipe = make_pipeline(get_models(True, pos_weight)[best_name])
    if best_name == "Gradient Boosting":
        oof_prob = np.zeros(len(y_train))
        for tr, va in skf.split(X_train, y_train):
            p = make_pipeline(get_models(True, pos_weight)[best_name])
            fit_pipeline(p, X_train.iloc[tr], y_train.iloc[tr], best_name, True)
            oof_prob[va] = p.predict_proba(X_train.iloc[va])[:, 1]
    else:
        oof_prob = cross_val_predict(oof_pipe, X_train, y_train, cv=skf, method="predict_proba")[:, 1]
    thresholds = pd.DataFrame(evaluate.threshold_table(y_train.to_numpy(), oof_prob))
    thresholds.to_csv(REPORTS_DIR / "threshold_analysis.csv", index=False)
    print("\nThreshold analysis (cross-validated predictions on training data):")
    print(thresholds.round(3).to_string(index=False))

    perm = permutation_importance(
        best["pipeline"], X_test, y_test, scoring="roc_auc", n_repeats=10,
        random_state=RANDOM_STATE, n_jobs=1)
    importance = (
        pd.DataFrame({"feature": FEATURES, "importance": perm.importances_mean})
        .sort_values("importance", ascending=False)
    )
    importance.to_csv(REPORTS_DIR / "permutation_importance.csv", index=False)
    top = importance.head(10)
    evaluate.plot_importance(top["feature"], top["importance"],
                             f"Top 10 Features ({best_name})", "14_feature_importance")

    bundle = {
        "pipeline": best["pipeline"],
        "model_name": best_name,
        "background": build_background(X_train),
        "features": FEATURES,
        "sklearn_version": sklearn.__version__,
        "test_metrics": best["metrics"],
    }
    joblib.dump(bundle, MODEL_PATH)

    summary = {
        "train_rows": int(len(X_train)), "test_rows": int(len(X_test)),
        "selected_model": best_name, "selection_rule": "highest mean 5-fold CV F1 on training data",
        "test_metrics": best["metrics"], "sklearn_version": sklearn.__version__,
        "random_state": RANDOM_STATE,
    }
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2))
    print(f"\nSaved model to {MODEL_PATH}")
    print(table.round(4).to_string(index=False))


if __name__ == "__main__":
    main()

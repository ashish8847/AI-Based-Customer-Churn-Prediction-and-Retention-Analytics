import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

from src.config import FIGURES_DIR


def compute_metrics(y_true, y_pred, y_prob):
    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1": f1_score(y_true, y_pred, zero_division=0),
        "roc_auc": roc_auc_score(y_true, y_prob),
    }


def threshold_table(y_true, y_prob, thresholds=(0.3, 0.4, 0.5, 0.6, 0.7)):
    rows = []
    for t in thresholds:
        y_pred = (y_prob >= t).astype(int)
        rows.append({
            "threshold": t,
            "precision": precision_score(y_true, y_pred, zero_division=0),
            "recall": recall_score(y_true, y_pred, zero_division=0),
            "f1": f1_score(y_true, y_pred, zero_division=0),
            "flagged_customers": int(y_pred.sum()),
        })
    return rows


def _save(fig, name):
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / f"{name}.png", dpi=150, bbox_inches="tight")
    plt.close(fig)


def plot_confusion_matrices(results, y_test):
    n = len(results)
    fig, axes = plt.subplots(1, n, figsize=(3.4 * n, 3.4))
    for ax, (name, res) in zip(np.atleast_1d(axes), results.items()):
        cm = confusion_matrix(y_test, res["y_pred"])
        ax.imshow(cm, cmap="Blues")
        for i in range(2):
            for j in range(2):
                ax.text(j, i, cm[i, j], ha="center", va="center",
                        color="white" if cm[i, j] > cm.max() / 2 else "black", fontsize=13)
        ax.set_xticks([0, 1], ["Stay", "Churn"])
        ax.set_yticks([0, 1], ["Stay", "Churn"])
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")
        ax.set_title(name, fontsize=10)
    _save(fig, "11_confusion_matrices")


def plot_roc_curves(results, y_test):
    fig, ax = plt.subplots(figsize=(6, 5))
    for name, res in results.items():
        fpr, tpr, _ = roc_curve(y_test, res["y_prob"])
        ax.plot(fpr, tpr, label=f"{name} (AUC={res['metrics']['roc_auc']:.3f})")
    ax.plot([0, 1], [0, 1], "k--", label="Random")
    ax.set_xlabel("False positive rate")
    ax.set_ylabel("True positive rate")
    ax.set_title("ROC Curves (Test Set)")
    ax.legend(loc="lower right", fontsize=8)
    _save(fig, "12_roc_curves")


def plot_metric_comparison(table):
    metrics = ["accuracy", "precision", "recall", "f1", "roc_auc"]
    x = np.arange(len(table))
    width = 0.16
    fig, ax = plt.subplots(figsize=(10, 4.5))
    for i, metric in enumerate(metrics):
        ax.bar(x + i * width, table[f"test_{metric}"], width, label=metric)
    ax.set_xticks(x + 2 * width, table["model"], rotation=15)
    ax.set_ylim(0, 1)
    ax.set_title("Model Comparison on Test Set")
    ax.legend(ncol=5, loc="upper center", bbox_to_anchor=(0.5, -0.18))
    _save(fig, "13_model_comparison")


def plot_importance(names, values, title, name):
    order = np.argsort(values)
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.barh(np.array(names)[order], np.array(values)[order], color="#264653")
    ax.set_title(title)
    ax.set_xlabel("Drop in ROC-AUC when feature is shuffled")
    _save(fig, name)

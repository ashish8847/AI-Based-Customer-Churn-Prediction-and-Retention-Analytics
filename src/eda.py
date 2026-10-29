import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

from src.config import FIGURES_DIR, PROCESSED_DATA_PATH, TARGET, TENURE_BINS, TENURE_LABELS

sns.set_theme(style="whitegrid")
PALETTE = {0: "#2a9d8f", 1: "#e76f51"}


def load_data(path=PROCESSED_DATA_PATH):
    df = pd.read_csv(path)
    df["TenureGroup"] = pd.cut(df["tenure"], bins=TENURE_BINS, labels=TENURE_LABELS)
    df["ChurnLabel"] = df[TARGET].map({0: "Stayed", 1: "Churned"})
    return df


def churn_rate_by(df, column):
    table = (
        df.groupby(column, observed=True)[TARGET]
        .agg(customers="count", churned="sum", churn_rate="mean")
        .reset_index()
    )
    table["churn_rate"] = (table["churn_rate"] * 100).round(2)
    return table.sort_values("churn_rate", ascending=False).reset_index(drop=True)


def _finish(fig, name, save):
    fig.tight_layout()
    if save and name:
        FIGURES_DIR.mkdir(parents=True, exist_ok=True)
        fig.savefig(FIGURES_DIR / f"{name}.png", dpi=150, bbox_inches="tight")
    return fig


def plot_churn_distribution(df, save=False):
    counts = df["ChurnLabel"].value_counts().reindex(["Stayed", "Churned"])
    fig, ax = plt.subplots(figsize=(5, 4))
    bars = ax.bar(counts.index, counts.values, color=[PALETTE[0], PALETTE[1]])
    for bar, value in zip(bars, counts.values):
        ax.text(bar.get_x() + bar.get_width() / 2, value + 40,
                f"{value} ({value / len(df):.1%})", ha="center")
    ax.set_title("Overall Customer Churn")
    ax.set_ylabel("Customers")
    ax.set_ylim(0, counts.max() * 1.15)
    return _finish(fig, "01_churn_distribution", save)


def plot_rate_bar(df, column, title, name, save=False, order=None, figsize=(6, 4), rotate=0):
    table = churn_rate_by(df, column)
    if order is not None:
        table = table.set_index(column).loc[order].reset_index()
    fig, ax = plt.subplots(figsize=figsize)
    bars = ax.bar(table[column].astype(str), table["churn_rate"], color="#e76f51")
    overall = df[TARGET].mean() * 100
    ax.axhline(overall, color="gray", linestyle="--", label=f"Overall {overall:.1f}%")
    for bar, value in zip(bars, table["churn_rate"]):
        ax.text(bar.get_x() + bar.get_width() / 2, value + 0.8, f"{value:.1f}%", ha="center")
    ax.set_title(title)
    ax.set_ylabel("Churn rate (%)")
    ax.set_ylim(0, table["churn_rate"].max() * 1.2)
    ax.legend()
    plt.setp(ax.get_xticklabels(), rotation=rotate, ha="right" if rotate else "center")
    return _finish(fig, name, save)


def plot_contract(df, save=False):
    return plot_rate_bar(df, "Contract", "Churn Rate by Contract Type", "02_churn_by_contract",
                         save, order=["Month-to-month", "One year", "Two year"])


def plot_tenure_group(df, save=False):
    return plot_rate_bar(df, "TenureGroup", "Churn Rate by Tenure Group", "03_churn_by_tenure_group",
                         save, order=TENURE_LABELS)


def plot_payment(df, save=False):
    return plot_rate_bar(df, "PaymentMethod", "Churn Rate by Payment Method", "05_churn_by_payment",
                         save, figsize=(7, 4.5), rotate=20)


def plot_internet(df, save=False):
    return plot_rate_bar(df, "InternetService", "Churn Rate by Internet Service", "06_churn_by_internet",
                         save)


def plot_tenure_distribution(df, save=False):
    fig, ax = plt.subplots(figsize=(7, 4))
    sns.histplot(data=df, x="tenure", hue="ChurnLabel", bins=36, multiple="layer",
                 palette={"Stayed": PALETTE[0], "Churned": PALETTE[1]}, alpha=0.6, ax=ax)
    ax.set_title("Tenure Distribution by Churn")
    ax.set_xlabel("Tenure (months)")
    return _finish(fig, "04_tenure_distribution", save)


def plot_monthly_charges(df, save=False):
    fig, axes = plt.subplots(1, 2, figsize=(11, 4))
    sns.kdeplot(data=df, x="MonthlyCharges", hue="ChurnLabel", fill=True, common_norm=False,
                palette={"Stayed": PALETTE[0], "Churned": PALETTE[1]}, ax=axes[0])
    axes[0].set_title("Monthly Charges Density by Churn")
    sns.boxplot(data=df, x="ChurnLabel", y="MonthlyCharges", order=["Stayed", "Churned"],
                palette={"Stayed": PALETTE[0], "Churned": PALETTE[1]}, hue="ChurnLabel",
                legend=False, ax=axes[1])
    axes[1].set_title("Monthly Charges by Churn")
    axes[1].set_xlabel("")
    return _finish(fig, "07_monthly_charges", save)


def plot_correlation(df, save=False):
    numeric = df[["tenure", "MonthlyCharges", "TotalCharges", TARGET]]
    fig, ax = plt.subplots(figsize=(5.5, 4.5))
    sns.heatmap(numeric.corr(), annot=True, fmt=".2f", cmap="RdBu_r", center=0, ax=ax)
    ax.set_title("Correlation of Numeric Features")
    return _finish(fig, "08_correlation", save)


def plot_services_heatmap(df, save=False):
    columns = ["OnlineSecurity", "OnlineBackup", "DeviceProtection", "TechSupport",
               "StreamingTV", "StreamingMovies"]
    rows = {}
    for col in columns:
        rows[col] = df.groupby(col)[TARGET].mean().mul(100)
    table = pd.DataFrame(rows).T[["Yes", "No", "No internet service"]]
    fig, ax = plt.subplots(figsize=(7, 4.5))
    sns.heatmap(table, annot=True, fmt=".1f", cmap="Reds", ax=ax, cbar_kws={"label": "Churn rate (%)"})
    ax.set_title("Churn Rate (%) by Add-on Service")
    ax.set_xlabel("")
    return _finish(fig, "09_services_heatmap", save)


def plot_demographics(df, save=False):
    columns = ["gender", "SeniorCitizen", "Partner", "Dependents"]
    fig, axes = plt.subplots(1, 4, figsize=(14, 3.8), sharey=True)
    overall = df[TARGET].mean() * 100
    for ax, col in zip(axes, columns):
        table = churn_rate_by(df, col)
        ax.bar(table[col].astype(str), table["churn_rate"], color="#e76f51")
        ax.axhline(overall, color="gray", linestyle="--")
        for i, value in enumerate(table["churn_rate"]):
            ax.text(i, value + 0.8, f"{value:.1f}%", ha="center")
        ax.set_title(col)
    axes[0].set_ylabel("Churn rate (%)")
    return _finish(fig, "10_demographics", save)


def save_all_figures(df):
    for func in (plot_churn_distribution, plot_contract, plot_tenure_group, plot_tenure_distribution,
                 plot_payment, plot_internet, plot_monthly_charges, plot_correlation,
                 plot_services_heatmap, plot_demographics):
        fig = func(df, save=True)
        plt.close(fig)


if __name__ == "__main__":
    data = load_data()
    save_all_figures(data)
    for column in ["Contract", "TenureGroup", "PaymentMethod", "InternetService", "TechSupport",
                   "OnlineSecurity", "PaperlessBilling", "SeniorCitizen", "Partner", "Dependents",
                   "gender"]:
        print(churn_rate_by(data, column).to_string(index=False), "\n")
    print(data.groupby("ChurnLabel")[["tenure", "MonthlyCharges", "TotalCharges"]].agg(["mean", "median"]).round(2))
    print(data[["tenure", "MonthlyCharges", "TotalCharges", TARGET]].corr().round(3))
    print("Figures saved to reports/figures")

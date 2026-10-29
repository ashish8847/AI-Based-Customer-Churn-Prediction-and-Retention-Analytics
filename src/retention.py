import pandas as pd

from src.config import PROCESSED_DATA_PATH, TARGET, TENURE_BINS, TENURE_LABELS


def load_reference_data(path=PROCESSED_DATA_PATH):
    if not path.exists():
        return None
    df = pd.read_csv(path)
    df["TenureGroup"] = pd.cut(df["tenure"], bins=TENURE_BINS, labels=TENURE_LABELS)
    return df


def _rate(df, column, value):
    if df is None:
        return None
    subset = df[df[column] == value]
    if subset.empty:
        return None
    return subset[TARGET].mean() * 100


def _evidence(df, column, value, group_label, other_label, other_filter):
    if df is None:
        return ""
    group = _rate(df, column, value)
    others = df[df[column].isin(other_filter)][TARGET].mean() * 100
    return (f" In the dataset, {group_label} churned at {group:.1f}% "
            f"compared with {others:.1f}% for {other_label}.")


def get_recommendations(customer, risk, reference=None):
    reference = reference if reference is not None else load_reference_data()
    recs = []

    def add(action, why, evidence=""):
        recs.append({"action": action, "reason": why + evidence})

    if customer["Contract"] == "Month-to-month":
        add("Offer an incentive to move to a one-year or two-year contract.",
            "Customers with no long-term commitment can leave at any time.",
            _evidence(reference, "Contract", "Month-to-month", "month-to-month customers", "customers on one- or two-year contracts",
                      ["One year", "Two year"]))
    if customer["tenure"] <= 12:
        group_rate = None if reference is None else _rate(reference, "TenureGroup", TENURE_LABELS[0])
        later = None if reference is None else reference[reference["tenure"] > 12][TARGET].mean() * 100
        ev = "" if group_rate is None else (
            f" In the dataset, customers in their first 12 months churned at {group_rate:.1f}% "
            f"compared with {later:.1f}% for customers beyond 12 months.")
        add("Run an early-life onboarding programme with check-in calls in the first months.",
            "New customers are still deciding whether the service meets their needs.", ev)
    if customer["PaymentMethod"] == "Electronic check":
        add("Encourage a switch to automatic payment (bank transfer or credit card).",
            "Automatic payments reduce friction and missed-payment problems.",
            _evidence(reference, "PaymentMethod", "Electronic check", "electronic-check customers", "automatic-payment customers",
                      ["Bank transfer (automatic)", "Credit card (automatic)"]))
    if customer["InternetService"] != "No" and customer["TechSupport"] == "No":
        add("Offer a trial of the tech support add-on.",
            "Customers without support may struggle to resolve problems themselves.",
            _evidence(reference, "TechSupport", "No", "internet customers without tech support", "those with tech support", ["Yes"]))
    if customer["InternetService"] != "No" and customer["OnlineSecurity"] == "No":
        add("Offer a trial of online security or a bundled add-on package.",
            "Add-ons increase how much the customer uses and relies on the service.",
            _evidence(reference, "OnlineSecurity", "No", "internet customers without online security", "those with it", ["Yes"]))
    if customer["InternetService"] == "Fiber optic":
        add("Check service quality and plan fit for this fiber customer, and review pricing.",
            "Fiber plans are the most expensive and customers expect higher quality.",
            _evidence(reference, "InternetService", "Fiber optic", "fiber optic customers", "DSL customers", ["DSL"]))
    if reference is not None and customer["MonthlyCharges"] >= reference["MonthlyCharges"].quantile(0.75):
        add("Review whether a cheaper plan or a discount would better match this customer's usage.",
            "Customers on high monthly bills are more sensitive to price.",
            f" This customer's bill is in the top 25% of the dataset "
            f"(>= {reference['MonthlyCharges'].quantile(0.75):.2f}).")
    if customer["SeniorCitizen"] == "Yes":
        add("Provide assisted support and simple billing options for senior customers.",
            "This segment may need more guidance.",
            _evidence(reference, "SeniorCitizen", "Yes", "senior citizens", "non-senior customers", ["No"]))

    if risk == "Low" and not recs:
        return [{"action": "No urgent action needed. Continue regular engagement.",
                 "reason": "The predicted risk is low and no known risk pattern applies."}]
    if risk == "Low":
        recs = recs[:2]
    elif risk == "Medium":
        recs = recs[:4]
    else:
        recs = recs[:5]

    note = {"action": "Treat these as suggestions to test, not proven fixes.",
            "reason": ("They are based on associations in historical data. Their real effect on churn "
                       "should be checked, for example with an A/B test.")}
    return recs + [note]


SEGMENTS = {
    "Month-to-month contract": lambda d: d["Contract"] == "Month-to-month",
    "Tenure 0-12 months": lambda d: d["tenure"] <= 12,
    "Electronic check payment": lambda d: d["PaymentMethod"] == "Electronic check",
    "Fiber optic internet": lambda d: d["InternetService"] == "Fiber optic",
    "No tech support (internet users)": lambda d: (d["InternetService"] != "No") & (d["TechSupport"] == "No"),
    "Monthly charges >= 75th percentile": lambda d: d["MonthlyCharges"] >= d["MonthlyCharges"].quantile(0.75),
    "Senior citizens": lambda d: d["SeniorCitizen"] == "Yes",
    "Month-to-month + Fiber + Electronic check": lambda d: (
        (d["Contract"] == "Month-to-month") & (d["InternetService"] == "Fiber optic")
        & (d["PaymentMethod"] == "Electronic check")),
    "Two-year contract": lambda d: d["Contract"] == "Two year",
}


def segment_analysis(df):
    total_churners = df[TARGET].sum()
    rows = []
    for name, rule in SEGMENTS.items():
        subset = df[rule(df)]
        rows.append({
            "segment": name,
            "customers": len(subset),
            "churned": int(subset[TARGET].sum()),
            "churn_rate_pct": round(subset[TARGET].mean() * 100, 2),
            "share_of_all_churners_pct": round(subset[TARGET].sum() / total_churners * 100, 2),
        })
    return pd.DataFrame(rows).sort_values("churn_rate_pct", ascending=False).reset_index(drop=True)

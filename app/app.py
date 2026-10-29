import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st

from src import database as db
from src import eda
from src.config import (
    CATEGORY_OPTIONS, FIGURES_DIR, HIGH_RISK_MIN, INTERNET_ADDONS, LOW_RISK_MAX,
    METRICS_PATH, REPORTS_DIR, SUMMARY_PATH,
)
from src.predict import DISCLAIMER, ValidationError, load_bundle, predict_customer
from src.retention import get_recommendations, load_reference_data, segment_analysis

st.set_page_config(page_title="Customer Churn Prediction", page_icon="📉", layout="wide")

LOW_RISK_MIN_TEXT = f"{LOW_RISK_MAX:.0%}"
RISK_COLORS = {"Low": "#2a9d8f", "Medium": "#e9c46a", "High": "#e76f51"}


@st.cache_data
def get_data():
    return eda.load_data()


@st.cache_data
def read_csv(path):
    return pd.read_csv(path)


def model_ready():
    try:
        load_bundle()
        return True
    except FileNotFoundError:
        return False


def page_home():
    st.title("AI-Based Customer Churn Prediction and Retention Analytics")
    st.caption("MCA Minor Project | Artificial Intelligence and Machine Learning")
    st.write(
        "Customer churn means a customer stops using a company's service. Winning a new "
        "customer is usually harder than keeping an existing one, so finding customers who "
        "are likely to leave, and understanding why, helps a business act early."
    )
    st.write(
        "This application uses the public IBM Telco Customer Churn dataset to analyse churn "
        "patterns, compare machine learning models, score individual customers, and suggest "
        "retention actions."
    )

    data = get_data()
    col1, col2, col3 = st.columns(3)
    col1.metric("Customers in dataset", f"{len(data):,}")
    col2.metric("Churned customers", f"{int(data['Churn'].sum()):,}")
    col3.metric("Overall churn rate", f"{data['Churn'].mean():.2%}")

    if SUMMARY_PATH.exists():
        summary = json.loads(SUMMARY_PATH.read_text())
        m = summary["test_metrics"]
        st.subheader("Selected model")
        st.write(
            f"**{summary['selected_model']}** (chosen by {summary['selection_rule']}). "
            f"Held-out test results: recall {m['recall']:.3f}, precision {m['precision']:.3f}, "
            f"F1 {m['f1']:.3f}, ROC-AUC {m['roc_auc']:.3f}."
        )
    else:
        st.warning("Model not trained yet. Run `python -m src.train` first.")

    st.subheader("How to use")
    st.markdown(
        "1. **Analytics**: explore churn patterns in the data.\n"
        "2. **Model Performance**: compare the trained models.\n"
        "3. **Predict Churn**: enter a customer's details and get a risk score and advice.\n"
        "4. **Retention Analytics**: see high-risk segments and active customers worth contacting.\n"
        "5. **History**: review saved predictions."
    )
    st.info(DISCLAIMER)
    st.caption("Project guides: Reeti Jaswal (E13367) and Palwinder Kaur Mangat (E9422)")


def show_fig(fig):
    st.pyplot(fig)
    plt.close(fig)


def page_analytics():
    st.title("Exploratory Data Analysis")
    data = get_data()

    st.subheader("Filter")
    c1, c2 = st.columns(2)
    contracts = c1.multiselect("Contract", CATEGORY_OPTIONS["Contract"], CATEGORY_OPTIONS["Contract"])
    internet = c2.multiselect("Internet service", CATEGORY_OPTIONS["InternetService"],
                              CATEGORY_OPTIONS["InternetService"])
    view = data[data["Contract"].isin(contracts) & data["InternetService"].isin(internet)]
    if view.empty:
        st.warning("No customers match these filters.")
        return

    k1, k2, k3 = st.columns(3)
    k1.metric("Customers", f"{len(view):,}")
    k2.metric("Churned", f"{int(view['Churn'].sum()):,}")
    k3.metric("Churn rate", f"{view['Churn'].mean():.2%}")

    tab_names = ["Overview", "Contract", "Tenure", "Charges", "Payment", "Services", "Demographics"]
    tabs = st.tabs(tab_names)
    with tabs[0]:
        show_fig(eda.plot_churn_distribution(view))
    with tabs[1]:
        show_fig(eda.plot_contract(view)) if view["Contract"].nunique() > 1 else st.info("Select more than one contract.")
    with tabs[2]:
        show_fig(eda.plot_tenure_group(view))
        show_fig(eda.plot_tenure_distribution(view))
    with tabs[3]:
        show_fig(eda.plot_monthly_charges(view))
    with tabs[4]:
        show_fig(eda.plot_payment(view))
    with tabs[5]:
        show_fig(eda.plot_internet(view))
        show_fig(eda.plot_services_heatmap(view))
    with tabs[6]:
        show_fig(eda.plot_demographics(view))

    st.subheader("Churn rate by any feature")
    column = st.selectbox("Feature", ["Contract", "TenureGroup", "PaymentMethod", "InternetService",
                                      "TechSupport", "OnlineSecurity", "PaperlessBilling",
                                      "SeniorCitizen", "Partner", "Dependents", "gender"])
    st.dataframe(eda.churn_rate_by(view, column))


def page_models():
    st.title("Model Performance")
    if not METRICS_PATH.exists():
        st.warning("Run `python -m src.train` to generate model results.")
        return
    table = read_csv(METRICS_PATH)
    shown = table.rename(columns=lambda c: c.replace("_", " "))
    st.subheader("Comparison (held-out test set)")
    st.dataframe(shown.round(4))
    best = table[table["selected"]].iloc[0]["model"]
    st.write(f"Selected model: **{best}**, chosen by the highest 5-fold cross-validated F1 on "
             "the training data. The test set was not used for selection.")
    st.caption("Differences between models are small. See the project report for discussion.")

    st.subheader("Why recall and precision matter")
    st.write(
        "**Recall** is the share of churners the model catches. Missing a customer who leaves "
        "is costly, so recall is important. **Precision** is the share of flagged customers who "
        "really leave. Low precision wastes retention budget. **Accuracy** alone can mislead "
        "because only about 27% of customers churn. F1 balances recall and precision, and "
        "ROC-AUC measures how well the model ranks churners above non-churners."
    )

    images = [("13_model_comparison.png", "Metric comparison"), ("12_roc_curves.png", "ROC curves"),
              ("11_confusion_matrices.png", "Confusion matrices"),
              ("14_feature_importance.png", "Feature importance (selected model)")]
    for file, caption in images:
        path = FIGURES_DIR / file
        if path.exists():
            st.image(str(path), caption=caption)

    for file, title in [("imbalance_effect.csv", "Without class imbalance handling"),
                        ("threshold_analysis.csv", "Decision threshold analysis (cross-validated, training data)")]:
        path = REPORTS_DIR / file
        if path.exists():
            st.subheader(title)
            st.dataframe(read_csv(path).round(4))


def customer_form():
    st.subheader("Customer details")
    c1, c2, c3 = st.columns(3)
    with c1:
        ref = st.text_input("Customer ID (optional)", max_chars=30)
        gender = st.selectbox("Gender", CATEGORY_OPTIONS["gender"])
        senior = st.selectbox("Senior citizen", CATEGORY_OPTIONS["SeniorCitizen"])
        partner = st.selectbox("Partner", CATEGORY_OPTIONS["Partner"])
        dependents = st.selectbox("Dependents", CATEGORY_OPTIONS["Dependents"])
        tenure = st.number_input("Tenure (months)", min_value=0, max_value=120, value=12, step=1)
    with c2:
        contract = st.selectbox("Contract", CATEGORY_OPTIONS["Contract"])
        payment = st.selectbox("Payment method", CATEGORY_OPTIONS["PaymentMethod"])
        paperless = st.selectbox("Paperless billing", CATEGORY_OPTIONS["PaperlessBilling"], index=1)
        monthly = st.number_input("Monthly charges", min_value=0.0, max_value=500.0, value=70.0, step=0.05)
        estimate_total = st.checkbox("Estimate total charges (tenure x monthly charges)", value=True)
        total = None
        if not estimate_total:
            total = st.number_input("Total charges", min_value=0.0, max_value=100000.0,
                                    value=float(tenure * monthly), step=1.0)
    with c3:
        phone = st.selectbox("Phone service", CATEGORY_OPTIONS["PhoneService"], index=1)
        if phone == "No":
            lines = st.selectbox("Multiple lines", ["No phone service"], disabled=True)
        else:
            lines = st.selectbox("Multiple lines", ["No", "Yes"])
        internet = st.selectbox("Internet service", CATEGORY_OPTIONS["InternetService"])
        addons = {}
        labels = {"OnlineSecurity": "Online security", "OnlineBackup": "Online backup",
                  "DeviceProtection": "Device protection", "TechSupport": "Tech support",
                  "StreamingTV": "Streaming TV", "StreamingMovies": "Streaming movies"}
        for col in INTERNET_ADDONS:
            if internet == "No":
                addons[col] = st.selectbox(labels[col], ["No internet service"], disabled=True, key=col)
            else:
                addons[col] = st.selectbox(labels[col], ["No", "Yes"], key=col)

    customer = {
        "gender": gender, "SeniorCitizen": senior, "Partner": partner, "Dependents": dependents,
        "tenure": tenure, "PhoneService": phone, "MultipleLines": lines,
        "InternetService": internet, "Contract": contract, "PaperlessBilling": paperless,
        "PaymentMethod": payment, "MonthlyCharges": monthly, "TotalCharges": total, **addons,
    }
    return customer, ref.strip() or None


def page_predict():
    st.title("Predict Customer Churn")
    if not model_ready():
        st.error("The trained model was not found. Run `python -m src.train` first.")
        return

    customer, ref = customer_form()
    if st.button("Predict churn risk", type="primary"):
        try:
            result = predict_customer(customer)
            recs = get_recommendations(result["customer"], result["risk_level"], load_reference_data())
            saved_id = db.save_prediction(result, recs, ref)
            st.session_state["last"] = (result, recs, saved_id)
        except ValidationError as exc:
            st.session_state.pop("last", None)
            st.error("Please correct the following:")
            for message in exc.messages:
                st.write(f"- {message}")
        except Exception as exc:
            st.session_state.pop("last", None)
            st.error(f"Something went wrong while predicting: {exc}")

    if "last" in st.session_state:
        show_result(*st.session_state["last"])


def show_result(result, recs, saved_id):
    st.divider()
    st.subheader("Result")
    score = result["churn_probability"]
    c1, c2, c3 = st.columns(3)
    c1.metric("Prediction", result["prediction"])
    c2.metric("Churn risk score", f"{score:.1%}")
    c3.markdown(
        f"**Risk category**<br><span style='font-size:2rem;color:{RISK_COLORS[result['risk_level']]}'>"
        f"{result['risk_level']}</span>", unsafe_allow_html=True)
    st.progress(min(max(score, 0.0), 1.0))
    st.caption(
        f"Low risk: below {LOW_RISK_MIN_TEXT}. Medium: {LOW_RISK_MIN_TEXT} to below {HIGH_RISK_MIN:.0%}. "
        f"High: {HIGH_RISK_MIN:.0%} or above. The score is a model output used to rank customers. "
        "Because the model was trained with class balancing, it is not a calibrated probability.")
    if result["total_charges_estimated"]:
        st.caption("Total charges were estimated as tenure x monthly charges.")

    st.subheader("Main factors behind this score")
    if result["top_factors"]:
        factors = pd.DataFrame(result["top_factors"])
        factors["impact"] = (factors["impact"] * 100).round(1)
        st.dataframe(factors.rename(columns={"impact": "effect on score (percentage points)"}))
        fig, ax = plt.subplots(figsize=(6, 3))
        colors = ["#e76f51" if v > 0 else "#2a9d8f" for v in factors["impact"]]
        ax.barh(factors["factor"][::-1], factors["impact"][::-1], color=colors[::-1])
        ax.axvline(0, color="black", linewidth=0.8)
        ax.set_xlabel("Effect on risk score (percentage points)")
        fig.tight_layout()
        show_fig(fig)
        st.caption("Each effect compares this customer with an average customer for that feature "
                   "only, so effects are approximate and do not add up exactly.")
    else:
        st.write("No single factor changed the score noticeably.")

    st.subheader("Suggested retention actions")
    for rec in recs:
        st.markdown(f"**{rec['action']}**  \n{rec['reason']}")
    st.warning(DISCLAIMER)
    st.caption(f"Saved to prediction history (ID {saved_id}).")



def page_retention():
    st.title("Retention Analytics")
    reference = load_reference_data()
    if reference is None:
        st.warning("Cleaned data not found. Run `python -m src.data_loader`.")
        return

    st.subheader("Customer segments and churn")
    st.dataframe(segment_analysis(reference))
    st.write(
        "Segments overlap, so their shares of churners add up to more than 100%. "
        "These are associations in past data, not proven causes."
    )

    st.subheader("Active customers at risk")
    try:
        risk = db.run_query(
            """SELECT c.customer_id, c.contract, c.tenure, c.internet_service, c.payment_method,
                      c.monthly_charges, r.churn_probability AS risk_score, r.risk_level
               FROM customers c JOIN customer_risk r ON r.customer_id = c.customer_id
               WHERE c.churn = 0""")
    except Exception:
        risk = pd.DataFrame()
    if risk.empty:
        st.info("No scored customers in the database. Run `python -m src.score_customers`.")
        return

    st.caption("Scores come from out-of-fold predictions, so each customer was scored by a model "
               "that did not see that customer during training.")
    c1, c2 = st.columns(2)
    levels = c1.multiselect("Risk level", ["High", "Medium", "Low"], ["High"])
    contracts = c2.multiselect("Contract", CATEGORY_OPTIONS["Contract"], CATEGORY_OPTIONS["Contract"])
    filtered = risk[risk["risk_level"].isin(levels) & risk["contract"].isin(contracts)]

    summary = risk.groupby("risk_level").agg(
        active_customers=("customer_id", "count"),
        monthly_revenue=("monthly_charges", "sum")).round(2)
    st.write("Monthly revenue from active customers by risk level")
    st.dataframe(summary)

    st.write(f"{len(filtered):,} customers match. Highest monthly charges first:")
    shown = filtered.sort_values("monthly_charges", ascending=False).head(200)
    st.dataframe(shown)
    st.download_button("Download list as CSV", shown.to_csv(index=False), "at_risk_customers.csv",
                       "text/csv")


def page_history():
    st.title("Prediction History")
    history = db.get_history()
    if history.empty:
        st.info("No predictions saved yet. Make one on the Predict Churn page.")
        return
    st.dataframe(history)

    ids = history["prediction_id"].tolist()
    chosen = st.selectbox("View recommendations for prediction ID", ids)
    recs = db.get_recommendations_for(int(chosen))
    for _, row in recs.iterrows():
        st.markdown(f"**{row['action']}**  \n{row['reason']}")

    c1, c2 = st.columns(2)
    if c1.button("Delete this prediction"):
        db.delete_prediction(int(chosen))
        st.rerun()
    confirm = c2.checkbox("I want to delete all history")
    if c2.button("Clear all history", disabled=not confirm):
        db.clear_history()
        st.rerun()


def main():
    db.init_db()
    pages = {
        "Home": page_home,
        "Analytics": page_analytics,
        "Model Performance": page_models,
        "Predict Churn": page_predict,
        "Retention Analytics": page_retention,
        "History": page_history,
    }
    choice = st.sidebar.radio("Navigation", list(pages))
    st.sidebar.divider()
    st.sidebar.caption("IBM Telco Customer Churn dataset")
    pages[choice]()


main()

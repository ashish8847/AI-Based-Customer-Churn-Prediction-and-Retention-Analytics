from src.retention import get_recommendations, load_reference_data, segment_analysis


def actions(recs):
    return " ".join(r["action"] for r in recs)


def test_high_risk_month_to_month_gets_contract_offer(customer):
    recs = get_recommendations(customer, "High", reference=None)
    assert "contract" in actions(recs).lower()
    assert len(recs) <= 6


def test_recommendations_include_testing_note(customer):
    recs = get_recommendations(customer, "High", reference=None)
    assert "not proven" in recs[-1]["action"].lower()


def test_low_risk_customer_no_urgent_action(loyal_customer):
    loyal_customer["tenure"] = 60
    recs = get_recommendations(loyal_customer, "Low", reference=None)
    assert "no urgent action" in recs[0]["action"].lower()


def test_evidence_uses_real_dataset_numbers(customer):
    reference = load_reference_data()
    if reference is None:
        return
    recs = get_recommendations(customer, "High", reference)
    assert any("%" in r["reason"] for r in recs)


def test_segment_analysis_rates_are_valid():
    reference = load_reference_data()
    if reference is None:
        return
    table = segment_analysis(reference)
    assert table["churn_rate_pct"].between(0, 100).all()
    assert (table["customers"] > 0).all()

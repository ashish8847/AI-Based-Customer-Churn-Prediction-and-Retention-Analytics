import pytest

from src.config import MODEL_PATH
from src.predict import ValidationError, predict_customer, risk_level, validate_and_normalize

needs_model = pytest.mark.skipif(not MODEL_PATH.exists(), reason="Run python -m src.train first")


def test_risk_level_boundaries():
    assert risk_level(0.0) == "Low"
    assert risk_level(0.2999) == "Low"
    assert risk_level(0.30) == "Medium"
    assert risk_level(0.5999) == "Medium"
    assert risk_level(0.60) == "High"
    assert risk_level(1.0) == "High"


def test_total_charges_estimated_when_missing(customer):
    data = validate_and_normalize(customer)
    assert data["TotalCharges"] == pytest.approx(3 * 95.5)
    assert data["_total_estimated"] is True


@pytest.mark.parametrize("field,value", [
    ("tenure", -1), ("tenure", "abc"), ("MonthlyCharges", -5), ("MonthlyCharges", 9999),
    ("Contract", "Weekly"), ("gender", ""),
])
def test_invalid_inputs_rejected(customer, field, value):
    customer[field] = value
    with pytest.raises(ValidationError):
        validate_and_normalize(customer)


def test_missing_required_field_rejected(customer):
    del customer["Contract"]
    with pytest.raises(ValidationError):
        validate_and_normalize(customer)


def test_inconsistent_phone_rejected(customer):
    customer.update(PhoneService="No", MultipleLines="Yes")
    with pytest.raises(ValidationError):
        validate_and_normalize(customer)


def test_inconsistent_internet_rejected(customer):
    customer.update(InternetService="No")
    with pytest.raises(ValidationError):
        validate_and_normalize(customer)


@needs_model
def test_prediction_output_structure(customer):
    result = predict_customer(customer)
    assert 0 <= result["churn_probability"] <= 1
    assert result["risk_level"] in {"Low", "Medium", "High"}
    assert result["prediction"] in {"Likely to churn", "Likely to stay"}
    assert "not a guarantee" in result["disclaimer"]
    assert isinstance(result["top_factors"], list)


@needs_model
def test_risky_customer_scores_higher_than_loyal_customer(customer, loyal_customer):
    risky = predict_customer(customer, with_explanation=False)["churn_probability"]
    loyal = predict_customer(loyal_customer, with_explanation=False)["churn_probability"]
    assert risky > loyal
    assert risky >= 0.6 and loyal < 0.3


@needs_model
def test_prediction_is_deterministic(customer):
    a = predict_customer(customer)["churn_probability"]
    b = predict_customer(customer)["churn_probability"]
    assert a == b

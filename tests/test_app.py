import pytest
from streamlit.testing.v1 import AppTest

from src.config import BASE_DIR, MODEL_PATH

pytestmark = pytest.mark.skipif(not MODEL_PATH.exists(), reason="Run python -m src.train first")


@pytest.fixture
def app():
    return AppTest.from_file(str(BASE_DIR / "app" / "app.py"), default_timeout=90).run()


@pytest.mark.parametrize("page", ["Home", "Analytics", "Model Performance", "Predict Churn",
                                  "Retention Analytics", "History"])
def test_every_page_loads(app, page):
    app.sidebar.radio[0].set_value(page).run()
    assert not app.exception


def test_prediction_flow_shows_risk_and_disclaimer(app):
    app.sidebar.radio[0].set_value("Predict Churn").run()
    app.button[0].click().run()
    assert not app.exception and not app.error
    labels = [m.label for m in app.metric]
    assert "Churn risk score" in labels
    assert any("not a guarantee" in w.value for w in app.warning)

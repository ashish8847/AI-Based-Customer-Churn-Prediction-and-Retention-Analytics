import json
import sys
import warnings

warnings.filterwarnings("ignore")

import pandas as pd

from src.config import CATEGORY_OPTIONS, FEATURES, HIGH_RISK_MIN, INTERNET_ADDONS, LOW_RISK_MAX, SUMMARY_PATH
from src.predict import ValidationError, load_bundle, predict_customer, predict_dataframe, validate_and_normalize
from src.retention import get_recommendations, load_reference_data

REFERENCE = load_reference_data()


def meta(_):
    summary = json.loads(SUMMARY_PATH.read_text()) if SUMMARY_PATH.exists() else {}
    return {
        "categories": CATEGORY_OPTIONS,
        "internetAddons": INTERNET_ADDONS,
        "thresholds": {"lowMax": LOW_RISK_MAX, "highMin": HIGH_RISK_MIN},
        "model": summary,
    }


def predict(payload):
    result = predict_customer(payload)
    result["recommendations"] = get_recommendations(result["customer"], result["risk_level"], REFERENCE)
    return result


def whatif(payload):
    result = predict_customer(payload, with_explanation=False)
    return {"churn_probability": result["churn_probability"], "risk_level": result["risk_level"],
            "prediction": result["prediction"]}


def batch(payload):
    valid, rows, errors = [], [], []
    for index, record in enumerate(payload["rows"], start=1):
        try:
            customer = validate_and_normalize(record)
            customer.pop("_total_estimated", None)
            valid.append((index, customer))
        except ValidationError as exc:
            errors.append({"row": index, "customerID": record.get("customerID"), "messages": exc.messages})
    if valid:
        frame = pd.DataFrame([c for _, c in valid])[FEATURES]
        scores = predict_dataframe(frame)
        for (index, customer), (_, score) in zip(valid, scores.iterrows()):
            rows.append({"row": index, "customerID": payload["rows"][index - 1].get("customerID"),
                         "churn_probability": float(score["churn_probability"]),
                         "risk_level": score["risk_level"], "predicted_churn": int(score["predicted_churn"]),
                         "tenure": customer["tenure"], "contract": customer["Contract"],
                         "monthly_charges": customer["MonthlyCharges"]})
    return {"scored": rows, "errors": errors}


ACTIONS = {"meta": meta, "predict": predict, "whatif": whatif, "batch": batch}


def respond(message):
    sys.stdout.write(json.dumps(message, default=str) + "\n")
    sys.stdout.flush()


def main():
    load_bundle()
    respond({"ready": True})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request_id = None
        try:
            request = json.loads(line)
            request_id = request.get("id")
            result = ACTIONS[request["action"]](request.get("payload") or {})
            respond({"id": request_id, "result": result})
        except ValidationError as exc:
            respond({"id": request_id, "error": {"type": "validation", "messages": exc.messages}})
        except Exception as exc:
            respond({"id": request_id, "error": {"type": "server", "messages": [str(exc)]}})


if __name__ == "__main__":
    main()

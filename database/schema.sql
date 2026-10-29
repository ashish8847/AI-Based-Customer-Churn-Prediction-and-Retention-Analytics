PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
    customer_id        TEXT PRIMARY KEY,
    gender             TEXT NOT NULL,
    senior_citizen     TEXT NOT NULL CHECK (senior_citizen IN ('Yes', 'No')),
    partner            TEXT NOT NULL,
    dependents         TEXT NOT NULL,
    tenure             INTEGER NOT NULL CHECK (tenure >= 0),
    phone_service      TEXT NOT NULL,
    multiple_lines     TEXT NOT NULL,
    internet_service   TEXT NOT NULL,
    online_security    TEXT NOT NULL,
    online_backup      TEXT NOT NULL,
    device_protection  TEXT NOT NULL,
    tech_support       TEXT NOT NULL,
    streaming_tv       TEXT NOT NULL,
    streaming_movies   TEXT NOT NULL,
    contract           TEXT NOT NULL,
    paperless_billing  TEXT NOT NULL,
    payment_method     TEXT NOT NULL,
    monthly_charges    REAL NOT NULL CHECK (monthly_charges >= 0),
    total_charges      REAL NOT NULL CHECK (total_charges >= 0),
    churn              INTEGER NOT NULL CHECK (churn IN (0, 1))
);

CREATE TABLE IF NOT EXISTS customer_risk (
    customer_id        TEXT PRIMARY KEY,
    churn_probability  REAL NOT NULL CHECK (churn_probability BETWEEN 0 AND 1),
    predicted_churn    INTEGER NOT NULL CHECK (predicted_churn IN (0, 1)),
    risk_level         TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
    scored_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers (customer_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS predictions (
    prediction_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_ref       TEXT,
    input_json         TEXT NOT NULL,
    tenure             INTEGER NOT NULL,
    contract           TEXT NOT NULL,
    monthly_charges    REAL NOT NULL,
    churn_probability  REAL NOT NULL CHECK (churn_probability BETWEEN 0 AND 1),
    predicted_churn    INTEGER NOT NULL CHECK (predicted_churn IN (0, 1)),
    risk_level         TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
    created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    result_json        TEXT
);

CREATE TABLE IF NOT EXISTS recommendations (
    recommendation_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_id      INTEGER NOT NULL,
    action             TEXT NOT NULL,
    reason             TEXT NOT NULL,
    FOREIGN KEY (prediction_id) REFERENCES predictions (prediction_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customers_contract ON customers (contract);
CREATE INDEX IF NOT EXISTS idx_risk_level ON customer_risk (risk_level);
CREATE INDEX IF NOT EXISTS idx_reco_prediction ON recommendations (prediction_id);

CREATE TABLE IF NOT EXISTS users (
    user_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username       TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin', 'analyst')),
    created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS retention_cases (
    customer_id  TEXT PRIMARY KEY,
    status       TEXT NOT NULL DEFAULT 'New'
                 CHECK (status IN ('New', 'Contacted', 'Offer sent', 'Retained', 'Lost')),
    note         TEXT,
    updated_by   TEXT,
    updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers (customer_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cases_status ON retention_cases (status);

import fs from "node:fs";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { config } from "./config.js";

export function openDb(dbPath = config.dbPath) {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(config.schemaPath, "utf8"));

  const cols = db.prepare("PRAGMA table_info(predictions)").all().map((c) => c.name);
  if (!cols.includes("result_json")) db.exec("ALTER TABLE predictions ADD COLUMN result_json TEXT");

  const hasUser = db.prepare("SELECT 1 FROM users LIMIT 1").get();
  if (!hasUser) {
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(
      config.adminUser,
      bcrypt.hashSync(config.adminPassword, 10)
    );
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'analyst')").run(
      "analyst",
      bcrypt.hashSync("analyst123", 10)
    );
  }
  return db;
}

export const FEATURE_TO_COLUMN = {
  gender: "gender", SeniorCitizen: "senior_citizen", Partner: "partner", Dependents: "dependents",
  tenure: "tenure", PhoneService: "phone_service", MultipleLines: "multiple_lines",
  InternetService: "internet_service", OnlineSecurity: "online_security", OnlineBackup: "online_backup",
  DeviceProtection: "device_protection", TechSupport: "tech_support", StreamingTV: "streaming_tv",
  StreamingMovies: "streaming_movies", Contract: "contract", PaperlessBilling: "paperless_billing",
  PaymentMethod: "payment_method", MonthlyCharges: "monthly_charges", TotalCharges: "total_charges",
};

export function rowToFeatures(row) {
  const out = {};
  for (const [feature, column] of Object.entries(FEATURE_TO_COLUMN)) out[feature] = row[column];
  return out;
}

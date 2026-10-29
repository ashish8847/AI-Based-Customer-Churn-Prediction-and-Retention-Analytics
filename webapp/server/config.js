import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const WEBAPP_DIR = path.resolve(here, "..");
export const ROOT = path.resolve(WEBAPP_DIR, "..");

function findPython() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const candidates = [
    path.join(ROOT, "venv", "Scripts", "python.exe"),
    path.join(ROOT, "venv", "bin", "python"),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return process.platform === "win32" ? "python" : "python3";
}

export const config = {
  port: Number(process.env.PORT || 3001),
  dbPath: process.env.CHURN_DB_PATH || path.join(ROOT, "database", "churn.db"),
  schemaPath: path.join(ROOT, "database", "schema.sql"),
  reportsDir: path.join(ROOT, "reports"),
  clientDist: path.join(WEBAPP_DIR, "client", "dist"),
  pythonBin: findPython(),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  adminUser: process.env.ADMIN_USER || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",
};

# Churn Insight: React + Express web application

A full-stack interface for the churn project: React (Vite) front end, Node.js + Express API, SQLite database,
and the trained scikit-learn/XGBoost model running in a small Python worker.

```
Browser (React) --HTTP/JSON--> Express API --SQL--> SQLite (database/churn.db)
                                   |
                                   +--stdin/stdout JSON--> Python ML worker (src/ml_worker.py) --> models/churn_model.joblib
```

Express starts the Python worker once and keeps it running, so predictions take milliseconds and you only
start one server. The model, validation rules and recommendations are the same ones evaluated in the report.

## Features

| Page | What it does |
|---|---|
| Login | JWT sign-in, bcrypt-hashed passwords, login rate limit, two roles (admin, analyst) |
| Dashboard | KPI cards with animated counters, 8 charts, click any bar or donut slice to cross-filter the whole page, drill through to customers |
| Predict | Validated form with dependent fields, animated risk gauge, factor explanation, evidence-backed recommendations, saved to the database, plus a **what-if simulator** that re-scores live |
| Customers | Server-side search, filters, sorting, pagination; click a row for a detail drawer and a model explanation |
| Retention | Work queue of active high-risk customers with status workflow (New, Contacted, Offer sent, Retained, Lost), notes, CSV export, segment analysis |
| Batch scoring | Drag-and-drop CSV, row-level validation, risk mix chart, scored CSV download, one-click sample data |
| Models | Real metrics from training: comparison, imbalance effect, threshold trade-off, feature importance, ROC and confusion matrices |
| History | Saved predictions with full explanation, delete (admin can clear all) |
| Everywhere | Light and dark themes, responsive layout (sidebar on desktop, bottom navigation on phones), Ctrl+K command palette, keyboard-accessible controls, reduced-motion support |

Colour palette: ice silver `#DDE3E8`, deep aubergine `#3A0F34`, gold `#EAAA00`.

## Run it on Windows (PowerShell, from the project root)

Prerequisites: Node.js 20 or 22 LTS, and the Python project already set up and trained
(`python run_pipeline.py` from the main README, or at least `python -m src.data_loader`, `python -m src.train`,
`python -m src.database`, `python -m src.score_customers`).

```powershell
cd webapp
npm run setup          # installs server and client packages
npm run build          # builds the React app into client/dist
npm start              # http://localhost:3001
```

Open http://localhost:3001 and sign in with `admin` / `admin123` (or `analyst` / `analyst123`).

Development mode with hot reload (API on 3001, React on 5173):

```powershell
npm run dev
```

Tests:

```powershell
npm test               # 20 API tests (needs the trained model and database)
```

If Node cannot find Python, point it to your interpreter:

```powershell
$env:PYTHON_BIN = "C:\path\to\churn-project\venv\Scripts\python.exe"
npm start
```

The server automatically uses `venv\Scripts\python.exe` when that folder exists.

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3001 | API and web port |
| `JWT_SECRET` | dev value | **Set this to a long random string for any real use** |
| `ADMIN_USER`, `ADMIN_PASSWORD` | admin / admin123 | Used only when the users table is empty |
| `PYTHON_BIN` | auto-detected | Python interpreter with the project requirements |
| `CHURN_DB_PATH` | database/churn.db | SQLite file |

## API overview

All routes except `POST /api/auth/login` and `GET /api/health` need `Authorization: Bearer <token>`.

| Method and path | Purpose |
|---|---|
| POST `/api/auth/login`, GET `/api/auth/me` | Authentication |
| GET `/api/meta` | Form options, risk thresholds, model summary |
| GET `/api/dashboard?contract=&internet=&payment=&risk=` | KPIs and chart data (SQL aggregation, filterable) |
| GET `/api/customers?search=&sort=&dir=&page=&pageSize=` | Paginated customers |
| GET `/api/customers/:id`, POST `/api/customers/:id/analyze` | Detail and model explanation |
| POST `/api/predict`, POST `/api/whatif`, POST `/api/batch`, GET `/api/batch/sample` | Scoring |
| GET `/api/predictions`, GET/DELETE `/api/predictions/:id`, DELETE `/api/predictions` (admin) | History |
| GET `/api/retention/queue`, PATCH `/api/retention/cases/:customerId`, GET `/api/retention/export.csv`, GET `/api/retention/segments` | Retention workflow |
| GET `/api/models` | Training results |

## Security notes

Passwords are bcrypt hashed. Tokens expire after 12 hours. All SQL uses parameters, and sorting only accepts a fixed
list of columns. `helmet` sets security headers, and login attempts are rate limited. Input to the model is validated
by the Python layer (ranges, categories, impossible combinations) and errors come back as HTTP 422 with messages.
This is a student project: change the default passwords and `JWT_SECRET`, and serve it over HTTPS if you ever expose it.

## Folder structure

```
webapp/
├── server/
│   ├── index.js        starts the ML worker and the HTTP server
│   ├── app.js          Express routes
│   ├── db.js           SQLite connection, schema, seed users
│   ├── worker.js       bridge to the Python ML worker
│   ├── auth.js         JWT and password helpers
│   ├── config.js       paths and environment settings
│   └── test/api.test.js
└── client/
    ├── src/
    │   ├── pages/      Dashboard, Predict, Customers, Retention, Batch, Models, History, Login
    │   ├── components/ Shell, charts, shared UI (gauge, factors, drawer)
    │   ├── api.js, context.jsx, styles.css
    └── dist/           production build served by Express
```

@center:16:b Testing Documentation
@center:12 AI-Based Customer Churn Prediction and Retention Analytics
@space
# 1. Test Strategy

Automated tests cover data cleaning, preprocessing, validation and prediction, retention logic, the database, the optional Streamlit application (43 pytest tests, run with `python -m pytest -q`) and the Express API (20 tests, run with `npm test` inside `webapp`). Both need the model to be trained first. Tests use a temporary copy of the database. In the final run **all 63 tests passed**. The React interface was also driven in a headless Chromium browser (desktop and phone sizes, light and dark themes) with no console errors.

# 2. Automated Test Cases

| ID | Area | Test case | Expected result | Result |
|---|---|---|---|---|
| T01 | Cleaning | Duplicate customer IDs | Only one row kept per ID | Pass |
| T02 | Cleaning | Blank TotalCharges with tenure 0 | Set to 0 | Pass |
| T03 | Cleaning | Non-numeric TotalCharges with tenure above 0 | Row dropped | Pass |
| T04 | Cleaning | Types and encoding | TotalCharges numeric, Churn 0/1, SeniorCitizen Yes/No | Pass |
| T05 | Cleaning | Leading/trailing spaces | Removed | Pass |
| T06 | Preprocessing | Train/test split | Sizes add up, no shared rows | Pass |
| T07 | Preprocessing | Stratification | Churn rates differ by less than 0.5 points | Pass |
| T08 | Preprocessing | Features | customerID and Churn not in features | Pass |
| T09 | Preprocessing | Leakage | Scaler mean equals training mean, not full-data mean | Pass |
| T10 | Preprocessing | Unseen category | Transform does not crash | Pass |
| T11 | Prediction | Risk boundaries | 0.2999 Low, 0.30 Medium, 0.60 High | Pass |
| T12 | Prediction | Missing TotalCharges | Estimated as tenure x monthly charges | Pass |
| T13 | Validation | Negative tenure, text tenure, negative or huge charges, unknown contract, empty gender | ValidationError raised (6 cases) | Pass |
| T14 | Validation | Missing required field | ValidationError raised | Pass |
| T15 | Validation | Phone service No with multiple lines Yes | ValidationError raised | Pass |
| T16 | Validation | Internet No with add-ons set to Yes/No | ValidationError raised | Pass |
| T17 | Prediction | Output structure | Score 0 to 1, valid risk level, prediction text, disclaimer, factor list | Pass |
| T18 | Prediction | Risky versus loyal customer | Risky customer scores higher (above 0.6 versus below 0.3) | Pass |
| T19 | Prediction | Repeat prediction | Identical result | Pass |
| T20 | Retention | Month-to-month, High risk | Contract suggestion included | Pass |
| T21 | Retention | Testing note | Final item says suggestions are not proven | Pass |
| T22 | Retention | Low-risk loyal customer | "No urgent action" message | Pass |
| T23 | Retention | Evidence | Reasons contain real dataset percentages | Pass |
| T24 | Retention | Segment table | Rates between 0 and 100, counts above 0 | Pass |
| T25 | Database | Insert and select | 20 sample customers stored and counted | Pass |
| T26 | Database | Save prediction | History shows it with recommendations | Pass |
| T27 | Database | Delete prediction | Recommendations deleted (cascade) | Pass |
| T28 | Database | Update customer | Contract changed | Pass |
| T29 | Database | Update disallowed column | ValueError raised | Pass |
| T30 | Database | Invalid risk level | IntegrityError from CHECK constraint | Pass |
| T31 | Database | Clear history | History empty | Pass |
| T32 | Application | Home, Analytics, Model Performance, Predict, Retention, History pages | Load without exception (6 tests) | Pass |
| T33 | Application | Predict with default form | Risk score shown, disclaimer shown, no errors | Pass |

Rows T13 and T32 each stand for several automated tests, so this table maps to all 43 Python tests.

# 2b. Automated API Test Cases (Express, 20 tests)

| ID | Area | Test case | Expected result | Result |
|---|---|---|---|---|
| A01 | Authentication | Request without token | HTTP 401 | Pass |
| A02 | Authentication | Wrong password | HTTP 401 | Pass |
| A03 | Authentication | Demo admin login | Token returned | Pass |
| A04 | Dashboard | Unfiltered KPIs | 7,043 customers, 1,869 churned, 26.54%, month-to-month 42.71% | Pass |
| A05 | Dashboard | Contract filter | Fewer customers, one contract row | Pass |
| A06 | Customers | Pagination, sorting and search | 10 rows, descending order, finds 7590-VHVEG | Pass |
| A07 | Customers | Unsafe sort value | Ignored, HTTP 200 | Pass |
| A08 | Customers | Unknown ID | HTTP 404 | Pass |
| A09 | Prediction | Score and save | HTTP 201, High risk, factors and recommendations, stored and retrievable, deletable | Pass |
| A10 | Prediction | Negative tenure | HTTP 422 with messages | Pass |
| A11 | Prediction | What-if | Lower score for two-year contract, nothing saved | Pass |
| A12 | Prediction | Analyse stored customer | Factors returned | Pass |
| A13 | Batch | Sample rows scored | 5 scored, 0 errors | Pass |
| A14 | Batch | One invalid row | 1 scored, bad row reported by ID | Pass |
| A15 | Retention | Queue | Only High-risk active customers | Pass |
| A16 | Retention | Status update and filter | Status and note saved and filterable | Pass |
| A17 | Retention | Invalid status | HTTP 400 | Pass |
| A18 | Retention | CSV export | CSV with header returned | Pass |
| A19 | Retention | Segments | Combined segment: 1,307 customers, 60.37% churn | Pass |
| A20 | Models | Training results | 5 models, XGBoost selected | Pass |

# 3. Manual Test Checklist (to be completed by you)

Start the web application (`npm start` in `webapp`, then open http://localhost:3001; sign in with admin / admin123) and record the result of each step. These were not run in a real browser during development, so please complete and sign this table before submission.

| ID | Steps | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| M01 | Open the Dashboard | KPI cards show 7,043 customers and 26.54% churn | | |
| M02 | Dashboard: select the Two year contract chip | Charts and KPIs update | | |
| M03 | Dashboard: select Two year and Fiber optic and High risk together | Empty-state message or small counts, no crash | | |
| M04 | Predict: tenure 3, monthly 95.5, month-to-month, fiber, electronic check, no add-ons | High risk, retention actions shown | | |
| M05 | Predict: tenure 60, two-year, DSL, tech support Yes, credit card | Low risk | | |
| M06 | Predict: set phone service to No | Multiple lines locked to "No phone service" | | |
| M07 | Predict: set internet to No | Add-ons locked to "No internet service" | | |
| M08 | Predict: untick estimate total charges | Total charges box appears | | |
| M09 | History page after predictions | Entries listed, explanation viewable | | |
| M10 | Delete one history entry, then clear all (admin) | Entries removed | | |
| M11 | Retention: change risk filter and export CSV | List updates, CSV downloads | | |
| M12 | Stop the server, then reload the page | Clear error that the server cannot be reached | | |
| M13 | Sign in with a wrong password | Error message, no access | | |
| M14 | Click the Contract bars on the dashboard | Whole dashboard filters, Reset clears | | |
| M15 | Predict a customer, then switch the contract in the what-if simulator | Scenario score updates | | |
| M16 | Retention: change a status, reload the page | Status is kept | | |
| M17 | Batch: Try sample data, download the scored CSV | 60 rows scored, file downloads | | |
| M18 | Toggle dark theme, press Ctrl+K and type a customer ID | Theme persists, palette finds the customer | | |
| M19 | Open the app on a phone or narrow window | Bottom navigation, no sideways scrolling of the page | | |

# 4. Results

All 63 automated tests passed (43 Python, 20 API). Manual results are to be added in Section 3.

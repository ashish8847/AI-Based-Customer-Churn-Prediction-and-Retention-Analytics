# Power BI Dashboard Guide

I could not generate the `.pbix` file for you because Power BI Desktop runs only on Windows
and the file has to be created inside it. This guide lets you build the dashboard in roughly
45-60 minutes. Every number quoted below was calculated from the project data, so you can use
them to check that your dashboard is correct.

## 1. Data to load

Use **one file**: `data/processed/powerbi_customers.csv` (7,043 rows, 30 columns).

It contains the cleaned customer data plus these columns created by `src/score_customers.py`:

| Column | Meaning |
|---|---|
| `ChurnProbability` | Model risk score (0 to 1) from out-of-fold predictions |
| `PredictedChurn` | 1 if score >= 0.5 |
| `RiskLevel`, `RiskOrder` | Low / Medium / High and its sort order (1, 2, 3) |
| `ChurnStatus` | "Active" or "Churned" |
| `TenureGroup`, `TenureGroupOrder` | 0-12, 13-24, 25-48, 49-72 months |
| `ChargeBand`, `ChargeBandOrder` | Up to 35, 35-70, 70-90, Above 90 |

Out-of-fold means each customer's score came from a model that did not train on that customer,
so the risk levels are an honest reflection of model performance and are not inflated.

## 2. Steps in Power BI Desktop

1. **Home > Get data > Text/CSV**, choose the file, click **Transform Data**.
2. In Power Query check the types: `tenure`, `ChurnProbability`, `MonthlyCharges`, `TotalCharges` as
   numbers; `Churn`, `PredictedChurn`, `RiskOrder`, `TenureGroupOrder`, `ChargeBandOrder` as whole numbers;
   everything else as text. **Close & Apply**.
3. Rename the table to `Customers` (right-click it in the Data pane).
4. Fix sort orders. Select the column, then **Column tools > Sort by column**:
   - `TenureGroup` sorted by `TenureGroupOrder`
   - `RiskLevel` sorted by `RiskOrder`
   - `ChargeBand` sorted by `ChargeBandOrder`
5. **View > Themes > Browse for themes** and pick `powerbi/churn_theme.json` (optional).
6. Create the measures below: **Home > New measure** (or right-click the table > New measure).

## 3. DAX measures

```DAX
Total Customers = COUNTROWS(Customers)

Churned Customers = CALCULATE(COUNTROWS(Customers), Customers[Churn] = 1)

Active Customers = [Total Customers] - [Churned Customers]

Churn Rate = DIVIDE([Churned Customers], [Total Customers])

Overall Churn Rate = CALCULATE([Churn Rate], ALL(Customers))

Churn Rate vs Overall = [Churn Rate] - [Overall Churn Rate]

Share of All Churners =
DIVIDE([Churned Customers], CALCULATE([Churned Customers], ALL(Customers)))

Avg Monthly Charges = AVERAGE(Customers[MonthlyCharges])

Avg Tenure = AVERAGE(Customers[tenure])

Avg Risk Score = AVERAGE(Customers[ChurnProbability])

High Risk Active Customers =
CALCULATE(COUNTROWS(Customers), Customers[RiskLevel] = "High", Customers[Churn] = 0)

Monthly Revenue at Risk =
CALCULATE(SUM(Customers[MonthlyCharges]), Customers[RiskLevel] = "High", Customers[Churn] = 0)

Monthly Revenue Lost to Churn =
CALCULATE(SUM(Customers[MonthlyCharges]), Customers[Churn] = 1)
```

What the important ones do:

- `CALCULATE` changes the filter context. `Churned Customers` counts rows but only where `Churn = 1`.
- `DIVIDE` is a safe division that returns blank instead of an error when the denominator is 0.
- `ALL(Customers)` removes all slicer and visual filters, so `Overall Churn Rate` stays fixed and can be
  compared with the churn rate of whatever group is currently selected.
- `Share of All Churners` shows how much of total churn sits inside the selected group.

Format `Churn Rate`, `Overall Churn Rate`, `Churn Rate vs Overall` and `Share of All Churners` as percentages.

## 4. Visuals to build

Layout suggestion: slicers in a top bar or left column, cards across the top, charts below.

| # | Visual | Fields |
|---|---|---|
| 1 | Card | `Total Customers` |
| 2 | Card | `Churned Customers` |
| 3 | Card | `Churn Rate` |
| 4 | Card | `Monthly Revenue at Risk` (optional) |
| 5 | Clustered column | X: `Contract`, Y: `Churn Rate` |
| 6 | Clustered column | X: `TenureGroup`, Y: `Churn Rate` |
| 7 | Bar chart | Y: `PaymentMethod`, X: `Churn Rate` |
| 8 | Column chart | X: `ChargeBand`, Y: `Churn Rate` (shows how churn changes with monthly charges) |
| 9 | Scatter | X: `MonthlyCharges`, Y: `tenure`, Legend: `ChurnStatus` (turn on a sample if slow) |
| 10 | Donut or column | Legend/axis: `RiskLevel`, Values: `Total Customers` (risk distribution) |
| 11 | Table | `customerID`, `Contract`, `tenure`, `MonthlyCharges`, `ChurnProbability`, `RiskLevel`, filtered to `ChurnStatus = Active` and `RiskLevel = High` |

**Slicers** (Insert > Slicer): `Contract`, `InternetService`, `TenureGroup`, `PaymentMethod`,
`RiskLevel`, `SeniorCitizen`. Use **Format > Edit interactions** if you want a visual to ignore a slicer.

For visuals 5-8 add a constant line at `Overall Churn Rate` (Analytics pane > Constant line > fx) so viewers see
which groups are above or below average.

## 5. Check your dashboard against these values

With no slicers applied, your numbers should match:

| Item | Expected value |
|---|---|
| Total customers | 7,043 |
| Churned customers | 1,869 |
| Churn rate | 26.54% |
| Churn: Month-to-month / One year / Two year | 42.71% / 11.27% / 2.83% |
| Churn: 0-12 / 13-24 / 25-48 / 49-72 months | 47.44% / 28.71% / 20.39% / 9.51% |
| Churn: Electronic check / Mailed check / Bank transfer / Credit card | 45.29% / 19.11% / 16.71% / 15.24% |
| Churn by charge band: Up to 35 / 35-70 / 70-90 / Above 90 | 10.89% / 23.94% / 37.80% / 32.78% |
| Customers per risk level: Low / Medium / High | 3,184 / 1,587 / 2,272 |
| Actual churn rate per risk level: Low / Medium / High | 5.34% / 25.39% / 57.04% |
| Active customers rated High risk | 976 (monthly charges total 73,258.35) |

If a number differs, the usual causes are a wrong data type in Power Query or a slicer left on.

## 6. Insights the dashboard supports (from the data)

- Contract type and tenure separate churners from non-churners most clearly. Month-to-month customers are
  55% of the base but about 88.6% of the churners.
- The first 12 months carry the highest churn (47.44%), so early engagement matters.
- Electronic check customers churn far more than customers on automatic payment methods.
- Churn rises with monthly charges up to the 70-90 band (37.80%) and is slightly lower above 90 (32.78%), so the
  relationship is not a straight line.
- The risk levels separate customers well: actual churn is 5.34% in Low, 25.39% in Medium and 57.04% in High.
- These are associations, not proof of cause.

## 7. Saving

Save as `powerbi/churn_dashboard.pbix`. Take screenshots of each page for your report and slides.

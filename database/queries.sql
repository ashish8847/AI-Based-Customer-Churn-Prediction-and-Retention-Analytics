-- name: overall_churn_rate
SELECT COUNT(*) AS total_customers,
       SUM(churn) AS churned_customers,
       ROUND(100.0 * SUM(churn) / COUNT(*), 2) AS churn_rate_pct
FROM customers;

-- name: churn_by_contract
SELECT contract,
       COUNT(*) AS customers,
       SUM(churn) AS churned,
       ROUND(100.0 * SUM(churn) / COUNT(*), 2) AS churn_rate_pct
FROM customers
GROUP BY contract
ORDER BY churn_rate_pct DESC;

-- name: churn_by_tenure_group
SELECT CASE
           WHEN tenure <= 12 THEN '0-12 months'
           WHEN tenure <= 24 THEN '13-24 months'
           WHEN tenure <= 48 THEN '25-48 months'
           ELSE '49-72 months'
       END AS tenure_group,
       COUNT(*) AS customers,
       SUM(churn) AS churned,
       ROUND(100.0 * SUM(churn) / COUNT(*), 2) AS churn_rate_pct
FROM customers
GROUP BY tenure_group
ORDER BY churn_rate_pct DESC;

-- name: churn_by_payment_method
SELECT payment_method,
       COUNT(*) AS customers,
       ROUND(100.0 * SUM(churn) / COUNT(*), 2) AS churn_rate_pct
FROM customers
GROUP BY payment_method
ORDER BY churn_rate_pct DESC;

-- name: high_risk_segment_contract_internet
SELECT contract, internet_service,
       COUNT(*) AS customers,
       ROUND(100.0 * SUM(churn) / COUNT(*), 2) AS churn_rate_pct
FROM customers
GROUP BY contract, internet_service
HAVING COUNT(*) >= 100
ORDER BY churn_rate_pct DESC
LIMIT 5;

-- name: risk_level_vs_actual_churn
SELECT r.risk_level,
       COUNT(*) AS customers,
       ROUND(AVG(r.churn_probability), 3) AS avg_predicted_probability,
       ROUND(100.0 * AVG(c.churn), 2) AS actual_churn_rate_pct
FROM customer_risk r
JOIN customers c ON c.customer_id = r.customer_id
GROUP BY r.risk_level
ORDER BY avg_predicted_probability DESC;

-- name: retention_target_list
SELECT c.customer_id, c.contract, c.tenure, c.monthly_charges,
       ROUND(r.churn_probability, 3) AS churn_probability
FROM customers c
JOIN customer_risk r ON r.customer_id = c.customer_id
WHERE c.churn = 0 AND r.risk_level = 'High'
ORDER BY c.monthly_charges DESC
LIMIT 10;

-- name: monthly_revenue_of_active_customers_by_risk
SELECT r.risk_level,
       COUNT(*) AS active_customers,
       ROUND(SUM(c.monthly_charges), 2) AS monthly_revenue
FROM customers c
JOIN customer_risk r ON r.customer_id = c.customer_id
WHERE c.churn = 0
GROUP BY r.risk_level
ORDER BY monthly_revenue DESC;

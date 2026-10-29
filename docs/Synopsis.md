@center:12 MCA MINOR PROJECT SYNOPSIS
@center:18:b AI-Based Customer Churn Prediction and Retention Analytics
@center:12 Submitted by: [Student Name], [Roll Number]
@center:12 Guides: Reeti Jaswal (E13367) and Palwinder Kaur Mangat (E9422)
@center:12 [Department], [University / Institute], [Academic Year]
@space
# 1. Introduction

Customer churn is the loss of existing customers. Winning a new customer is generally harder than keeping an existing one, so companies benefit from identifying customers who are likely to leave and acting early. This project builds a machine learning system that predicts churn, explains the main factors and suggests retention actions.

# 2. Problem Statement

Companies hold customer data but cannot easily tell in advance who will leave or why. A prediction without explanation or advice is of limited use to a retention team. The project develops a simple, reproducible system that predicts churn, explains drivers and links the result to practical actions.

# 3. Objectives

1. Clean and prepare a public churn dataset without data leakage.
2. Analyse churn patterns through exploratory data analysis.
3. Train and compare Logistic Regression, Decision Tree, Random Forest, Gradient Boosting and XGBoost.
4. Provide a prediction system with a risk score, risk category and main factors.
5. Generate retention suggestions linked to patterns in the data.
6. Store customers, predictions and recommendations in SQLite and analyse them with SQL.
7. Build a Power BI dashboard and a responsive React web application with a Node.js and Express API.

# 4. Scope

One public telecom dataset (IBM Telco Customer Churn, 7,043 customers), local execution on Windows, offline training. Out of scope: real-time data, cloud deployment, and measuring the real effect of retention campaigns.

# 5. Literature Review Summary

Related work covers the business value of retention (Reichheld and Sasser, 1990), reviews of churn management (Hadden et al., 2007), comparisons of machine learning methods for telecom churn (Neslin et al., 2006; Vafeiadis et al., 2015), class imbalance (Burez and Van den Poel, 2009), profit-driven evaluation (Verbeke et al., 2012) and interpretability (Verbeke et al., 2011). Full references are in the project report.

# 6. Proposed Methodology

Data cleaning, exploratory analysis, stratified split, preprocessing pipeline (scaling and one-hot encoding), training and 5-fold cross-validation of five models with class weights, evaluation using accuracy, precision, recall, F1, ROC-AUC and confusion matrix, saving the best pipeline, and deployment through a Node.js and Express API and a React web application backed by SQLite, with a Power BI dashboard.

# 7. Technology Stack

| Area | Technology |
|---|---|
| Language | Python |
| Data | Pandas, NumPy |
| Machine learning | Scikit-learn, XGBoost |
| Visualisation | Matplotlib, Seaborn, Power BI |
| Database | SQLite |
| Web application | React (Vite), Node.js, Express |
| Tools | VS Code, Jupyter Notebook |

# 8. Expected Deliverables

Cleaned dataset and preprocessing code, EDA notebook, trained model, prediction application, SQL schema and queries, Power BI dashboard, test documentation, project report, research paper, presentation and viva question bank.

# 9. Project Plan

| Phase | Activity | Duration |
|---|---|---|
| 1 | Literature review, dataset selection, setup | 1 week |
| 2 | Cleaning and EDA | 1 week |
| 3 | Model training and evaluation | 1 week |
| 4 | Prediction and retention modules | 1 week |
| 5 | Database and Power BI | 1 week |
| 6 | React and Express web application, and testing | 2 weeks |
| 7 | Report, paper and presentation | 1 week |

[Adjust durations to your university schedule.]

# 10. Expected Outcome

A working system that estimates churn risk, explains the main factors and suggests retention actions. Any performance figures will be reported only from experiments actually run.

# References

See the reference list in the project report (Reichheld and Sasser 1990; Hadden et al. 2007; Neslin et al. 2006; Burez and Van den Poel 2009; Verbeke et al. 2011 and 2012; Vafeiadis et al. 2015; Chen and Guestrin 2016; Breiman 2001; Friedman 2001; Pedregosa et al. 2011).

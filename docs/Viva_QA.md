@center:16:b Viva Questions and Answers
@center:12 AI-Based Customer Churn Prediction and Retention Analytics
@space
Numbers quoted below come from this project's actual results. If you retrain on your machine and the last decimals differ slightly, quote your own output.

# A. Project basics

**1. What is customer churn?**
When a customer stops using a company's service. In our dataset 1,869 of 7,043 customers (26.54%) churned.

**2. Why is predicting churn useful?**
A company cannot contact everyone. If it knows who is most likely to leave, it can spend retention effort on those customers first.

**3. What is your project in one sentence?**
A system that predicts which customers may leave, shows the main factors, suggests retention actions, stores results in a database, and presents them in a Streamlit app and a Power BI dashboard.

**4. Which dataset did you use and why?**
The IBM Telco Customer Churn dataset: public, widely used, 7,043 customers, mixes numeric and categorical features, and has an imbalanced target, which is realistic.

**5. What are you predicting?**
The `Churn` column, Yes or No. It is a binary classification problem.

# B. Data and preprocessing

**6. What data problems did you find?**
`TotalCharges` was stored as text, and 11 values were blank. All 11 were customers with tenure 0 (new, not yet billed), so I set them to 0. There were no duplicates and no other missing values.

**7. Why did you not delete the 11 rows?**
They are valid new customers. Deleting them would lose information and the reason for the blank is known.

**8. What is data leakage and how did you avoid it?**
Leakage is when test-set information influences training. I split the data first, and the scaler and encoder are inside a Pipeline, so they learn only from training data (also inside each cross-validation fold). I also excluded the customer ID and the target from the features.

**9. Why stratified split?**
Churners are a minority. Stratifying keeps the churn rate the same (26.54%) in train and test.

**10. Why scale numeric features and one-hot encode categories?**
Models need numbers. Scaling stops large-valued columns like `TotalCharges` dominating models such as logistic regression. One-hot encoding turns categories into 0/1 columns without implying an order.

**11. What does `handle_unknown="ignore"` do?**
If the app sees a category that was not in training, it encodes it as all zeros instead of crashing.

# C. EDA findings

**12. What are the strongest patterns?**
Month-to-month contracts (42.71% churn vs 2.83% for two-year), short tenure (47.44% in the first 12 months vs 9.51% after 48 months), electronic check payment (45.29%), fiber optic internet (41.89%), and no tech support or online security.

**13. Does gender affect churn?**
Almost not at all: 26.92% for females and 26.16% for males.

**14. Does a high bill always mean more churn?**
No. Churn rises up to the 70 to 90 band (37.80%) and is slightly lower above 90 (32.78%). The cheapest customers are mostly people without internet, who rarely leave.

**15. Does electronic check cause churn?**
We cannot say. It is an association. It may be a marker of other characteristics, such as being a newer month-to-month customer.

# D. Models and evaluation

**16. Which models did you compare and why?**
Logistic Regression (simple baseline), Decision Tree (interpretable), Random Forest (many trees, less overfitting), Gradient Boosting and XGBoost (strong on tabular data).

**17. How did you handle class imbalance?**
Class weights: mistakes on churners cost more during training (scale_pos_weight about 2.77 for XGBoost). I also trained without it to show the effect.

**18. What did imbalance handling change?**
For XGBoost, recall rose from 0.535 to 0.783 and accuracy fell from 0.809 to 0.750.

**19. Why is accuracy not enough?**
73.5% of customers stay, so a model that says "stay" for everyone is 73.5% accurate and finds no churners. Without balancing, our models had higher accuracy but caught only about half of the churners.

**20. Define precision and recall for churn.**
Precision: of the customers we flag, how many really leave (XGBoost 0.520). Recall: of the customers who really leave, how many we catch (0.783). Missing a churner is costly, so recall matters, but low precision wastes retention offers.

**21. What is ROC-AUC?**
How well the model ranks churners above non-churners across all thresholds. 0.5 is random and 1.0 is perfect. XGBoost scored 0.846.

**22. Explain your confusion matrix.**
Test set, XGBoost: 764 stayers correct, 271 stayers wrongly flagged, 81 churners missed, 293 churners found.

**23. How did you choose the final model?**
By a rule set beforehand: highest mean 5-fold cross-validated F1 on the training data. XGBoost won with 0.634. The test set was used only for final reporting.

**24. Is XGBoost clearly the best?**
No. The five models are very close. Test recall for Gradient Boosting (0.802) and Logistic Regression (0.783) differs by about 7 customers out of 374 churners, which could be chance. Logistic Regression is nearly as good and easier to explain. I report this honestly.

**25. What is cross-validation?**
Splitting the training data into 5 parts, training on 4 and validating on 1, repeating 5 times, and averaging. It gives a more stable estimate than one split.

**26. Why use a threshold of 0.5 and can it change?**
It is the default. Lowering it finds more churners but flags more customers (at 0.3: recall 0.901, precision 0.441). The best threshold depends on the cost of an offer versus the value of a customer.

**27. Which features matter most?**
Permutation importance ranks Contract first and tenure second, far above the others. This matches the EDA.

# E. Application, database and dashboard

**28. How does the prediction page work?**
The React form sends the details to the Express API. The API passes them to a Python worker that validates them, scores the customer with the saved pipeline, maps the score to Low (below 0.30), Medium or High (0.60 and above), computes the top factors and builds retention suggestions. Express then saves everything to SQLite and returns the result, which the page shows with a gauge.

**29. Is the risk score a probability?**
Not exactly. Class balancing pushes scores up, so the High group averages 0.78 but actually churned at 57%. It is a ranking score. The risk groups themselves work well: actual churn was 5.34% (Low), 25.39% (Medium) and 57.04% (High).

**30. What does "out-of-fold" mean?**
Each customer was scored by a model that did not train on that customer. This makes the dashboard risk levels honest.

**31. How do you explain a single prediction?**
For each group of features, I replace the customer's values with those of 100 random training customers, re-predict, and see how much the score changes. A positive change means that feature raised the risk. It is simple and model-independent but approximate. SHAP would be more rigorous.

**32. How are your recommendations generated and are they proven?**
Rules based on customer attributes, quoting churn rates from the data as evidence. They are not proven. They are associations and should be A/B tested.

**33. Why SQLite and not MySQL?**
No installation, one portable file, reliable for a demo. The SQL is standard and would work in MySQL with small changes.

**34. What tables did you create?**
`customers`, `customer_risk` (one-to-one with customers), `predictions`, and `recommendations` (many per prediction, deleted automatically with the prediction).

**35. Name an SQL query you wrote.**
Churn rate by contract using GROUP BY, and the retention target list joining `customers` and `customer_risk` for active customers with High risk. The overall churn query returns 26.54%, matching the Python analysis.

**36. What is DAX? Give an example.**
DAX is Power BI's formula language. `Churn Rate = DIVIDE([Churned Customers], [Total Customers])`. `CALCULATE` changes the filter context and `ALL` removes filters so I can compare a group with the overall rate.

**37. Why React with Node.js and Express instead of only Python?**
It separates the interface from the machine learning, which is how real products are built. React gives an interactive responsive interface, Express provides a REST API with authentication and SQL, and the Python model is reused unchanged. A simpler Streamlit version is also included.

# F. Critical thinking

**38. What are the limitations of your work?**
Public sample dataset, single snapshot, similar model performance, small test set (374 churners), little hyperparameter tuning, uncalibrated scores, approximate explanations, untested recommendations, no cost modelling, no fairness analysis.

**39. How would you improve it?**
Use SHAP, calibrate probabilities, tune hyperparameters, choose the threshold using profit, A/B test retention actions, use time-based data and deploy online.

**40. Could this be used by a real company directly?**
Not without validation on its own data, monitoring, fairness checks and testing of the retention actions.

**41. How did you ensure reproducibility?**
Fixed random seed 42, a `requirements.txt`, a saved pipeline, a one-command pipeline script and 43 automated tests.

**42. How does Node.js use a Python model?**
Express starts one Python worker process when the server starts. The worker loads the model once and reads JSON requests from standard input and answers on standard output, so each prediction is fast and there is only one command to start the project.

**43. How is the application secured?**
Users sign in and receive a JWT that expires after 12 hours. Passwords are stored as bcrypt hashes. SQL uses parameters, sort columns come from a fixed list, helmet adds security headers, login attempts are rate limited, and model input is validated on the server. The demo passwords and signing secret must be changed for real use.

**44. What is the what-if simulator?**
It copies the predicted customer, lets the user change options such as contract or tech support, and asks the model for a new score. It shows how the model reacts. It does not prove that the change would reduce real churn.

**45. How is the interface responsive?**
CSS grid and flexible layouts adapt to the screen. On wide screens there is a sidebar, and on phones it becomes a bottom navigation bar, tables hide secondary columns, and cards stack. It supports light and dark themes using CSS variables.

**46. What is cross-filtering on the dashboard?**
Clicking a bar or donut slice adds that value as a filter. The React page sends the filters to the API, and SQL recalculates every chart and KPI.

**47. What did you learn?**
That accuracy can mislead on imbalanced data, that preprocessing must be inside the pipeline to avoid leakage, and that findings from observational data are associations, not proof of cause.

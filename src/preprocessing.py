import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from src.config import (
    CATEGORICAL_FEATURES,
    FEATURES,
    NUMERIC_FEATURES,
    PROCESSED_DATA_PATH,
    RANDOM_STATE,
    TARGET,
    TEST_SIZE,
)


def load_clean_data(path=PROCESSED_DATA_PATH):
    return pd.read_csv(path)


def split_data(df):
    X = df[FEATURES]
    y = df[TARGET]
    return train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )


def build_preprocessor():
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", drop="if_binary", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
        ]
    )


def main():
    df = load_clean_data()
    X_train, X_test, y_train, y_test = split_data(df)
    print("Train:", X_train.shape, "| Test:", X_test.shape)
    print(f"Churn rate train: {y_train.mean():.2%} | test: {y_test.mean():.2%}")

    preprocessor = build_preprocessor()
    X_train_t = preprocessor.fit_transform(X_train)
    X_test_t = preprocessor.transform(X_test)
    print("Transformed train:", X_train_t.shape, "| test:", X_test_t.shape)
    print("Encoded feature count:", len(preprocessor.get_feature_names_out()))


if __name__ == "__main__":
    main()

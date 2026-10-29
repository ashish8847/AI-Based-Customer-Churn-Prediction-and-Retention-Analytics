import subprocess
import sys

STEPS = [
    ("Cleaning data", ["-m", "src.data_loader"]),
    ("Generating EDA figures", ["-m", "src.eda"]),
    ("Training and evaluating models", ["-m", "src.train"]),
    ("Creating database and loading customers", ["-m", "src.database"]),
    ("Scoring customers and exporting Power BI data", ["-m", "src.score_customers"]),
    ("Running SQL demonstration", ["-m", "src.sql_demo"]),
    ("Running tests", ["-m", "pytest", "-q"]),
]


def main():
    for title, args in STEPS:
        print(f"\n{'=' * 70}\n{title}\n{'=' * 70}", flush=True)
        code = subprocess.call([sys.executable, *args])
        if code != 0:
            print(f"\nStopped: step '{title}' failed with exit code {code}.")
            sys.exit(code)
    print("\nAll steps finished. Start the app with: streamlit run app/app.py")


if __name__ == "__main__":
    main()

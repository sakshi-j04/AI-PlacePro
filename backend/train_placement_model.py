"""
Train the placement prediction model and save to project root.
Run once: python train_placement_model.py (from backend/ or project root).
Uses same 8 features as placement_predictor.prepare_features() / predict_with_model().
"""
import numpy as np
from pathlib import Path

# Project root: parent of backend/
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
MODEL_PATH = PROJECT_ROOT / "placement_prediction_model.pkl"

# Feature order must match placement_predictor.predict_with_model() base_features
FEATURE_NAMES = [
    "overall_score",
    "ats_score",
    "keywords_score",
    "content_score",
    "format_score",
    "skills_count_norm",
    "missing_skills_count_norm",
    "skill_ratio",
]


def generate_training_data(n_samples=2000, seed=42):
    """Generate synthetic training data that mimics real resume analysis outcomes."""
    rng = np.random.default_rng(seed)
    X = np.zeros((n_samples, len(FEATURE_NAMES)))

    for i in range(n_samples):
        # Scores 0-1 (resume quality)
        overall = rng.uniform(0.25, 0.95)
        ats = overall + rng.uniform(-0.15, 0.15)
        keywords = overall + rng.uniform(-0.12, 0.12)
        content = overall + rng.uniform(-0.1, 0.1)
        format_ = overall + rng.uniform(-0.1, 0.1)
        ats = np.clip(ats, 0, 1)
        keywords = np.clip(keywords, 0, 1)
        content = np.clip(content, 0, 1)
        format_ = np.clip(format_, 0, 1)

        skills_count = int(rng.integers(2, 22))
        missing_count = int(rng.integers(0, 14))
        skill_ratio = skills_count / max(skills_count + missing_count, 1)

        X[i, 0] = overall
        X[i, 1] = ats
        X[i, 2] = keywords
        X[i, 3] = content
        X[i, 4] = format_
        X[i, 5] = skills_count / 20.0
        X[i, 6] = missing_count / 15.0
        X[i, 7] = skill_ratio

    # Placement score 0-10: weighted combination + noise (realistic curve)
    y = (
        X[:, 0] * 3.5
        + X[:, 1] * 1.5
        + X[:, 2] * 1.2
        + X[:, 5] * 1.5
        + X[:, 7] * 1.2
        - X[:, 6] * 0.8
        + rng.uniform(-0.3, 0.3, n_samples)
    )
    y = np.clip(y, 0, 10)
    return X, y


def main():
    try:
        from sklearn.ensemble import GradientBoostingRegressor
    except ImportError:
        from sklearn.ensemble import RandomForestRegressor as GradientBoostingRegressor

    X, y = generate_training_data(n_samples=2500, seed=42)
    model = GradientBoostingRegressor(
        n_estimators=80,
        max_depth=4,
        learning_rate=0.08,
        random_state=42,
    )
    model.fit(X, y)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    import joblib
    joblib.dump(model, MODEL_PATH)
    print(f"Placement prediction model saved to: {MODEL_PATH}")
    print(f"Features: {FEATURE_NAMES}")
    print(f"n_features_in_: {getattr(model, 'n_features_in_', len(FEATURE_NAMES))}")


if __name__ == "__main__":
    main()

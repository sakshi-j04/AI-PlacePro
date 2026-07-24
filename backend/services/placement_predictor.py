"""Placement Prediction - Uses trained ML model + rule-based fallback"""
import numpy as np
from pathlib import Path

from config import MODEL_PATH

_model = None

def load_model():
    """Load the placement prediction model"""
    global _model
    if _model is not None:
        return _model
    
    if not MODEL_PATH.exists():
        return None
    
    try:
        import joblib
        _model = joblib.load(MODEL_PATH)
        return _model
    except Exception as e:
        print(f"Could not load placement model: {e}")
        return None

def prepare_features(analysis_data):
    """
    Prepare features for the placement model.
    Common features for placement prediction: skills count, scores, missing skills, etc.
    """
    scores = analysis_data.get("scores", {})
    found_skills = analysis_data.get("foundSkills", [])
    missing_skills = analysis_data.get("missingSkills", [])
    
    features = {
        "overall_score": scores.get("overall", 0) / 100,
        "ats_score": scores.get("ats", 0) / 100,
        "keywords_score": scores.get("keywords", 0) / 100,
        "content_score": scores.get("content", 0) / 100,
        "format_score": scores.get("format", 0) / 100,
        "skills_count": len(found_skills),
        "missing_skills_count": len(missing_skills),
        "skill_ratio": len(found_skills) / max(len(found_skills) + len(missing_skills), 1),
    }
    
    return features

def predict_with_model(features):
    """Try to use the trained model for prediction"""
    model = load_model()
    if model is None:
        return None
    
    try:
        # Base feature list (keep ordering stable)
        base_features = [
            features["overall_score"],
            features["ats_score"],
            features["keywords_score"],
            features["content_score"],
            features["format_score"],
            features["skills_count"] / 20,
            features["missing_skills_count"] / 15,
            features["skill_ratio"],
        ]

        # Adapt feature length to what the trained model expects to avoid
        # shape mismatch errors like "X has 8 features, but ... is expecting 7".
        if hasattr(model, "n_features_in_"):
            n_expected = int(getattr(model, "n_features_in_", len(base_features)))
            if n_expected <= len(base_features):
                used_features = base_features[:n_expected]
            else:
                # Pad with zeros if model expects more features than we define
                used_features = base_features + [0.0] * (n_expected - len(base_features))
        else:
            used_features = base_features

        feature_vector = np.array([used_features], dtype=float)
        
        prediction = model.predict(feature_vector)
        
        # Handle different model output types
        if hasattr(prediction, '__iter__') and not isinstance(prediction, str):
            score = float(prediction[0]) if len(prediction) > 0 else 5.0
        else:
            score = float(prediction)
        
        # Normalize to 0-10 scale if needed
        if score > 10:
            score = score / 10
        if score < 0:
            score = 0
        # Realism factor: slight conservatism so placement score is accurate
        score = round(score * 0.96, 1)
        return max(0.0, min(10.0, score))
    except Exception as e:
        print(f"Model prediction error: {e}")
        return None

def rule_based_prediction(analysis_data):
    """Fallback rule-based placement prediction (realistic, no inflation)"""
    scores = analysis_data.get("scores", {})
    found_skills = analysis_data.get("foundSkills", [])
    missing_skills = analysis_data.get("missingSkills", [])
    
    overall = scores.get("overall", 0)
    placement_score = (overall / 100) * 9.0
    
    if len(found_skills) >= 8:
        placement_score += 0.4
    if len(found_skills) >= 12:
        placement_score += 0.2
    if len(missing_skills) <= 5:
        placement_score += 0.15
    if len(missing_skills) > 8:
        placement_score -= 0.5
    
    placement_score = round(min(10, max(0, placement_score * 0.96)), 1)
    return placement_score

def determine_best_fit_roles(found_skills):
    """Determine best fit job roles based on skills"""
    skill_names = [s["name"].lower() for s in found_skills]
    roles = []
    
    if any(s in " ".join(skill_names) for s in ["react", "javascript", "frontend"]) and \
       any(s in " ".join(skill_names) for s in ["node", "backend", "python"]):
        roles.append("Full Stack Engineer")
    
    if any(s in " ".join(skill_names) for s in ["react", "javascript", "angular", "vue"]):
        roles.append("Frontend Developer")
    
    if any(s in " ".join(skill_names) for s in ["node", "python", "java", "backend"]):
        roles.append("Backend Developer")
    
    if any(s in " ".join(skill_names) for s in ["data", "sql", "database", "machine learning"]):
        roles.append("Data Engineer")
    
    if not roles:
        roles = ["Software Developer", "Junior Developer", "Associate Developer"]
    
    return roles[:3]

def determine_target_companies(score):
    """Target companies based on placement score"""
    if score >= 8.5:
        return ["Product-based (FAANG tier)", "Mid-size tech companies", "Startups (Series A+)"]
    elif score >= 7.0:
        return ["Mid-size tech companies", "Startups (Series A+)", "Service-based companies"]
    elif score >= 5.5:
        return ["Startups (Series A+)", "Service-based companies", "IT consulting firms"]
    else:
        return ["Service-based companies", "IT consulting firms", "Small startups"]

def estimate_salary_range(score, found_skills):
    """Estimate salary range in LPA"""
    base_min, base_max = 3, 6
    
    if score >= 8.5:
        base_min, base_max = 8, 15
    elif score >= 7.0:
        base_min, base_max = 6, 12
    elif score >= 5.5:
        base_min, base_max = 4, 8
    
    if len(found_skills) >= 10:
        base_min += 1
        base_max += 2
    
    return f"₹{base_min}-{base_max} LPA"

def generate_placement_prediction(analysis_data):
    """Generate full placement prediction"""
    features = prepare_features(analysis_data)
    
    # Try ML model first
    placement_score = predict_with_model(features)
    
    if placement_score is None:
        placement_score = rule_based_prediction(analysis_data)
    
    found_skills = analysis_data.get("foundSkills", [])
    
    if placement_score >= 8.5:
        verdict = "Excellent prospects for placement!"
        verdict_class = "success"
    elif placement_score >= 7.0:
        verdict = "Good prospects for placement!"
        verdict_class = "success"
    elif placement_score >= 5.5:
        verdict = "Moderate prospects - focus on skill improvement"
        verdict_class = "warning"
    else:
        verdict = "Needs significant improvement before placement"
        verdict_class = "danger"
    
    from datetime import datetime
    return {
        "score": round(placement_score, 1),
        "verdict": verdict,
        "verdictClass": verdict_class,
        "bestFitRoles": determine_best_fit_roles(found_skills),
        "targetCompanies": determine_target_companies(placement_score),
        "salaryRange": estimate_salary_range(placement_score, found_skills),
        "generatedAt": datetime.utcnow().isoformat() + "Z"
    }

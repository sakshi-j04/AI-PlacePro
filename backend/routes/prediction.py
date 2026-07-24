"""Placement prediction API routes"""
from flask import Blueprint, request, jsonify

from services.placement_predictor import generate_placement_prediction

prediction_bp = Blueprint("prediction", __name__)

@prediction_bp.route("/generate", methods=["POST"])
def predict():
    """
    Generate placement prediction from resume analysis data.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    analysis_data = data.get("analysis") or data.get("resumeData") or data
    
    if not isinstance(analysis_data, dict):
        return jsonify({"error": "Invalid analysis data"}), 400
    
    try:
        prediction = generate_placement_prediction(analysis_data)
        return jsonify({"success": True, **prediction})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

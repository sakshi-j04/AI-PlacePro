"""Resume analysis API routes"""
import json
import os
from datetime import datetime
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename

from config import UPLOAD_FOLDER, ALLOWED_EXTENSIONS
from services.resume_analyzer import analyze_resume
from services.placement_predictor import generate_placement_prediction
from services.job_matcher import compute_job_matches

resume_bp = Blueprint("resume", __name__)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@resume_bp.route("/analyze", methods=["POST"])
def analyze():
    """Analyze uploaded resume - NLP extraction, scoring, skill gap, placement prediction"""
    if "resume" not in request.files and "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files.get("resume") or request.files.get("file")
    
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type. Use PDF, DOC, or DOCX"}), 400
    
    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        company_job_skills = []
        job_roles_json = request.form.get("jobRoles")
        if job_roles_json:
            try:
                job_roles = json.loads(job_roles_json)
                for jr in job_roles if isinstance(job_roles, list) else [job_roles]:
                    skills = jr.get("skillsRequired", []) + jr.get("niceToHave", [])
                    company_job_skills.extend(s if isinstance(s, str) else str(s) for s in skills)
            except (json.JSONDecodeError, TypeError):
                pass
        
        if not company_job_skills:
            try:
                from data.job_roles_store import job_roles
                for jr in job_roles:
                    skills = jr.get("skillsRequired", []) + jr.get("niceToHave", [])
                    company_job_skills.extend(s if isinstance(s, str) else str(s) for s in skills)
            except ImportError:
                pass
        
        analysis = analyze_resume(filepath, company_job_skills=company_job_skills or None)
        
        # Placement prediction (uses ML model if available)
        analysis["placementPrediction"] = generate_placement_prediction(analysis)
        
        # Clean up uploaded file
        try:
            os.remove(filepath)
        except Exception:
            pass
        
        # Return in format expected by frontend
        return jsonify({
            "success": True,
            "fileName": filename,
            "uploadDate": datetime.utcnow().isoformat() + "Z",
            "scores": analysis["scores"],
            "foundSkills": analysis["foundSkills"],
            "missingSkills": analysis["missingSkills"],
            "requirements": analysis["requirements"],
            "strengths": analysis["strengths"],
            "improvements": analysis["improvements"],
            "placementPrediction": analysis["placementPrediction"]
        })
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500


@resume_bp.route("/job-matches", methods=["POST"])
def job_matches():
    """Compute accurate job-resume compatibility from backend (single source of truth)."""
    data = request.get_json() or {}
    resume_data = data.get("resumeData") or data.get("resumeAnalysis") or {}
    job_roles_payload = data.get("jobRoles")

    if job_roles_payload is None:
        try:
            from models import JobRole
            roles = JobRole.query.all()
            job_roles = [r.to_dict() for r in roles]
        except Exception:
            job_roles = []
    else:
        job_roles = job_roles_payload if isinstance(job_roles_payload, list) else []

    matches = compute_job_matches(resume_data, job_roles)
    return jsonify({"success": True, "matches": matches})

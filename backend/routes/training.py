"""Training plan API routes"""
from flask import Blueprint, request, jsonify

from services.groq_practice import generate_practice_test, evaluate_practice_test, generate_combined_assessment
from services.study_plan_generator import generate_personalized_study_plan

training_bp = Blueprint("training", __name__)

@training_bp.route("/combined-assessment", methods=["POST"])
def combined_assessment_route():
    """
    Generate a combined 50-question interview assessment for all missing skills of a company role.
    Expects JSON body:
      - skills (list of strings)
      - companyName (string)
      - roleTitle (string)
    """
    data = request.get_json() or {}
    skills = data.get("skills") or []
    company_name = data.get("companyName") or ""
    role_title = data.get("roleTitle") or ""

    if not isinstance(skills, list) or not skills:
        return jsonify({"success": False, "error": "skills list is required"}), 400

    try:
        assessment = generate_combined_assessment(
            skills=skills,
            company_name=company_name,
            role_title=role_title
        )
        return jsonify({"success": True, "assessment": assessment})
    except Exception as e:
        return jsonify({"success": False, "error": f"Combined assessment generation failed: {str(e)}"}), 500


@training_bp.route("/practice/generate", methods=["POST"])
def generate_practice_test_route():
    """Generate a full test (MCQ + coding) for a given skill & difficulty using Groq."""
    data = request.get_json() or {}
    skill = data.get("skill")
    difficulty = data.get("difficulty")
    try:
        test = generate_practice_test(skill=skill, difficulty=difficulty)
        return jsonify({"success": True, "test": test})
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Problem generation failed: {str(e)}"}), 500


@training_bp.route("/practice/evaluate", methods=["POST"])
def evaluate_practice_solution():
    """Evaluate a submitted test (MCQ + coding answers) using Groq (LLM grading)."""
    data = request.get_json() or {}
    test = data.get("test") or {}
    answers = data.get("answers") or []
    language = data.get("language") or "python"
    try:
        result = evaluate_practice_test(test=test, answers=answers, language=language)
        return jsonify({"success": True, "result": result})
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Evaluation failed: {str(e)}"}), 500


@training_bp.route("/study-plan", methods=["POST"])
def study_plan_route():
    """
    Generate a topic-wise personalized study plan for a specific company role + missing skill.
    """
    print("DEBUG: /study-plan route hit")
    data = request.get_json() or {}
    resume_data = data.get("resumeData") or data.get("analysis") or data
    role = data.get("role") or {}
    missing_skill = data.get("missingSkill") or data.get("skill")
    use_llm = data.get("useLLM", True)
    notes_type = data.get("notesType", "quick")

    print(f"DEBUG: Params - Skill: {missing_skill}, Type: {notes_type}, Role: {role.get('title')}")

    if not isinstance(role, dict):
        return jsonify({"success": False, "error": "role must be an object"}), 400
    if not isinstance(missing_skill, str) or not missing_skill.strip():
        return jsonify({"success": False, "error": "missingSkill is required"}), 400

    try:
        plan = generate_personalized_study_plan(
            resume_analysis=resume_data if isinstance(resume_data, dict) else {},
            role=role,
            missing_skill=missing_skill,
            use_llm=use_llm,
            notes_type=notes_type,
        )
        print("DEBUG: Study plan generated successfully")
        return jsonify({"success": True, "plan": plan})
    except Exception as e:
        import traceback
        print(f"ERROR: Study plan generation failed: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": f"Study plan generation failed: {str(e)}"}), 500

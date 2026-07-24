"""Company and job roles API - uses database"""
import json
from flask import Blueprint, request, jsonify

from models import db, Company, JobRole

companies_bp = Blueprint("companies", __name__)


@companies_bp.route("/register", methods=["POST"])
def company_register():
    """Register new company"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400

    required = ["companyName", "email", "password"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Missing required field: {field}"}), 400

    email = data["email"].strip().lower()
    if Company.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    company = Company(
        company_name=data["companyName"],
        email=email,
        phone=data.get("phone", ""),
        industry=data.get("industry", ""),
    )
    company.set_password(data["password"])
    db.session.add(company)
    db.session.commit()

    return jsonify({
        "success": True,
        "company": {k: v for k, v in company.to_dict().items() if k != "password"}
    }), 201


@companies_bp.route("/login", methods=["POST"])
def company_login():
    """Login company"""
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password required"}), 400

    email = data["email"].strip().lower()
    company = Company.query.filter_by(email=email).first()

    if not company or not company.check_password(data["password"]):
        return jsonify({"error": "Invalid email or password"}), 401

    return jsonify({
        "success": True,
        "company": company.to_dict()
    })


@companies_bp.route("/job-roles", methods=["GET"])
def get_job_roles():
    """Get all job roles from all companies"""
    roles = JobRole.query.all()
    job_list = []
    for r in roles:
        d = r.to_dict()
        d["companyName"] = r.company.company_name if r.company else ""
        job_list.append(d)
    return jsonify({"success": True, "jobRoles": job_list})


@companies_bp.route("/job-roles", methods=["POST"])
def add_job_role():
    """Add a job role - requires company email or companyId"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400

    title = data.get("title")
    skills_required = data.get("skillsRequired", [])

    if not title or not skills_required:
        return jsonify({"error": "title and skillsRequired required"}), 400

    if isinstance(skills_required, str):
        skills_required = [s.strip() for s in skills_required.split(",") if s.strip()]

    nice_to_have = data.get("niceToHave", [])
    if isinstance(nice_to_have, str):
        nice_to_have = [s.strip() for s in nice_to_have.split(",") if s.strip()]

    # Find company by id or email
    company = None
    if data.get("companyId"):
        company = Company.query.get(data["companyId"])
    if not company and data.get("companyEmail"):
        company = Company.query.filter_by(email=data["companyEmail"].strip().lower()).first()

    if not company:
        return jsonify({"error": "Company not found. Register company first."}), 400

    role = JobRole(
        company_id=company.id,
        title=title,
        department=data.get("department", ""),
        experience=data.get("experience", ""),
        skills_required=json.dumps(skills_required),
        nice_to_have=json.dumps(nice_to_have),
        description=data.get("description", ""),
    )
    db.session.add(role)
    db.session.commit()

    result = role.to_dict()
    result["companyName"] = company.company_name
    return jsonify({"success": True, "jobRole": result}), 201


@companies_bp.route("/job-roles/<int:role_id>", methods=["DELETE"])
def delete_job_role(role_id):
    """Delete a job role by id. Backend is source of truth for student dashboard."""
    role = JobRole.query.get(role_id)
    if not role:
        return jsonify({"error": "Job role not found"}), 404

    db.session.delete(role)
    db.session.commit()
    return jsonify({"success": True, "deletedId": role_id})

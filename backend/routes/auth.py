"""Authentication API routes - uses database"""
import json
from flask import Blueprint, request, jsonify

from models import db, User

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/save-resume", methods=["POST"])
def save_resume():
    """Save resume analysis data for a user"""
    data = request.get_json()
    if not data or not data.get("email") or not data.get("resumeData"):
        return jsonify({"error": "email and resumeData required"}), 400

    user = User.query.filter_by(email=data["email"].strip().lower()).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.resume_data = json.dumps(data["resumeData"]) if isinstance(data["resumeData"], dict) else data["resumeData"]
    user.resume_uploaded = True
    db.session.commit()

    return jsonify({"success": True, "user": user.to_dict()})


@auth_bp.route("/register", methods=["POST"])
def register():
    """Register new user (student)"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request"}), 400

    required = ["fullName", "email", "password"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Missing required field: {field}"}), 400

    email = data["email"].strip().lower()
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(
        full_name=data["fullName"],
        email=email,
        phone=data.get("phone", ""),
        college=data.get("college", ""),
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "success": True,
        "user": user.to_dict()
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """Login user (student)"""
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password required"}), 400

    email = data["email"].strip().lower()
    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(data["password"]):
        return jsonify({"error": "Invalid email or password"}), 401

    return jsonify({
        "success": True,
        "user": user.to_dict()
    })

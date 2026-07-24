"""Database models for AI PlacePro"""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    """Student user"""
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(30), default="")
    college = db.Column(db.String(120), default="")
    password_hash = db.Column(db.String(256), nullable=False)
    resume_data = db.Column(db.Text, default=None)  # JSON string
    resume_uploaded = db.Column(db.Boolean, default=False)
    profile_complete = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "fullName": self.full_name,
            "email": self.email,
            "phone": self.phone or "",
            "college": self.college or "",
            "resumeData": self.resume_data and __import__("json").loads(self.resume_data) if self.resume_data else None,
            "resumeUploaded": self.resume_uploaded,
            "profileComplete": self.profile_complete,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class Company(db.Model):
    """Company user"""
    __tablename__ = "companies"
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(30), default="")
    industry = db.Column(db.String(80), default="")
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    job_roles = db.relationship("JobRole", backref="company", lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "companyName": self.company_name,
            "email": self.email,
            "phone": self.phone or "",
            "industry": self.industry or "",
            "jobRoles": [jr.to_dict() for jr in self.job_roles],
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class JobRole(db.Model):
    """Job role posted by company"""
    __tablename__ = "job_roles"
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    department = db.Column(db.String(80), default="")
    experience = db.Column(db.String(60), default="")
    skills_required = db.Column(db.Text, nullable=False)  # JSON array
    nice_to_have = db.Column(db.Text, default="[]")  # JSON array
    description = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "title": self.title,
            "department": self.department or "",
            "experience": self.experience or "",
            "skillsRequired": json.loads(self.skills_required) if self.skills_required else [],
            "niceToHave": json.loads(self.nice_to_have) if self.nice_to_have else [],
            "description": self.description or "",
            "companyName": self.company.company_name if self.company else "",
        }

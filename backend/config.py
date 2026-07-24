"""Configuration for AI PlacePro Backend"""
import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

# Base paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
MODEL_PATH = PROJECT_ROOT / "placement_prediction_model.pkl"
UPLOAD_FOLDER = BASE_DIR / "uploads"
UPLOAD_FOLDER.mkdir(exist_ok=True)
JOB_ROLES_FILE = BASE_DIR / "data" / "job_roles.json"

# Database - SQLite (no setup required)
DATABASE_PATH = BASE_DIR / "instance" / "placepro.db"
# Use as_posix() so Windows paths use forward slashes in the URI (avoids SQLite/URI issues)
DATABASE_URI = os.environ.get("DATABASE_URI", f"sqlite:///{DATABASE_PATH.as_posix()}")

# Flask config
SECRET_KEY = os.environ.get("SECRET_KEY", "ai-placepro-secret-key-change-in-production")
MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5MB max file size
ALLOWED_EXTENSIONS = {"pdf", "doc", "docx"}

# OpenAI for LLM features (optional - training plans, AI suggestions)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
USE_LLM = bool(OPENAI_API_KEY)

# Groq (OpenAI-compatible) for coding practice generation/evaluation
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_SKILL_ASSESSMENT_KEY = os.environ.get("GROQ_SKILL_ASSESSMENT_KEY", GROQ_API_KEY)
GROQ_CODING_PRACTICE_KEY = os.environ.get("GROQ_CODING_PRACTICE_KEY", GROQ_API_KEY)

# Gemini (Google Generative Language API) for LLM features (optional)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_STUDY_PLAN_KEY = os.environ.get("GEMINI_STUDY_PLAN_KEY", GEMINI_API_KEY)

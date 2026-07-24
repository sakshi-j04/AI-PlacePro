"""Shared storage for job roles - used by companies and resume analysis. Persisted to JSON."""
import json
from pathlib import Path

from config import JOB_ROLES_FILE

job_roles = []


def _load():
    global job_roles
    try:
        if JOB_ROLES_FILE.exists():
            with open(JOB_ROLES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                job_roles = data if isinstance(data, list) else []
        else:
            job_roles = []
    except Exception:
        job_roles = []


def _save():
    try:
        JOB_ROLES_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(JOB_ROLES_FILE, "w", encoding="utf-8") as f:
            json.dump(job_roles, f, indent=2)
    except Exception as e:
        print(f"Could not save job roles: {e}")


def append_job_role(role):
    job_roles.append(role)
    _save()


# Load on import so backend has jobs after restart
_load()

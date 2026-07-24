"""
Accurate job-resume compatibility scoring.
Uses normalized skill matching and a single source of truth for realism.
"""
import re

# Canonical skill aliases for accurate matching (avoid "js" = "javascript" false positives unless intended)
SKILL_ALIASES = {
    "js": "javascript",
    "node": "node.js",
    "golang": "go",
    "ml": "machine learning",
    "dl": "deep learning",
    "ai": "machine learning",
    "reactjs": "react",
    "vuejs": "vue",
    "nextjs": "next.js",
    "aws cloud": "aws",
    "amazon web services": "aws",
    "postgres": "postgresql",
    "mongo": "mongodb",
    "k8s": "kubernetes",
    "ci cd": "ci/cd",
    "cicd": "ci/cd",
    "nodejs": "node.js",
    "ds": "data structures",
    "os": "operating systems",
    "db": "database",
    "ui": "frontend",
    "ux": "frontend",
}


def _normalize_skill(s):
    """Normalize skill string for comparison: lower, strip, collapse spaces, resolve alias."""
    if not s or not isinstance(s, str):
        return ""
    t = s.lower().strip()
    t = re.sub(r"\s+", " ", t)
    return SKILL_ALIASES.get(t, t)


def _resume_skill_tokens(found_skills):
    """Build set of normalized tokens from resume foundSkills (and variants)."""
    tokens = set()
    for skill in found_skills or []:
        name = (skill.get("name") or skill) if isinstance(skill, dict) else skill
        n = _normalize_skill(str(name))
        if n:
            tokens.add(n)
    # Add aliases in reverse so we match when job says "javascript" and resume has "JS"
    for t in list(tokens):
        for alias, canonical in SKILL_ALIASES.items():
            if canonical == t and alias not in tokens:
                tokens.add(alias)
    return tokens


def _skill_matches_resume(job_skill, resume_tokens):
    """True if job requirement is satisfied by resume (exact or substring after normalization)."""
    n = _normalize_skill(job_skill)
    if not n:
        return False
    if n in resume_tokens:
        return True
    # Substring: resume "javascript" covers job "js" (if we added alias), or "react" covers "react native"
    for rt in resume_tokens:
        if n in rt or rt in n:
            return True
    return False


def compute_job_matches(resume_analysis, job_roles, max_compatibility=100):
    """
    Compute compatibility between resume and each job role.
    resume_analysis: dict with foundSkills (list of {name, ...})
    job_roles: list of dicts with skillsRequired, niceToHave (arrays), plus id, title, companyName, etc.
    Returns list of { role, score, matchedRequiredCount, totalRequiredCount, missingRequired, missingNice }.
    """
    resume_tokens = _resume_skill_tokens(resume_analysis.get("foundSkills") or [])
    results = []

    for role in job_roles or []:
        required = role.get("skillsRequired") or []
        nice = role.get("niceToHave") or []
        if isinstance(required, str):
            required = [s.strip() for s in required.split(",") if s.strip()]
        if isinstance(nice, str):
            nice = [s.strip() for s in nice.split(",") if s.strip()]

        required_norm = [_normalize_skill(s) for s in required]
        nice_norm = [_normalize_skill(s) for s in nice]
        required_valid = [r for r in required if r]
        nice_valid = [n for n in nice if n]

        matched_req = []
        missing_req = []
        for i, r in enumerate(required):
            if not r:
                continue
            if _skill_matches_resume(r, resume_tokens):
                matched_req.append(required_norm[i] if i < len(required_norm) else _normalize_skill(r))
            else:
                missing_req.append(r)

        matched_nice = []
        missing_nice = []
        for i, n in enumerate(nice):
            if not n:
                continue
            if _skill_matches_resume(n, resume_tokens):
                matched_nice.append(nice_norm[i] if i < len(nice_norm) else _normalize_skill(n))
            else:
                missing_nice.append(n)

        total_req = len(required_valid)

        # Compatibility is based only on required skills:
        #  - 0%  = none of the required skills present
        #  - 100% = all required skills present
        if total_req > 0:
            req_ratio = len(matched_req) / total_req
            raw = req_ratio * 100
        else:
            # If a role has no required skills defined, treat compatibility as 0
            raw = 0

        score = max(0, min(max_compatibility, int(round(raw))))

        results.append({
            "id": role.get("id"),
            "title": role.get("title") or "Job Role",
            "companyName": role.get("companyName") or "",
            "department": role.get("department") or "",
            "experience": role.get("experience") or "",
            "score": score,
            "matchedRequiredCount": len(matched_req),
            "totalRequiredCount": total_req,
            "missingRequired": missing_req,
            "missingNice": missing_nice,
        })

    results.sort(key=lambda x: -x["score"])
    return results

"""NLP-based Resume Analysis - Skills extraction, ATS scoring, keyword analysis.
Uses section-aware extraction, TF-IDF-style relevance, and stricter scoring for accuracy."""
import re
import math
from .resume_extractor import extract_resume_text

# Industry-standard skills taxonomy for software/tech roles (no generic filler)
SKILL_KEYWORDS = {
    "Programming Language": [
        "python", "javascript", "java", "c++", "c#", "typescript", "go", "golang",
        "rust", "kotlin", "swift", "php", "ruby", "scala", "r", "matlab", "sql"
    ],
    "Framework": [
        "react", "angular", "vue", "node", "node.js", "django", "flask", "express",
        "spring", "spring boot", "asp.net", "laravel", "next.js", "nest.js",
        "fastapi", "tensorflow", "pytorch", "keras", "react native", "flutter"
    ],
    "Database": [
        "sql", "mysql", "postgresql", "mongodb", "redis", "sqlite", "oracle",
        "dynamodb", "cassandra", "elasticsearch", "firebase"
    ],
    "Tools": [
        "git", "docker", "kubernetes", "jenkins", "aws", "azure", "gcp",
        "linux", "jira", "confluence", "figma", "postman", "vs code"
    ],
    "DevOps": [
        "ci/cd", "devops", "docker", "kubernetes", "terraform", "ansible",
        "jenkins", "github actions", "gitlab ci"
    ],
    "Cloud": [
        "aws", "azure", "gcp", "cloud", "serverless", "lambda", "ec2", "s3"
    ],
    "Data Science": [
        "machine learning", "deep learning", "data analysis", "nlp", "pandas",
        "numpy", "scikit-learn", "tensorflow", "pytorch"
    ],
    "Soft Skill": [
        "problem solving", "communication", "teamwork", "leadership",
        "time management", "adaptability", "critical thinking", "collaboration"
    ],
    "Core CS": [
        "data structures", "algorithms", "oop", "system design",
        "computer networks", "operating systems", "dbms"
    ]
}

# Section headers that indicate relevant context for skills (not generic ATS stuffing)
SECTION_HEADERS = ["experience", "education", "skills", "projects", "technical", "summary", "work history", "employment"]

# Only section headers + technical terms for ATS relevance (no long flat keyword list)
ATS_SECTION_KEYWORDS = ["experience", "education", "skills", "project", "summary", "certification", "achievement", "responsibilities"]
ATS_TECH_KEYWORDS = [kw for kws in SKILL_KEYWORDS.values() for kw in kws]

INDUSTRY_REQUIREMENTS = {
    "technical": [
        "Proficiency in at least 2 programming languages",
        "Experience with version control (Git)",
        "Understanding of databases (SQL/NoSQL)",
        "Knowledge of RESTful APIs",
        "Familiarity with cloud platforms (AWS/Azure/GCP)"
    ],
    "soft": [
        "Strong problem-solving abilities",
        "Effective communication skills",
        "Team collaboration experience",
        "Time management",
        "Adaptability"
    ],
    "certifications": [
        "Cloud certifications (AWS, Azure, GCP)",
        "Agile/Scrum certifications",
        "Technology-specific certifications"
    ]
}


def _split_into_sections(text):
    """Split resume text into sections by common headings for section-aware analysis."""
    text_lower = text.lower()
    sections = {"other": []}
    current = "other"
    lines = text.split("\n")
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        line_lower = stripped.lower()
        # Detect section header (short line, often ends with : or is a known header)
        for header in SECTION_HEADERS:
            if line_lower == header or line_lower.rstrip(":") == header or line_lower.startswith(header + " "):
                current = header if header in SECTION_HEADERS else "other"
                if current not in sections:
                    sections[current] = []
                break
        else:
            if current not in sections:
                sections[current] = []
            sections[current].append(stripped)
    return sections


def extract_skills_from_text(text):
    """Extract skills using section-aware matching: prefer skills in experience/skills/education/projects."""
    text_lower = text.lower()
    sections = _split_into_sections(text)
    # Concatenate relevant sections for "in context" skills
    relevant_blocks = []
    for key in ["skills", "experience", "education", "projects", "technical", "work history", "employment"]:
        if key in sections and sections[key]:
            relevant_blocks.append(" ".join(sections[key]).lower())
    context_text = " ".join(relevant_blocks) if relevant_blocks else text_lower
    full_text = text_lower
    found_skills = []
    seen = set()

    for category, keywords in SKILL_KEYWORDS.items():
        for keyword in keywords:
            pattern = r"\b" + re.escape(keyword) + r"(?:s|es)?\b"
            in_context = bool(re.search(pattern, context_text))
            in_full = bool(re.search(pattern, full_text))
            if not in_full:
                continue
            if keyword in seen:
                continue
            seen.add(keyword)
            # Level: higher if appears in skills/experience context; reduce if only in "other"
            mentions = len(re.findall(pattern, full_text))
            level = 55 + min(35, mentions * 8)
            if in_context:
                level = min(92, level + 15)
            # Penalize single mention in a long "other" section (possible stuffing)
            if not in_context and mentions == 1 and len(sections.get("other", [])) > 20:
                level = min(level, 65)
            found_skills.append({
                "name": keyword.title(),
                "level": min(95, level),
                "category": category
            })
    return found_skills


def _categorize_skill(skill_name):
    s = skill_name.lower()
    for cat, keywords in SKILL_KEYWORDS.items():
        if any(kw in s or s in kw for kw in keywords):
            return cat
    return "Technical"


def get_missing_skills(found_skills, text, company_job_skills=None):
    """Missing skills: prioritize company job requirements; only add minimal industry list if no job data."""
    found_names = {s["name"].lower() for s in found_skills}
    missing = []
    seen = set()

    if company_job_skills:
        for skill in company_job_skills:
            sk = (skill.strip() if isinstance(skill, str) else str(skill)).strip()
            if not sk:
                continue
            sk_lower = sk.lower()
            if sk_lower not in found_names and sk_lower not in seen:
                seen.add(sk_lower)
                missing.append({"name": sk.title(), "priority": "High", "category": _categorize_skill(sk)})

    # Only add a small set of industry-relevant gaps if we have no company jobs (avoid keyword bloat)
    if not company_job_skills or len(missing) < 3:
        for skill in ["Docker", "AWS", "System Design", "CI/CD", "Git"]:
            if skill.lower() not in found_names and skill.lower() not in seen and len(missing) < 8:
                seen.add(skill.lower())
                missing.append({"name": skill, "priority": "High" if skill in ["Docker", "AWS", "System Design"] else "Medium", "category": _categorize_skill(skill)})

    return missing[:12]


def _keyword_stuffing_penalty(text_lower, keywords):
    """Detect repeated keyword stuffing and return a penalty (0 = no penalty)."""
    words = re.findall(r"\b[a-z]{2,}\b", text_lower)
    if len(words) < 100:
        return 0
    from collections import Counter
    counts = Counter(words)
    # Penalize if same technical term repeated excessively
    tech_terms = set(ATS_TECH_KEYWORDS)
    repeat_penalty = 0
    for w, c in counts.most_common(30):
        if w in tech_terms and c > 5:
            repeat_penalty += min(8, (c - 5) * 2)
    return min(25, repeat_penalty)


def calculate_ats_score(text, found_skills):
    """ATS compatibility score (0–100) with weighted sections and relevance (accurate, no inflation)."""
    text_lower = text.lower()
    word_count = len(text.split())
    score = 32.0

    # Weighted section presence (experience and skills matter most)
    section_weights = {"experience": 0.25, "education": 0.20, "skills": 0.25, "project": 0.18, "summary": 0.12}
    for section, weight in section_weights.items():
        if section in text_lower:
            score += 12 * weight
    score = min(score, 35 + 12)  # cap section bonus

    # Relevant keywords only (section headers + technical terms), sqrt to avoid inflation
    section_hits = sum(1 for kw in ATS_SECTION_KEYWORDS if kw in text_lower)
    tech_hits = sum(1 for kw in ATS_TECH_KEYWORDS if kw in text_lower)
    keyword_component = min(25, math.sqrt(section_hits * 3 + tech_hits) * 2.5)
    score += keyword_component

    # Skills count with diminishing returns
    score += min(15, len(found_skills) * 1.8)

    # Length curve: sweet spot 250–700 words
    if 250 <= word_count <= 700:
        score += 10
    elif 200 <= word_count <= 800:
        score += 5
    elif word_count < 150:
        score -= 10
    elif word_count > 1000:
        score -= 5

    # Penalty for keyword stuffing
    score -= _keyword_stuffing_penalty(text_lower, ATS_TECH_KEYWORDS)

    return max(0, min(100, int(round(score))))


def calculate_keyword_score(found_skills, missing_skills):
    """Keyword coverage: ratio of found vs (found + missing) for accuracy."""
    total = len(found_skills) + len(missing_skills)
    if total == 0:
        return 65
    ratio = len(found_skills) / total
    return min(98, int(35 + ratio * 63))


def calculate_content_score(text, found_skills):
    """Content quality: action verbs, quantification, depth."""
    text_lower = text.lower()
    score = 50
    action_verbs = ["developed", "implemented", "designed", "led", "managed", "created", "built", "optimized", "delivered", "improved"]
    verb_count = sum(1 for v in action_verbs if v in text_lower)
    score += min(20, verb_count * 2.5)
    if re.search(r"\d+%|\d+\+|\$\d+|\d+\s*(years?|yr|months?)", text):
        score += 15
    score += min(15, len(found_skills))
    return min(100, score)


def calculate_format_score(text):
    """Format/structure: headings, bullets, structure."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    score = 40
    if len(lines) >= 5:
        score += 15
    if len(lines) >= 10:
        score += 10
    if any("-" in l or "•" in l or "*" in l for l in lines):
        score += 15
    if any(h in text.lower() for h in ["experience", "education", "skills"]):
        score += 10
    return min(100, score)


def get_strengths(found_skills, scores):
    """Only report strengths that are actually true."""
    strengths = []
    if len(found_skills) >= 5:
        strengths.append("Strong technical skills section")
    if scores.get("content", 0) >= 65:
        strengths.append("Quantifiable achievements present")
    if scores.get("format", 0) >= 65:
        strengths.append("Clear structure and formatting")
    if scores.get("ats", 0) >= 65:
        strengths.append("Good ATS-friendly sections")
    if not strengths:
        strengths.append("Resume has room to highlight strengths with more specific content")
    return strengths[:5]


def get_improvements(missing_skills, found_skills, text):
    """Improvements only when applicable (no generic filler)."""
    improvements = []
    text_lower = (text or "").lower()

    if len(missing_skills) > 0:
        high = [s["name"] for s in missing_skills if s.get("priority") == "High"]
        if high:
            improvements.append({
                "title": "Missing skills for target role",
                "priority": "High",
                "description": f"Consider adding or highlighting: {', '.join(high[:5])}"
            })

    if len(found_skills) < 5:
        improvements.append({
            "title": "Expand technical skills",
            "priority": "Medium",
            "description": "Add specific languages, tools, and frameworks you have used"
        })

    # Only suggest summary improvement if summary is weak or missing
    if "summary" not in text_lower and "objective" not in text_lower:
        improvements.append({
            "title": "Add a brief summary",
            "priority": "Medium",
            "description": "A 2–3 line summary helps recruiters quickly see your focus"
        })
    elif "summary" in text_lower:
        summary_section = text_lower.split("summary")[-1].split("experience")[0].split("education")[0]
        if len(summary_section.split()) < 15:
            improvements.append({
                "title": "Strengthen summary",
                "priority": "Low",
                "description": "Add a concise value proposition and key focus areas"
            })

    # Certifications only if not mentioned
    if "certification" not in text_lower and "certificate" not in text_lower and found_skills:
        improvements.append({
            "title": "Certifications",
            "priority": "Low",
            "description": "If you have relevant certifications, list them to strengthen your profile"
        })

    return improvements[:5]


def analyze_resume(file_path, company_job_skills=None):
    """Full resume analysis pipeline with accurate scoring and placement-ready output."""
    text = extract_resume_text(file_path)
    if not text or len(text.strip()) < 50:
        raise ValueError("Resume text could not be extracted or is too short")

    found_skills = extract_skills_from_text(text)
    missing_skills = get_missing_skills(found_skills, text, company_job_skills=company_job_skills)

    scores = {
        "ats": calculate_ats_score(text, found_skills),
        "keywords": calculate_keyword_score(found_skills, missing_skills),
        "content": calculate_content_score(text, found_skills),
        "format": calculate_format_score(text),
    }
    # Weighted overall for accuracy (ATS and content weighted highest)
    scores["overall"] = int(
        round(
            scores["ats"] * 0.36
            + scores["keywords"] * 0.24
            + scores["content"] * 0.28
            + scores["format"] * 0.12
        )
    )
    scores["overall"] = max(0, min(98, scores["overall"]))

    return {
        "scores": scores,
        "foundSkills": found_skills,
        "missingSkills": missing_skills,
        "requirements": INDUSTRY_REQUIREMENTS,
        "strengths": get_strengths(found_skills, scores),
        "improvements": get_improvements(missing_skills, found_skills, text),
        "rawTextLength": len(text),
    }

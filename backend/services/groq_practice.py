"""Groq-powered coding practice generation & evaluation.

Uses Groq's OpenAI-compatible HTTP API via requests (no OpenAI client dependency),
to avoid environment-specific client keyword issues.
"""

import json
from typing import Any, Dict, List

import requests

from config import GROQ_API_KEY, GROQ_SKILL_ASSESSMENT_KEY, GROQ_CODING_PRACTICE_KEY


GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
# Use current Groq 8B model which has much higher rate limits than 70B
DEFAULT_MODEL = "llama-3.1-8b-instant"


def _strip_markdown(text: str) -> str:
    """Removes ```json and ``` markdown wrappers if present."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) > 2:
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].strip() == "```":
                lines = lines[:-1]
            return "\n".join(lines).strip()
    return text


def _post_groq(payload: Dict[str, Any], api_key: str = None) -> Dict[str, Any]:
    key = api_key or GROQ_API_KEY
    if not key:
        raise ValueError("GROQ API key is not set in environment.")
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    resp = requests.post(GROQ_BASE_URL, headers=headers, json=payload, timeout=60)
    try:
        data = resp.json()
    except Exception:
        resp.raise_for_status()
        raise
    if resp.status_code >= 400:
        msg = data.get("error", {}).get("message") if isinstance(data, dict) else None
        raise ValueError(msg or f"Groq API error: HTTP {resp.status_code}")
    return data


def generate_combined_assessment(skills: List[str], company_name: str, role_title: str) -> Dict[str, Any]:
    skills_list = [s.strip() for s in skills if s.strip()]
    if not skills_list:
        raise ValueError("At least one skill is required for combined assessment")
    
    company_name = (company_name or "Target Company").strip()
    role_title = (role_title or "Target Role").strip()

    # Total questions = 70
    # Mix: 55 MCQ, 15 Coding
    mcq_count, coding_count = 55, 15

    prompt = f"""
You are an expert technical interviewer for {company_name} hiring for the {role_title} role.

Create a COMPREHENSIVE COMBINED ASSESSMENT covering these missing skills: {", ".join(skills_list)}.

Total Questions: 70
- Multiple Choice (MCQ): {mcq_count} questions
- Coding Tasks: {coding_count} questions

Distribution:
- Distribute questions fairly across all the skills mentioned.
- Focus on the most important interview questions for these skills at {company_name}.

Return ONLY valid JSON with this exact shape:
{{
  "assessmentTitle": "Combined Interview Assessment for {company_name}",
  "role": "{role_title}",
  "skills": {json.dumps(skills_list)},
  "questions": [
    {{
      "id": "q1",
      "type": "mcq",
      "skill": "<skill name>",
      "title": "<short title>",
      "prompt": "<mcq stem>",
      "options": ["A", "B", "C", "D"],
      "answerStyle": "single_choice"
    }},
    {{
      "id": "q56",
      "type": "coding",
      "skill": "<skill name>",
      "title": "<short title>",
      "prompt": "<clear coding task>",
      "constraints": ["<constraint 1>"],
      "examples": [{{"input": "...", "output": "..."}}],
      "answerStyle": "code"
    }}
  ]
}}

Rules:
- MCQ options should be short and distinct.
- Prompts should be clear and professional.
- Coding questions should be realistic for a technical interview.
- The "questions" array must contain exactly 70 items.
"""

    data = _post_groq(
        {
            "model": DEFAULT_MODEL,
            "temperature": 0.8,
            "messages": [
                {"role": "system", "content": "You output strict JSON only, no markdown. You are an expert interviewer."},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
        },
        api_key=GROQ_SKILL_ASSESSMENT_KEY
    )
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content") or "{}"
    obj = json.loads(_strip_markdown(content))
    
    # Normalization
    obj["assessmentTitle"] = obj.get("assessmentTitle") or f"Combined Assessment: {company_name}"
    questions = obj.get("questions") or []
    for q in questions:
        if "type" not in q:
            q["type"] = "mcq" if "options" in q else "coding"
    obj["questions"] = questions
    return obj


def generate_practice_test(skill: str, difficulty: str) -> Dict[str, Any]:
    skill = (skill or "").strip()
    difficulty = (difficulty or "").strip().lower()
    if not skill:
        raise ValueError("skill is required")
    if difficulty not in {"easy", "medium", "hard"}:
        raise ValueError("difficulty must be one of: easy, medium, hard")

    # Question distribution per difficulty
    if difficulty == "easy":
        mcq_count, coding_count = 10, 0
    elif difficulty == "medium":
        mcq_count, coding_count = 7, 3
    else:  # hard
        mcq_count, coding_count = 5, 5

    prompt = f"""
You are creating a small coding test to practice the skill: "{skill}".

Difficulty: {difficulty.upper()}.

Question mix:
- EASY: 10 simple multiple-choice questions, no coding.
- MEDIUM: 7 multiple-choice questions and 3 coding questions.
- HARD: 5 multiple-choice questions and 5 coding questions.

For this request, use exactly:
- multiple_choice_count = {mcq_count}
- coding_count = {coding_count}

Return ONLY valid JSON with this exact shape:
{{
  "skill": "{skill}",
  "difficulty": "{difficulty}",
  "questions": [
    {{
      "id": "q1",
      "type": "mcq",
      "title": "<short title>",
      "prompt": "<mcq stem, simple language>",
      "options": ["A", "B", "C", "D"],
      "answerStyle": "single_choice"
    }},
    {{
      "id": "q2",
      "type": "coding",
      "title": "<short title>",
      "prompt": "<clear coding task>",
      "constraints": ["<constraint 1>", "<constraint 2>"],
      "examples": [{{"input": "<example input>", "output": "<example output>"}}],
      "answerStyle": "code"
    }}
  ]
}}

Rules:
- First create the full set of questions, then fill the JSON.
- For EASY, all questions must be MCQ and very simple / conceptual.
- For MEDIUM/HARD, coding questions should be realistic but solvable in under 30–40 minutes each.
- MCQ options should be short, clearly distinct, and each option value must be a single-line sentence (no bullet points, no numbering, no line breaks).
- The "prompt" for every question must be a single, clear sentence (no lists, no extra formatting).
- Do NOT include explanations or correct answers in the JSON.
- The "questions" array must contain exactly (multiple_choice_count + coding_count) items.
"""

    data = _post_groq(
        {
            "model": DEFAULT_MODEL,
            "temperature": 0.9,
            "messages": [
                {"role": "system", "content": "You output strict JSON only, no markdown."},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
        },
        api_key=GROQ_CODING_PRACTICE_KEY
    )
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content") or "{}"
    obj = json.loads(_strip_markdown(content))

    # Defensive normalization
    obj["skill"] = skill
    obj["difficulty"] = difficulty
    questions: List[Dict[str, Any]] = obj.get("questions") or []
    # Ensure type labels are consistent
    for q in questions:
        t = (q.get("type") or "").lower()
        if t not in {"mcq", "coding"}:
            # Heuristic: MCQ if options present, else coding
            t = "mcq" if q.get("options") else "coding"
        q["type"] = t
    obj["questions"] = questions
    return obj


def evaluate_practice_test(test: Dict[str, Any], answers: List[Dict[str, Any]], language: str = "python") -> Dict[str, Any]:
    """Evaluate a full test (MCQ + coding) and return an overall score."""
    if not isinstance(test, dict) or not isinstance(test.get("questions"), list):
        raise ValueError("test with questions[] is required")
    if not isinstance(answers, list) or not answers:
        raise ValueError("answers array is required")
    language = (language or "python").strip().lower()

    rubric = """
Score the entire test out of 100.
- 0-40: many incorrect answers / very weak coding.
- 41-69: some understanding but several important gaps.
- 70-84: generally good; a few issues or missed edge cases.
- 85-100: strong performance; correct reasoning and code quality.

Also compute:
- passed: true if score >= 70, else false.
- feedback: 2-4 sentences of overall feedback.
- strengths: short bullet points.
- improvements: short bullet points (actionable).
- results: An array of objects, one for each question in order:
    {
      "id": "q1",
      "correct": true/false,
      "explanation": "Brief explanation of why the answer was correct/incorrect",
      "correctAnswer": "The actual correct answer (for MCQ) or a brief solution sketch (for coding)"
    }

IMPORTANT:
- You receive the test questions (mcq + coding) and the student's answers.
- For MCQ, the student's answer may be an option index or text.
- For coding, judge correctness, clarity, and complexity from the code snippet.

Return ONLY valid JSON with this exact shape:
{
  "score": 0,
  "passed": false,
  "feedback": "<overall feedback>",
  "strengths": ["..."],
  "improvements": ["..."],
  "results": [...]
}
"""

    prompt = f"""
Test metadata:
Skill: {test.get("skill","")}
Difficulty: {test.get("difficulty","")}

Questions:
{json.dumps(test.get("questions", []), ensure_ascii=False, indent=2)}

Student answers:
{json.dumps(answers, ensure_ascii=False, indent=2)}

Candidate coding language (for coding questions): {language}

Evaluate the student's performance on the whole test using the rubric.
"""

    data = _post_groq(
        {
            "model": DEFAULT_MODEL,
            "temperature": 0.2,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a strict but fair technical interviewer. Output strict JSON only.",
                },
                {"role": "user", "content": rubric + "\n\n" + prompt},
            ],
            "response_format": {"type": "json_object"},
        },
        api_key=GROQ_CODING_PRACTICE_KEY
    )
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content") or "{}"
    obj = json.loads(_strip_markdown(content))

    score = int(obj.get("score", 0) or 0)
    score = max(0, min(100, score))
    passed = bool(obj.get("passed", score >= 70))
    return {
        "score": score,
        "passed": passed,
        "feedback": str(obj.get("feedback", "") or ""),
        "strengths": obj.get("strengths") if isinstance(obj.get("strengths"), list) else [],
        "improvements": obj.get("improvements") if isinstance(obj.get("improvements"), list) else [],
        "results": obj.get("results") if isinstance(obj.get("results"), list) else [],
    }


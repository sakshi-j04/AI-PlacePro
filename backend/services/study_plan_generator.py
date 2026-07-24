"""Topic-wise personalized study plan generator.

Supports Groq (OpenAI-compatible) and Gemini (Google Generative Language REST)
and falls back to a simple local template when no API keys are configured.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List

import requests

from config import GEMINI_API_KEY, GROQ_API_KEY, GEMINI_STUDY_PLAN_KEY


GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1/models"
DEFAULT_GEMINI_MODEL = "gemini-1.5-flash"


def _post_groq(payload: Dict[str, Any], api_key: str = None) -> Dict[str, Any]:
    key = api_key or GROQ_API_KEY
    if not key:
        raise ValueError("GROQ API key is not set in environment.")
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    resp = requests.post(GROQ_BASE_URL, headers=headers, json=payload, timeout=90)
    try:
        data = resp.json()
    except Exception:
        resp.raise_for_status()
        raise
    if resp.status_code >= 400:
        msg = data.get("error", {}).get("message") if isinstance(data, dict) else None
        # Handle the case where the key is invalid or revoked
        if "Invalid API Key" in str(msg):
            raise ValueError("Groq API key is invalid or has been revoked.")
        raise ValueError(msg or f"Groq API error: HTTP {resp.status_code}")
    return data


def _strip_markdown(text: str) -> str:
    """Removes ```json and ``` markdown wrappers if present."""
    text = text.strip()
    if text.startswith("```"):
        # Remove first line
        lines = text.splitlines()
        if len(lines) > 2:
            # If it's ```json or just ```
            if lines[0].startswith("```"):
                lines = lines[1:]
            # Remove last line if it's ```
            if lines[-1].strip() == "```":
                lines = lines[:-1]
            return "\n".join(lines).strip()
    return text


def _post_gemini_text_json(prompt: str, api_key: str = None) -> Dict[str, Any]:
    key = api_key or GEMINI_STUDY_PLAN_KEY or GEMINI_API_KEY
    if not key:
        raise ValueError("GEMINI API key is not set in environment.")

    url = f"{GEMINI_BASE_URL}/{DEFAULT_GEMINI_MODEL}:generateContent"
    params = {"key": key}
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json",
        },
    }

    resp = requests.post(url, params=params, json=payload, timeout=180)
    try:
        data = resp.json()
    except Exception:
        resp.raise_for_status()
        raise

    if resp.status_code >= 400:
        msg = None
        try:
            msg = data.get("error", {}).get("message")
        except Exception:
            msg = None
        # Handle model not found or unsupported method error
        if "not found" in str(msg) or "not supported" in str(msg):
            raise ValueError(f"Gemini error: Model {DEFAULT_GEMINI_MODEL} is not available via API v1. {msg}")
        raise ValueError(msg or f"Gemini API error: HTTP {resp.status_code}")

    # Gemini JSON response is usually already structured, but we still
    # handle the common "text" wrapper case.
    try:
        text = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        if text:
            return json.loads(_strip_markdown(text))
    except Exception:
        pass

    # If response is already JSON-shaped, just return it.
    return data


def _local_study_plan(company_name: str, role_title: str, missing_skill: str, notes_type: str = "quick") -> Dict[str, Any]:
    # Lightweight fallback plan (no LLM) so UI still works.
    now = datetime.utcnow().isoformat() + "Z"
    
    notes_key = "quickNotes" if notes_type == "quick" else "longNotes"
    
    # Simple multiplier to simulate longer notes in fallback
    def get_notes(topic_idx: int):
        if notes_type == "quick":
            return [
                f"Expanded Quick Note 1 for {missing_skill}: This note provides a more detailed overview of foundational concepts, totaling around 200 words to ensure a thorough understanding. We explore how {missing_skill} is used in modern {role_title} workflows, including practical examples like setting up basic structures and managing data flow. By focusing on these core elements, you can quickly grasp the essentials while still receiving enough detail to apply the skill in real-world scenarios at companies like {company_name}. This explanation is designed to be clear and instructional.",
                f"Conceptual Deep-Dive 2 for {missing_skill}: To further illustrate {missing_skill}, we examine its integration into standard industry patterns. For example, when building features for a {role_title}, understanding the trade-offs between different implementation styles is crucial. This section provides additional context and a simple walkthrough of a common use case, ensuring you're prepared for technical discussions and practical tasks. The goal is to provide a solid foundation that scales as you advance.",
                f"Practical Application Guide 3 for {missing_skill}: This final quick note focuses on the 'how-to' aspect of {missing_skill}. We provide a step-by-step example of a routine task, highlighting best practices for efficiency and maintainability. This level of detail ensures that even our 'quick' notes offer a comprehensive look at the skill, preparing you for the expectations of high-performing teams at {company_name}."
            ]
        else:
            return [
                f"Ultra-Detailed Long Note 1 for {missing_skill}: This comprehensive 1000-word deep-dive explores advanced concepts and architectural patterns essential for mastering {missing_skill} in a professional environment. We examine how this skill integrates into the larger ecosystem of {role_title} roles, focusing on performance optimization, scalability, and maintainability. Real-world scenarios at {company_name} often require handling complex state transitions and edge cases that are not covered in basic tutorials. By understanding the underlying mechanics, you can write more efficient and robust code. This topic covers the critical path for senior-level proficiency, providing extensive explanations and historical context where relevant.",
                f"Architectural Masterclass 2 for {missing_skill}: In this section, we break down the implementation details of {missing_skill} with an emphasis on high-level design. We provide code-level insights and best practices that ensure your solutions are clean and industry-standard. Understanding the trade-offs between different approaches is key to passing technical interviews for {role_title} positions. We discuss memory management, execution context, and the latest features introduced in recent versions. Practical examples demonstrate how to apply these concepts to solve common problems encountered in high-traffic applications, accompanied by extensive commentary on why certain patterns are preferred over others.",
                f"Professional Implementation Analysis 3 for {missing_skill}: Scaling {missing_skill} requires a solid grasp of architectural principles. This note covers design patterns such as singleton, factory, and observer as they apply to this skill in a professional setting. We also discuss how to structure your projects for maximum reusability and testability, providing detailed examples of how companies like {company_name} structure their codebases. Following these patterns will help you align with the expectations of top-tier companies. We conclude with an in-depth look at future trends and how the ecosystem is evolving, ensuring your skills remain relevant in the long term through constant adaptation and learning."
            ]

    def get_fallback_link(skill: str, topic: str = ""):
        skill_lower = skill.lower()
        # Web Frameworks
        if "django" in skill_lower: return "https://docs.djangoproject.com/en/stable/"
        if "flask" in skill_lower: return "https://flask.palletsprojects.com/"
        if "fastapi" in skill_lower: return "https://fastapi.tiangolo.com/"
        if "express" in skill_lower: return "https://expressjs.com/"
        if "spring" in skill_lower: return "https://spring.io/projects/spring-framework"
        
        # Frontend
        if "react" in skill_lower: return "https://react.dev/"
        if "angular" in skill_lower: return "https://angular.io/docs"
        if "vue" in skill_lower: return "https://vuejs.org/"
        if "next" in skill_lower and "js" in skill_lower: return "https://nextjs.org/docs"
        if "tailwind" in skill_lower: return "https://tailwindcss.com/docs"
        
        # Languages
        if "python" in skill_lower: return "https://docs.python.org/3/"
        if "javascript" in skill_lower or "js" in skill_lower: return "https://developer.mozilla.org/en-US/docs/Web/JavaScript"
        if "typescript" in skill_lower or "ts" in skill_lower: return "https://www.typescriptlang.org/docs/"
        if "java" in skill_lower and "javascript" not in skill_lower: return "https://docs.oracle.com/en/java/"
        if "cpp" in skill_lower or "c++" in skill_lower: return "https://en.cppreference.com/w/"
        if "golang" in skill_lower or " go " in skill_lower: return "https://go.dev/doc/"
        
        # Databases
        if "sql" in skill_lower: return "https://dev.mysql.com/doc/"
        if "mongodb" in skill_lower: return "https://www.mongodb.com/docs/"
        if "postgresql" in skill_lower or "postgres" in skill_lower: return "https://www.postgresql.org/docs/"
        if "redis" in skill_lower: return "https://redis.io/documentation"
        
        # DevOps & Cloud
        if "aws" in skill_lower: return "https://docs.aws.amazon.com/"
        if "azure" in skill_lower: return "https://docs.microsoft.com/en-us/azure/"
        if "gcp" in skill_lower or "google cloud" in skill_lower: return "https://cloud.google.com/docs"
        if "docker" in skill_lower: return "https://docs.docker.com/"
        if "kubernetes" in skill_lower or "k8s" in skill_lower: return "https://kubernetes.io/docs/home/"
        if "git" in skill_lower: return "https://git-scm.com/doc"
        if "github" in skill_lower: return "https://docs.github.com/en"
        if "jenkins" in skill_lower: return "https://www.jenkins.io/doc/"
        if "terraform" in skill_lower: return "https://developer.hashicorp.com/terraform/docs"
        
        # Data Science
        if "pandas" in skill_lower: return "https://pandas.pydata.org/docs/"
        if "numpy" in skill_lower: return "https://numpy.org/doc/"
        if "tensorflow" in skill_lower: return "https://www.tensorflow.org/api_docs"
        if "pytorch" in skill_lower: return "https://pytorch.org/docs/stable/index.html"
        
        # If no mapping found, return a direct documentation search on MDN or a cleaner search
        # Avoid Google's "I'm Feeling Lucky" (&btnI=1) as it causes the redirect notice.
        return f"https://duckduckgo.com/?q={skill}+{topic}+official+documentation"

    return {
        "studyPlanTitle": "Personalized Study Plan",
        "companyName": company_name,
        "roleTitle": role_title,
        "missingSkill": missing_skill,
        "duration": "2 weeks (starter plan)",
        "notesType": notes_type,
        "topics": [
            {
                "id": "t1",
                "topic": f"{missing_skill}: Foundations",
                "officialLink": get_fallback_link(missing_skill, "foundations"),
                notes_key: get_notes(1),
            },
            {
                "id": "t2",
                "topic": f"{missing_skill}: Practical Usage",
                "officialLink": get_fallback_link(missing_skill, "practical usage"),
                notes_key: get_notes(2),
            },
            {
                "id": "t3",
                "topic": f"{missing_skill}: Interview Readiness",
                "officialLink": get_fallback_link(missing_skill, "interview questions"),
                notes_key: get_notes(3),
            },
            {
                "id": "t4",
                "topic": "Build for the Role",
                "officialLink": get_fallback_link(missing_skill, "projects"),
                notes_key: get_notes(4),
            },
            {
                "id": "t5",
                "topic": "Advanced Concepts",
                "officialLink": get_fallback_link(missing_skill, "advanced patterns"),
                notes_key: get_notes(5),
            },
            {
                "id": "t6",
                "topic": "Final Review",
                "officialLink": get_fallback_link(missing_skill, "roadmap"),
                notes_key: get_notes(6),
            }
        ],
        "generatedAt": now,
        "summary": "This starter plan helps you cover the missing skill with foundations, practical usage, interview readiness, and role-aligned output.",
    }


def generate_personalized_study_plan(
    resume_analysis: Dict[str, Any],
    role: Dict[str, Any],
    missing_skill: str,
    use_llm: bool = True,
    notes_type: str = "quick",  # "quick" or "long"
) -> Dict[str, Any]:
    company_name = str(role.get("companyName") or "")
    role_title = str(role.get("title") or "")
    missing_skill = str(missing_skill or "").strip()

    if not missing_skill:
        raise ValueError("missing_skill is required")

    if not use_llm:
        return _local_study_plan(company_name, role_title, missing_skill, notes_type)

    found_skills = resume_analysis.get("foundSkills") or []
    found_names: List[str] = []
    for s in found_skills:
        if isinstance(s, str):
            found_names.append(s)
        elif isinstance(s, dict) and s.get("name"):
            found_names.append(str(s["name"]))

    required = role.get("skillsRequired") or []
    nice = role.get("niceToHave") or []
    if isinstance(required, str):
        required = [x.strip() for x in required.split(",") if x.strip()]
    if isinstance(nice, str):
        nice = [x.strip() for x in nice.split(",") if x.strip()]

    notes_instruction = (
        "provide 3-5 high-quality 'quickNotes' per topic. Totaling around 150-200 words per topic. Include clear, simple examples within the notes to illustrate key concepts. The notes should be explained in a more detailed and explanatory way."
        if notes_type == "quick"
        else "provide 3-5 comprehensive 'longNotes' per topic. Totaling around 400-500 words per topic. Each note must include deep-dive explanations, very easy-to-understand real-time examples, and high-quality code snippets (properly formatted with backticks). The content must be detailed, highly explanatory, and use simple language for complex concepts. Ensure the total output for all 6 topics stays within the AI's response length limit."
    )

    notes_key = "quickNotes" if notes_type == "quick" else "longNotes"

    prompt = f"""
You are an expert placement coach and technical documentation specialist.

Create a TOPIC-WISE personalized study plan for the student to master the missing skill:
Missing skill: "{missing_skill}"

Target company/role:
Company: "{company_name}"
Role: "{role_title}"

Role requirements (for context):
Required skills: {json.dumps(required, ensure_ascii=False)}
Nice-to-have skills: {json.dumps(nice, ensure_ascii=False)}

Student resume skills (for context):
Found skills: {json.dumps(found_names[:25], ensure_ascii=False)}

Return ONLY valid JSON (no markdown) in this exact shape:
{{
  "studyPlanTitle": "Personalized Study Plan",
  "companyName": "{company_name}",
  "roleTitle": "{role_title}",
  "missingSkill": "{missing_skill}",
  "duration": "2 weeks",
  "notesType": "{notes_type}",
  "topics": [
    {{
      "id": "t1",
      "topic": "Topic title (max 80 chars)",
      "officialLink": "DIRECT CLEAN URL TO OFFICIAL DOCUMENTATION. Example: https://docs.djangoproject.com/en/stable/. DO NOT provide links starting with google.com/url or search engine results.",
      "{notes_key}": [
        "High-quality AI-generated note 1",
        "High-quality AI-generated note 2",
        "High-quality AI-generated note 3"
      ]
    }}
  ],
  "summary": "Short summary (1-2 sentences)",
  "generatedAt": "ISO timestamp"
}}

Rules:
- Generate exactly 6 topics (t1..t6).
- Keep strings single-line (no newline characters inside strings).
- MANDATORY: Every `officialLink` MUST be a direct, clean URL to the official documentation.
- ABSOLUTELY NO REDIRECTS: Do not provide links that go through google.com, bing.com, or any search engine.
- If you cannot find a direct documentation page, provide the official homepage of the technology (e.g., https://react.dev/).
- Instead of external links in the notes, {notes_instruction}
"""

    last_error: str = ""
    
    # Prioritize Gemini for Study Plans if available
    if GEMINI_STUDY_PLAN_KEY or GEMINI_API_KEY:
        try:
            print(f"DEBUG: Attempting Gemini generation for {missing_skill}...")
            plan = _post_gemini_text_json(prompt)
            # If Gemini returns wrapped data, normalize attempt
            if not isinstance(plan, dict) or "topics" not in plan:
                plan = plan.get("data", plan) if isinstance(plan, dict) else plan
            if isinstance(plan, dict) and "topics" in plan:
                print(f"DEBUG: Gemini generation successful.")
                return _normalize_plan(plan, company_name, role_title, missing_skill, notes_type)
            else:
                print(f"DEBUG: Gemini returned invalid shape: {type(plan)}")
        except Exception as e:
            last_error = f"Gemini error: {str(e)}"
            print(f"DEBUG: Gemini generation failed: {last_error}")

    # Try Groq as fallback
    if GROQ_API_KEY:
        try:
            print(f"DEBUG: Attempting Groq fallback for {missing_skill}...")
            data = _post_groq(
                {
                    "model": DEFAULT_GROQ_MODEL,
                    "temperature": 0.4,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You output strict JSON only, no markdown.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "response_format": {"type": "json_object"},
                }
            )
            content = (
                (data.get("choices") or [{}])[0]
                .get("message", {})
                .get("content")
                or "{}"
            )
            plan = json.loads(_strip_markdown(content))
            print(f"DEBUG: Groq generation successful.")
            return _normalize_plan(plan, company_name, role_title, missing_skill, notes_type)
        except Exception as e:
            last_error = f"{last_error} | Groq error: {str(e)}"
            print(f"DEBUG: Groq generation failed: {last_error}")

    # Final fallback: local template
    print(f"DEBUG: Using final local fallback for {missing_skill}.")
    plan = _local_study_plan(company_name, role_title, missing_skill, notes_type)
    plan["llmError"] = last_error.strip(" | ")
    return plan


def _normalize_plan(plan: Any, company_name: str, role_title: str, missing_skill: str, notes_type: str = "quick") -> Dict[str, Any]:
    """Ensures the plan dict has all required fields and correct shapes."""
    if not isinstance(plan, dict):
        return _local_study_plan(company_name, role_title, missing_skill, notes_type)

    topics = plan.get("topics")
    if not isinstance(topics, list) or not topics:
        # If topics is missing or empty, try to get from nested 'data' or 'plan'
        if isinstance(plan.get("plan"), dict):
            topics = plan["plan"].get("topics")
        elif isinstance(plan.get("data"), dict):
            topics = plan["data"].get("topics")
            
    if not isinstance(topics, list) or not topics:
        return _local_study_plan(company_name, role_title, missing_skill, notes_type)

    # Ensure exactly 6 topics
    if len(topics) > 6:
        topics = topics[:6]
    elif len(topics) < 6:
        fallback = _local_study_plan(company_name, role_title, missing_skill, notes_type)
        fallback_topics = fallback.get("topics") or []
        topics = (topics + fallback_topics)[:6]

    # Clean up topics and ensure IDs/titles exist
    notes_key = "quickNotes" if notes_type == "quick" else "longNotes"
    for i, t in enumerate(topics):
        if not isinstance(t, dict):
            topics[i] = {"id": f"t{i+1}", "topic": f"Topic {i+1}", notes_key: []}
            continue
        
        t["id"] = str(t.get("id") or f"t{i+1}")
        t["topic"] = str(t.get("topic") or f"Topic {i+1}")
        
        # Ensure notes list exists
        if notes_key not in t or not isinstance(t[notes_key], list):
            t[notes_key] = []
            
        # Clean up officialLink to remove redirect wrappers
        link = str(t.get("officialLink") or "")
        if link:
            # Aggressive Redirect Stripping
            import urllib.parse
            
            # Handle common search engine redirect wrappers and encoded params
            if any(x in link.lower() for x in ["google.com/url?", "bing.com/ck/a?", "yahoo.com/"] ):
                try:
                    parsed = urllib.parse.urlparse(link)
                    params = urllib.parse.parse_qs(parsed.query)
                    # Try common redirect parameter names
                    found = False
                    for p in ["q", "url", "u", "adurl"]:
                        if p in params:
                            link = params[p][0]
                            found = True
                            break
                    
                    # Double-clean: handle double-encoded URLs
                    if found:
                        link = urllib.parse.unquote(link)
                except:
                    pass
            
            # Remove any trailing periods, whitespace, or quotes that AI might add
            link = link.strip().strip("'").strip('"').rstrip(".")
            
            # Final check: if the link is still a search query, force it through our mapping
            link_lower = link.lower()
            if any(x in link_lower for x in ["google.com/search", "bing.com/search", "duckduckgo.com/"] ):
                topic_name = t.get("topic", "")
                link = get_fallback_link(missing_skill, topic_name)
                
            t["officialLink"] = link

        # Cleanup strings
        for k, v in list(t.items()):
            if isinstance(v, str):
                val = v.replace("\n", " ").replace("\r", " ").strip()
                # Remove (Topic X) suffix if present
                import re
                val = re.sub(r"\s*\(Topic\s*\d+\)\s*$", "", val, flags=re.IGNORECASE)
                t[k] = val
            elif isinstance(v, list):
                new_list = []
                for item in v:
                    if isinstance(item, str):
                        val = item.replace("\n", " ").replace("\r", " ").strip()
                        import re
                        val = re.sub(r"\s*\(Topic\s*\d+\)\s*$", "", val, flags=re.IGNORECASE)
                        new_list.append(val)
                    else:
                        new_list.append(item)
                t[k] = new_list

    plan_out = {
        "studyPlanTitle": str(plan.get("studyPlanTitle") or "Personalized Study Plan"),
        "companyName": str(plan.get("companyName") or company_name),
        "roleTitle": str(plan.get("roleTitle") or role_title),
        "missingSkill": str(plan.get("missingSkill") or missing_skill),
        "duration": str(plan.get("duration") or "2 weeks"),
        "notesType": str(plan.get("notesType") or notes_type),
        "topics": topics,
        "summary": str(plan.get("summary") or ""),
        "generatedAt": str(plan.get("generatedAt") or (datetime.utcnow().isoformat() + "Z")),
    }
    return plan_out


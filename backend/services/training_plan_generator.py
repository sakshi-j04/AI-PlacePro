"""LLM-based Personalized Training Plan Generator"""
from config import USE_LLM, OPENAI_API_KEY

def generate_training_plan_local(analysis_data, user_data=None):
    """Generate training plan without LLM - rule-based personalized plan"""
    found_skills = analysis_data.get("foundSkills", [])
    missing_skills = analysis_data.get("missingSkills", [])
    scores = analysis_data.get("scores", {})
    placement_pred = analysis_data.get("placementPrediction", {})
    
    # Daily tasks based on gaps
    daily_tasks = []
    
    # DSA practice (always recommended)
    daily_tasks.append({
        "id": 1,
        "title": "Solve 3 DSA problems (Medium level)",
        "duration": "45 mins",
        "category": "Coding",
        "priority": "High",
        "reason": "Data Structures & Algorithms is critical for technical interviews"
    })
    
    # Based on missing skills
    high_priority_missing = [s for s in missing_skills if s.get("priority") == "High"][:2]
    for i, skill in enumerate(high_priority_missing):
        daily_tasks.append({
            "id": len(daily_tasks) + 1,
            "title": f"Learn {skill['name']} - tutorials & practice",
            "duration": "60 mins",
            "category": skill.get("category", "Technical"),
            "priority": "High",
            "reason": f"High-demand skill in placement drives"
        })
    
    # System design if missing
    if any("system design" in s.get("name", "").lower() for s in missing_skills):
        daily_tasks.append({
            "id": len(daily_tasks) + 1,
            "title": "System Design fundamentals - study",
            "duration": "45 mins",
            "category": "Architecture",
            "priority": "High",
            "reason": "Expected in product company interviews"
        })
    
    # Mock interview
    daily_tasks.append({
        "id": len(daily_tasks) + 1,
        "title": "AI Mock Interview / Behavioral prep",
        "duration": "30 mins",
        "category": "Interview",
        "priority": "Medium",
        "reason": "Practice improves confidence"
    })
    
    # Weekly roadmap
    weekly_plan = [
        {"week": 1, "focus": "DSA Foundation - Arrays, Strings, HashMaps", "goals": ["Complete 15 problems", "Revise complexity analysis"]},
        {"week": 2, "focus": "DSA Intermediate - Trees, Graphs", "goals": ["Complete 12 problems", "Learn traversal patterns"]},
        {"week": 3, "focus": "System Design Basics", "goals": ["Study scaling concepts", "Design 2 systems"]},
        {"week": 4, "focus": "Mock Interviews & Resume Polish", "goals": ["5 mock interviews", "Update resume with new skills"]},
    ]
    
    # AI recommendations
    recommendations = []
    
    if scores.get("overall", 0) < 70:
        recommendations.append({
            "icon": "📄",
            "title": "Improve Resume Score",
            "description": "Focus on adding keywords and quantifiable achievements to boost ATS compatibility"
        })
    
    if len(missing_skills) > 5:
        recommendations.append({
            "icon": "🎯",
            "title": "Focus on High-Priority Skills",
            "description": f"Prioritize learning: {', '.join([s['name'] for s in high_priority_missing[:3]])}"
        })
    
    recommendations.extend([
        {"icon": "📚", "title": "Complete SQL Course", "description": "Database skills will boost your profile by 15%"},
        {"icon": "💼", "title": "Practice Behavioral Questions", "description": "Improve interview performance with our AI mock tool"},
    ])
    
    return {
        "dailyTasks": daily_tasks,
        "weeklyPlan": weekly_plan,
        "recommendations": recommendations[:5],
        "estimatedReadiness": f"{min(12, max(4, 4 + len(high_priority_missing) * 2))} weeks to placement-ready"
    }

def generate_training_plan_llm(analysis_data, user_data=None):
    """Generate training plan using LLM (OpenAI)"""
    if not USE_LLM or not OPENAI_API_KEY:
        return generate_training_plan_local(analysis_data, user_data)
    
    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        
        found_skills = [s["name"] for s in analysis_data.get("foundSkills", [])]
        missing_skills = [f"{s['name']} ({s['priority']})" for s in analysis_data.get("missingSkills", [])[:10]]
        scores = analysis_data.get("scores", {})
        
        prompt = f"""You are an expert placement coach. Create a personalized 4-week training plan for a student.

Student's current skills: {', '.join(found_skills[:15]) if found_skills else 'Not specified'}
Missing skills (priority): {', '.join(missing_skills) if missing_skills else 'None'}
Resume score: {scores.get('overall', 0)}/100

Return a JSON object with this exact structure:
{{
  "dailyTasks": [
    {{"title": "task name", "duration": "X mins", "category": "Category", "priority": "High/Medium/Low", "reason": "brief reason"}}
  ],
  "weeklyPlan": [
    {{"week": 1, "focus": "Week focus", "goals": ["goal1", "goal2"]}}
  ],
  "recommendations": [
    {{"icon": "emoji", "title": "title", "description": "description"}}
  ],
  "estimatedReadiness": "X weeks to placement-ready",
  "motivationalMessage": "A short motivational message for the student"
}}

Give 4-6 daily tasks, 4 weeks plan, 3-5 recommendations. Be specific and actionable. Output ONLY valid JSON."""

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1500
        )
        
        import json
        content = response.choices[0].message.content.strip()
        # Clean markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content)
        
        # Add IDs to tasks
        for i, task in enumerate(result.get("dailyTasks", []), 1):
            task["id"] = i
        
        return result
        
    except Exception as e:
        print(f"LLM training plan error: {e}")
        return generate_training_plan_local(analysis_data, user_data)

def generate_training_plan(analysis_data, user_data=None, use_llm=None):
    """Main entry - generate training plan (LLM if available, else local)"""
    if use_llm is None:
        use_llm = USE_LLM
    if use_llm:
        return generate_training_plan_llm(analysis_data, user_data)
    return generate_training_plan_local(analysis_data, user_data)

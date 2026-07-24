/**
 * API Configuration
 * Frontend talks to Flask backend on http://localhost:5000
 */
const API_CONFIG = {
    BASE_URL: 'http://localhost:5000',  // Flask backend base URL
    ENABLED: true
};

/**
 * Get company job roles from localStorage (used for skill gap detection)
 */
function getJobRolesForSkillGap() {
    try {
        const roles = JSON.parse(localStorage.getItem('allJobRoles') || '[]');
        return Array.isArray(roles) ? roles : [];
    } catch {
        return [];
    }
}

/**
 * Refresh job roles from backend.
 * Backend is the single source of truth so deletions on company side
 * are reflected on student dashboards immediately.
 */
async function refreshJobRolesFromAPI() {
    if (API_CONFIG.ENABLED && API_CONFIG.BASE_URL) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/companies/job-roles`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.jobRoles) && data.jobRoles.length > 0) {
                    // Replace local cache with backend list so removed roles disappear for students
                    localStorage.setItem('allJobRoles', JSON.stringify(data.jobRoles));
                    return;
                }
            }
        } catch (e) {
            console.warn('Could not fetch job roles from API:', e.message);
        }
    }
}

/**
 * Call resume analysis API
 * @param {File} file - Resume file to analyze
 * @param {Array} jobRoles - Optional company job roles for skill gap (from getJobRolesForSkillGap)
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeResumeAPI(file, jobRoles) {
    if (!API_CONFIG.ENABLED || !API_CONFIG.BASE_URL) return null;
    
    const formData = new FormData();
    formData.append('resume', file);
    const roles = jobRoles || getJobRolesForSkillGap();
    if (roles.length) formData.append('jobRoles', JSON.stringify(roles));
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/resume/analyze`, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success && data.scores) {
        return {
            fileName: data.fileName,
            uploadDate: data.uploadDate || new Date().toISOString(),
            scores: data.scores,
            foundSkills: data.foundSkills || [],
            missingSkills: data.missingSkills || [],
            requirements: data.requirements || {},
            strengths: data.strengths || [],
            improvements: data.improvements || [],
            placementPrediction: data.placementPrediction || {}
        };
    }
    throw new Error('Invalid response from server');
}

/**
 * Generate topic-wise personalized study plan for a company role + missing skill.
 * @param {Object} resumeData
 * @param {Object} role - company job role object (title, companyName, skillsRequired, niceToHave, etc.)
 * @param {string} missingSkill
 * @param {string} notesType - "quick" or "long"
 */
async function getStudyPlanAPI(resumeData, role, missingSkill, notesType = 'quick') {
    if (!API_CONFIG.ENABLED || !API_CONFIG.BASE_URL) return null;
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/training/study-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resumeData,
                role,
                missingSkill,
                useLLM: true,
                notesType,
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data.plan || null;
    } catch (e) {
        console.warn('API study plan failed:', e.message);
        throw e;
    }
}

/**
 * Generate a combined 50-question interview assessment for all missing skills of a company role.
 * @param {Array<string>} skills
 * @param {string} companyName
 * @param {string} roleTitle
 */
async function generateCombinedAssessmentAPI(skills, companyName, roleTitle) {
    if (!API_CONFIG.ENABLED || !API_CONFIG.BASE_URL) return null;
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/training/combined-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills, companyName, roleTitle })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data.assessment || null;
}

/**
 * Save resume analysis to database for logged-in user
 * @param {string} email - User email
 * @param {Object} resumeData - Resume analysis data
 * @returns {Promise<boolean>} Success
 */
async function saveResumeToAPI(email, resumeData) {
    if (!API_CONFIG.ENABLED || !API_CONFIG.BASE_URL || !email || !resumeData) return false;
    try {
        const r = await fetch(`${API_CONFIG.BASE_URL}/api/auth/save-resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, resumeData })
        });
        if (r.ok) {
            const data = await r.json();
            if (data.user) localStorage.setItem('currentUser', JSON.stringify(data.user));
            return true;
        }
    } catch (e) {
        console.warn('Could not save resume to backend:', e.message);
    }
    return false;
}

/**
 * Fetch accurate job-resume compatibility from backend (single source of truth)
 * @param {Object} resumeData - Resume analysis (foundSkills, etc.)
 * @returns {Promise<Array>} matches from backend or []
 */
async function getJobMatchesAPI(resumeData) {
    if (!API_CONFIG.ENABLED || !API_CONFIG.BASE_URL || !resumeData) return [];
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/resume/job-matches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resumeData })
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.success && Array.isArray(data.matches) ? data.matches : [];
    } catch (e) {
        console.warn('Job matches API failed:', e.message);
        return [];
    }
}

/**
 * Check if backend API is healthy
 */
async function checkAPIHealth() {
    if (!API_CONFIG.BASE_URL) return false;
    try {
        const r = await fetch(`${API_CONFIG.BASE_URL}/api/health`);
        return r.ok;
    } catch {
        return false;
    }
}

/**
 * Generate a full coding practice test via backend (Groq).
 * @param {string} skill
 * @param {'easy'|'medium'|'hard'} difficulty
 */
async function generatePracticeTestAPI(skill, difficulty) {
    if (!API_CONFIG.ENABLED || !API_CONFIG.BASE_URL) return null;
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/training/practice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill, difficulty })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data.test || null;
}

/**
 * Evaluate a coding practice test via backend (Groq).
 * @param {Object} test
 * @param {Array} answers
 * @param {string} language
 */
async function evaluatePracticeTestAPI(test, answers, language) {
    if (!API_CONFIG.ENABLED || !API_CONFIG.BASE_URL) return null;
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/training/practice/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test, answers, language })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data.result || null;
}

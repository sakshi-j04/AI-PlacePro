// Resume Analyzer JavaScript

// File upload handling
const resumeInput = document.getElementById('resumeInput');
const uploadArea = document.getElementById('uploadArea');
let currentResumeFile = null; // Store current file globally

function ensureStatusEl() {
    let el = document.getElementById('resumeStatusMessage');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'resumeStatusMessage';
    el.style.cssText = `
        max-width: 700px;
        margin: 1rem auto 0;
        padding: 0.9rem 1rem;
        border-radius: 0.75rem;
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.25);
        color: #991b1b;
        font-weight: 600;
        display: none;
    `;
    const container = document.querySelector('.resume-analyzer-container') || document.body;
    container.insertBefore(el, container.firstChild);
    return el;
}

function showInlineError(message) {
    const el = ensureStatusEl();
    el.textContent = message;
    el.style.display = 'block';
}

function clearInlineError() {
    const el = document.getElementById('resumeStatusMessage');
    if (el) el.style.display = 'none';
}

// If this script is loaded on a page without the resume analyzer DOM,
// avoid throwing and breaking other scripts.
if (!resumeInput || !uploadArea) {
    console.warn('Resume analyzer: required elements not found.');
} else {
// Drag and drop functionality
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#6366f1';
    uploadArea.style.background = 'rgba(99, 102, 241, 0.05)';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '#e5e7eb';
    uploadArea.style.background = 'white';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#e5e7eb';
    uploadArea.style.background = 'white';
    
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
});

resumeInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFileUpload(file);
});

function handleFileUpload(file) {
    if (!file) return;
    clearInlineError();
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
        showInlineError('Please upload a PDF or DOC/DOCX file.');
        return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        showInlineError('File size must be less than 5MB.');
        return;
    }
    
    // Store file globally
    currentResumeFile = file;
    
    // Hide upload section and show loading
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('analysisLoading').style.display = 'block';
    
    // Simulate file analysis with loading steps
    analyzeResume(file);
}

async function analyzeResume(file) {
    const steps = ['step1', 'step2', 'step3', 'step4', 'step5'];
    let currentStep = 0;
    
    // Real-time: Call backend API (NLP + placement model)
    let apiResult = null;
    let apiError = null;
    if (typeof analyzeResumeAPI === 'function') {
        try {
            const jobRoles = typeof getJobRolesForSkillGap === 'function' ? getJobRolesForSkillGap() : [];
            apiResult = await analyzeResumeAPI(file, jobRoles);
            if (!apiResult) apiError = 'Backend returned no data';
        } catch (e) {
            apiError = e?.message || 'Analysis failed';
        }
    } else {
        apiError = 'API not configured';
    }
    
    const stepInterval = setInterval(() => {
        if (currentStep > 0) {
            const prevStep = document.getElementById(steps[currentStep - 1]);
            if (prevStep) prevStep.innerHTML = '✓ ' + prevStep.textContent.substring(2);
        }
        
        if (currentStep < steps.length) {
            currentStep++;
        } else {
            clearInterval(stepInterval);
            
            setTimeout(() => {
                if (apiError) {
                    showApiError(apiError);
                    return;
                }
                showResults(apiResult);
            }, 500);
        }
    }, 600);
}

function showApiError(message) {
    document.getElementById('analysisLoading').style.display = 'none';
    document.getElementById('uploadSection').style.display = 'block';
    document.getElementById('resumeInput').value = '';
    currentResumeFile = null;
    // In some environments (blocked popups / file://), alerts can be missed.
    // Show a clear inline error as well.
    showInlineError('Resume analysis failed: ' + message + ' (Backend should be running at http://localhost:5000)');
}

function showResults(apiData) {
    if (!apiData || !apiData.scores) {
        showApiError('Invalid response from server (missing scores).');
        return;
    }
    // Hide loading
    document.getElementById('analysisLoading').style.display = 'none';
    
    // Show results
    document.getElementById('resultsSection').style.display = 'block';
    
    let scores, foundSkills, missingSkills, requirements, strengths, improvements, placementPrediction;
    
    scores = apiData.scores;
    foundSkills = apiData.foundSkills || [];
    missingSkills = apiData.missingSkills || [];
    requirements = apiData.requirements || {};
    strengths = apiData.strengths || [];
    improvements = apiData.improvements || [];
    placementPrediction = apiData.placementPrediction || {};
    
    // Animate scores
    animateScore('overall', scores.overall);
    animateBreakdown('ats', scores.ats);
    animateBreakdown('keywords', scores.keywords);
    animateBreakdown('content', scores.content);
    animateBreakdown('format', scores.format);
    
    // Set score message
    const scoreMessage = document.getElementById('scoreMessage');
    if (scores.overall >= 80) {
        scoreMessage.textContent = 'Excellent! Your resume is highly competitive!';
        scoreMessage.style.color = '#10b981';
    } else if (scores.overall >= 60) {
        scoreMessage.textContent = 'Good resume with room for improvement';
        scoreMessage.style.color = '#f59e0b';
    } else {
        scoreMessage.textContent = 'Your resume needs significant improvements';
        scoreMessage.style.color = '#ef4444';
    }
    
    // Save to localStorage with detailed data
    saveResumeAnalysis({
        fileName: currentResumeFile ? currentResumeFile.name : (apiData && apiData.fileName) ? apiData.fileName : 'resume.pdf',
        uploadDate: new Date().toISOString(),
        scores: scores,
        foundSkills: foundSkills,
        missingSkills: missingSkills,
        requirements: requirements,
        strengths: strengths,
        improvements: improvements,
        placementPrediction: placementPrediction
    });
    
    // Notify dashboard to refresh if it's open
    window.dispatchEvent(new CustomEvent('resumeAnalyzed'));
}

function animateScore(type, targetScore) {
    const scoreElement = document.getElementById(type + 'Score');
    const circle = document.getElementById('scoreCircle');
    
    let currentScore = 0;
    const increment = targetScore / 50;
    
    const interval = setInterval(() => {
        currentScore += increment;
        if (currentScore >= targetScore) {
            currentScore = targetScore;
            clearInterval(interval);
        }
        
        scoreElement.textContent = Math.round(currentScore);
        
        // Update circle stroke
        const circumference = 2 * Math.PI * 90;
        const offset = circumference - (currentScore / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }, 20);
}

function animateBreakdown(category, targetScore) {
    const barElement = document.getElementById(category + 'Bar');
    const scoreElement = document.getElementById(category + 'Score');
    
    let currentScore = 0;
    const increment = targetScore / 50;
    
    const interval = setInterval(() => {
        currentScore += increment;
        if (currentScore >= targetScore) {
            currentScore = targetScore;
            clearInterval(interval);
        }
        
        barElement.style.width = currentScore + '%';
        scoreElement.textContent = Math.round(currentScore) + '%';
        
        // Set color based on score
        if (currentScore >= 80) {
            barElement.style.background = '#10b981';
        } else if (currentScore >= 60) {
            barElement.style.background = '#f59e0b';
        } else {
            barElement.style.background = '#ef4444';
        }
    }, 20);
}

// Tab switching
function showTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Remove active class from all buttons
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').style.display = 'block';
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

// Action buttons
function downloadReport() {
    alert('Downloading detailed PDF report...');
    // Here you would generate and download a PDF report
}

function optimizeResume() {
    alert('Auto-optimization feature coming soon! This will automatically improve your resume based on AI suggestions.');
    // Here you would implement auto-optimization logic
}

function resetAnalyzer() {
    // Reset to upload state
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('uploadSection').style.display = 'block';
    document.getElementById('resumeInput').value = '';
    currentResumeFile = null; // Clear stored file
}

// Helper functions to extract skills and requirements
function extractFoundSkills() {
    // Simulated - in real app, this would parse the resume file
    // For now, return common skills that might be found
    return [
        { name: 'Python', level: 85, category: 'Programming Language' },
        { name: 'JavaScript', level: 80, category: 'Programming Language' },
        { name: 'React', level: 75, category: 'Framework' },
        { name: 'SQL', level: 70, category: 'Database' },
        { name: 'Git', level: 80, category: 'Tools' },
        { name: 'REST API', level: 75, category: 'Backend' },
        { name: 'Problem Solving', level: 90, category: 'Soft Skill' },
        { name: 'Data Structures & Algorithms', level: 88, category: 'Core CS' },
        { name: 'Communication Skills', level: 85, category: 'Soft Skill' },
        { name: 'Team Collaboration', level: 80, category: 'Soft Skill' }
    ];
}

function extractMissingSkills() {
    // Simulated - in real app, compare with industry requirements
    return [
        { name: 'Docker', priority: 'High', category: 'DevOps' },
        { name: 'Kubernetes', priority: 'High', category: 'DevOps' },
        { name: 'AWS', priority: 'High', category: 'Cloud' },
        { name: 'System Design', priority: 'High', category: 'Architecture' },
        { name: 'Agile Methodology', priority: 'Medium', category: 'Process' },
        { name: 'CI/CD', priority: 'Medium', category: 'DevOps' },
        { name: 'Microservices', priority: 'Medium', category: 'Architecture' },
        { name: 'Database Management', priority: 'Medium', category: 'Database' },
        { name: 'Time Management', priority: 'Low', category: 'Soft Skill' },
        { name: 'Public Speaking', priority: 'Low', category: 'Soft Skill' }
    ];
}

function getIndustryRequirements() {
    // Simulated industry requirements for software developer roles
    return {
        technical: [
            'Proficiency in at least 2 programming languages',
            'Experience with version control (Git)',
            'Understanding of databases (SQL/NoSQL)',
            'Knowledge of RESTful APIs',
            'Familiarity with cloud platforms (AWS/Azure/GCP)'
        ],
        soft: [
            'Strong problem-solving abilities',
            'Effective communication skills',
            'Team collaboration experience',
            'Time management',
            'Adaptability'
        ],
        certifications: [
            'Cloud certifications (AWS, Azure, GCP)',
            'Agile/Scrum certifications',
            'Technology-specific certifications'
        ]
    };
}

function getStrengths() {
    return [
        'Strong Technical Skills Section',
        'Quantifiable Achievements',
        'Clean Formatting',
        'Action-Oriented Language'
    ];
}

function getImprovements() {
    return [
        { title: 'Missing Keywords for Target Role', priority: 'High', description: 'Add industry-standard terms: "Agile methodology," "CI/CD," "microservices architecture"' },
        { title: 'Weak Summary Section', priority: 'Medium', description: 'Your summary doesn\'t clearly communicate your unique value proposition' },
        { title: 'Limited Project Descriptions', priority: 'Low', description: 'Expand on your project work to showcase problem-solving abilities' },
        { title: 'No Certifications Listed', priority: 'Medium', description: 'If you have relevant certifications, add them to strengthen your profile' }
    ];
}

// Generate placement prediction based on resume analysis
function generatePlacementPrediction(scores, foundSkills, missingSkills) {
    // Calculate placement readiness score (0-10)
    const overallScore = scores.overall || 0;
    const atsScore = scores.ats || 0;
    const skillsCount = foundSkills.length;
    const missingCount = missingSkills.length;
    
    // Calculate base score (0-10 scale)
    let placementScore = (overallScore / 100) * 10;
    
    // Adjust based on skills
    if (skillsCount >= 8) placementScore += 0.5;
    if (skillsCount >= 12) placementScore += 0.3;
    if (missingCount <= 5) placementScore += 0.2;
    if (missingCount > 8) placementScore -= 0.5;
    
    // Cap at 10
    placementScore = Math.min(10, Math.max(0, placementScore));
    
    // Determine best fit roles based on found skills
    const bestFitRoles = determineBestFitRoles(foundSkills);
    
    // Determine target companies based on score
    const targetCompanies = determineTargetCompanies(placementScore);
    
    // Estimate salary range based on score and skills
    const salaryRange = estimateSalaryRange(placementScore, foundSkills);
    
    // Determine verdict
    let verdict = '';
    let verdictClass = '';
    if (placementScore >= 8.5) {
        verdict = 'Excellent prospects for placement!';
        verdictClass = 'success';
    } else if (placementScore >= 7.0) {
        verdict = 'Good prospects for placement!';
        verdictClass = 'success';
    } else if (placementScore >= 5.5) {
        verdict = 'Moderate prospects - focus on skill improvement';
        verdictClass = 'warning';
    } else {
        verdict = 'Needs significant improvement before placement';
        verdictClass = 'danger';
    }
    
    return {
        score: Math.round(placementScore * 10) / 10, // Round to 1 decimal
        verdict: verdict,
        verdictClass: verdictClass,
        bestFitRoles: bestFitRoles,
        targetCompanies: targetCompanies,
        salaryRange: salaryRange,
        generatedAt: new Date().toISOString()
    };
}

function determineBestFitRoles(foundSkills) {
    const skillNames = foundSkills.map(s => s.name.toLowerCase());
    const roles = [];
    
    // Check for full-stack skills
    if (skillNames.some(s => s.includes('react') || s.includes('javascript')) && 
        skillNames.some(s => s.includes('node') || s.includes('backend'))) {
        roles.push('Full Stack Engineer');
    }
    
    // Check for frontend skills
    if (skillNames.some(s => s.includes('react') || s.includes('javascript') || s.includes('frontend'))) {
        roles.push('Frontend Developer');
    }
    
    // Check for backend skills
    if (skillNames.some(s => s.includes('node') || s.includes('python') || s.includes('backend'))) {
        roles.push('Backend Developer');
    }
    
    // Check for data skills
    if (skillNames.some(s => s.includes('data') || s.includes('sql') || s.includes('database'))) {
        roles.push('Data Engineer');
    }
    
    // Default roles if no specific match
    if (roles.length === 0) {
        roles.push('Software Developer', 'Junior Developer', 'Associate Developer');
    }
    
    return roles.slice(0, 3); // Return top 3
}

function determineTargetCompanies(score) {
    if (score >= 8.5) {
        return ['Product-based (FAANG tier)', 'Mid-size tech companies', 'Startups (Series A+)'];
    } else if (score >= 7.0) {
        return ['Mid-size tech companies', 'Startups (Series A+)', 'Service-based companies'];
    } else if (score >= 5.5) {
        return ['Startups (Series A+)', 'Service-based companies', 'IT consulting firms'];
    } else {
        return ['Service-based companies', 'IT consulting firms', 'Small startups'];
    }
}

function estimateSalaryRange(score, foundSkills) {
    const skillsCount = foundSkills.length;
    let baseMin = 3; // LPA
    let baseMax = 6; // LPA
    
    // Adjust based on score
    if (score >= 8.5) {
        baseMin = 8;
        baseMax = 15;
    } else if (score >= 7.0) {
        baseMin = 6;
        baseMax = 12;
    } else if (score >= 5.5) {
        baseMin = 4;
        baseMax = 8;
    }
    
    // Adjust based on skills count
    if (skillsCount >= 10) {
        baseMin += 1;
        baseMax += 2;
    }
    
    return `₹${baseMin}-${baseMax} LPA`;
}

// Save resume analysis to localStorage and database (when user logged in)
function saveResumeAnalysis(data) {
    try {
        localStorage.setItem('lastResumeAnalysis', JSON.stringify(data));
    } catch (e) {
        console.warn('Could not store lastResumeAnalysis:', e?.message || e);
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser) {
        currentUser.resumeData = data;
        currentUser.resumeUploaded = true;
        currentUser.skillsAnalyzed = true;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        if (typeof saveResumeToAPI === 'function' && currentUser.email) {
            saveResumeToAPI(currentUser.email, data).catch(() => {});
        }
    }
}

// Initialize score circle and fetch company jobs so skill-gap uses latest postings
window.addEventListener('DOMContentLoaded', () => {
    const circle = document.getElementById('scoreCircle');
    if (circle) {
        const circumference = 2 * Math.PI * 90;
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = circumference;
    }
    if (typeof refreshJobRolesFromAPI === 'function') refreshJobRolesFromAPI();
});
}

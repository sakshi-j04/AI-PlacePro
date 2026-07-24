// Dashboard JavaScript
let latestResumeData = null;
let jobMatchesCache = { key: '', ts: 0, matches: [] };

function escapeHtml(s) {
    return (s ?? '').toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function _resumeKey(resumeData) {
    const skills = (resumeData?.foundSkills || [])
        .map(s => (typeof s === 'string' ? s : (s?.name || '')).toString().toLowerCase().trim())
        .filter(Boolean)
        .sort();
    return `${skills.length}:${skills.join('|')}`;
}

async function getJobMatchesCached(resumeData) {
    const key = _resumeKey(resumeData);
    const now = Date.now();
    const ttlMs = 15000;

    if (jobMatchesCache.matches && jobMatchesCache.matches.length > 0 && jobMatchesCache.key === key && (now - jobMatchesCache.ts) < ttlMs) {
        return jobMatchesCache.matches;
    }

    if (typeof getJobMatchesAPI !== 'function') return [];
    try {
        const matches = await getJobMatchesAPI(resumeData);
        jobMatchesCache = { key, ts: now, matches: Array.isArray(matches) ? matches : [] };
        return jobMatchesCache.matches;
    } catch (e) {
        return [];
    }
}

// Check authentication on page load
window.addEventListener('DOMContentLoaded', () => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    if (!currentUser) {
        // Redirect to login if not authenticated
        window.location.href = 'login.html';
        return;
    }

    // If resume analysis was done while logged out / on a different page,
    // recover the latest analysis and attach it to the current user.
    try {
        if ((!currentUser.resumeData || !currentUser.resumeUploaded) && localStorage.getItem('lastResumeAnalysis')) {
            const last = JSON.parse(localStorage.getItem('lastResumeAnalysis'));
            if (last && last.scores) {
                currentUser.resumeData = last;
                currentUser.resumeUploaded = true;
                currentUser.skillsAnalyzed = true;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));

                let users = JSON.parse(localStorage.getItem('users')) || [];
                const userIndex = users.findIndex(u => u.id === currentUser.id);
                if (userIndex !== -1) {
                    users[userIndex] = currentUser;
                    localStorage.setItem('users', JSON.stringify(users));
                }
            }
        }
    } catch (e) {
        console.warn('Could not restore lastResumeAnalysis:', e.message);
    }

    // Load user data
    loadUserData(currentUser);

    // Refresh company jobs from backend first, then load resume data and job matches
    (async function loadDashboard() {
        if (typeof refreshJobRolesFromAPI === 'function') {
            await refreshJobRolesFromAPI();
        }
        if (currentUser.resumeData && currentUser.resumeUploaded) {
            loadResumeData(currentUser.resumeData);
            loadJobMatches(currentUser.resumeData);
        } else {
            showNoResumeMessage();
            loadJobMatches(null); // show "upload resume" or "no jobs" message
        }
    })();

    // Refresh data periodically to catch updates from resume page and new company jobs
    setInterval(async () => {
        const currentSection = document.querySelector('.content-section.active');
        if (currentSection && currentSection.id === 'homeSection') {
            if (typeof refreshJobRolesFromAPI === 'function') await refreshJobRolesFromAPI();
            const updatedUser = JSON.parse(localStorage.getItem('currentUser'));
            if (updatedUser && updatedUser.resumeData && updatedUser.resumeUploaded) {
                loadResumeData(updatedUser.resumeData);
                loadJobMatches(updatedUser.resumeData);
            }
        }
    }, 3000);

    // Animate skill bars
    setTimeout(() => {
        animateSkillBars();
    }, 500);

    // Listen for resume analysis completion
    window.addEventListener('resumeAnalyzed', () => {
        setTimeout(() => {
            const currentUser = JSON.parse(localStorage.getItem('currentUser'));
            if (currentUser && currentUser.resumeData) {
                loadResumeData(currentUser.resumeData);
                animateSkillBars();
                showNotification('Resume analyzed! Dashboard updated with new data.');
                loadJobMatches(currentUser.resumeData);
            }
        }, 500);
    });
});

// Load user data into dashboard
function loadUserData(user) {
    // Set user name
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const welcomeName = document.getElementById('welcomeName');
    const userInitials = document.getElementById('userInitials');

    if (userName) userName.textContent = user.fullName;
    if (userEmail) userEmail.textContent = user.email;
    if (welcomeName) welcomeName.textContent = user.fullName.split(' ')[0];
    if (userInitials) {
        const initials = user.fullName.split(' ').map(n => n[0]).join('').toUpperCase();
        userInitials.textContent = initials;
    }
}

// Toggle user dropdown menu
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('show');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');

    if (userMenu && dropdown && !userMenu.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});

// Show section
function showSection(sectionName, clickedElement) {
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });

    // Show selected section
    const targetSection = document.getElementById(sectionName + 'Section');
    if (targetSection) {
        targetSection.style.display = 'block';
        setTimeout(() => {
            targetSection.classList.add('active');
        }, 10);
    }

    // Update active nav item
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });

    // Find and activate the clicked nav item
    if (clickedElement) {
        clickedElement.classList.add('active');
    } else {
        // Fallback: find nav item by section name
        const navItem = Array.from(navItems).find(item => {
            const onclick = item.getAttribute('onclick');
            return onclick && onclick.includes(`'${sectionName}'`);
        });
        if (navItem) {
            navItem.classList.add('active');
        }
    }

    // Re-animate if home section
    if (sectionName === 'home') {
        setTimeout(() => {
            animateSkillBars();
        }, 300);
    }

    // Load section content if needed
    loadSectionContent(sectionName);
}

// Animate skill bars
function animateSkillBars() {
    const skillBars = document.querySelectorAll('.skill-bar');
    skillBars.forEach(bar => {
        const width = bar.style.width;
        bar.style.width = '0';
        setTimeout(() => {
            bar.style.width = width;
        }, 100);
    });
}

function _readPracticeAttempts() {
    try {
        const obj = JSON.parse(localStorage.getItem('practiceAttempts') || '[]');
        return Array.isArray(obj) ? obj : [];
    } catch {
        return [];
    }
}

function _writePracticeAttempts(attempts) {
    try {
        localStorage.setItem('practiceAttempts', JSON.stringify(Array.isArray(attempts) ? attempts : []));
    } catch { /* ignore */ }
}

function getCoveredSkillsSet() {
    const attempts = _readPracticeAttempts();
    const bestBySkill = new Map();
    for (const a of attempts) {
        const skill = (a?.skill || '').toString().toLowerCase().trim();
        const score = Number(a?.score) || 0;
        if (!skill) continue;
        const prev = bestBySkill.get(skill) || 0;
        if (score > prev) bestBySkill.set(skill, score);
    }
    const covered = new Set();
    for (const [skill, best] of bestBySkill.entries()) {
        if (best >= 70) covered.add(skill);
    }
    return covered;
}

function getEffectiveSkillNames(resumeData) {
    const found = (resumeData?.foundSkills || [])
        .map(s => (typeof s === 'string' ? s : (s?.name || '')).toString().toLowerCase().trim())
        .filter(Boolean);
    const covered = Array.from(getCoveredSkillsSet());
    return [...new Set([...found, ...covered])];
}

// Get missing skills for a single job role (required + nice-to-have that student doesn't have)
function getMissingSkillsForJob(role, resumeData) {
    const foundNames = getEffectiveSkillNames(resumeData);
    const norm = (s) => (s || '').toString().toLowerCase().trim();
    const required = Array.isArray(role.skillsRequired) ? role.skillsRequired : [];
    const nice = Array.isArray(role.niceToHave) ? role.niceToHave : [];
    const missingRequired = required.filter(skill => {
        const n = norm(skill);
        if (!n) return false;
        return !foundNames.some(f => f === n || f.includes(n) || n.includes(f));
    });
    const missingNice = nice.filter(skill => {
        const n = norm(skill);
        if (!n) return false;
        return !foundNames.some(f => f === n || f.includes(n) || n.includes(f));
    });
    return { missingRequired, missingNice };
}

// Populate dropdown and show missing skills for selected company & job
function setupMissingSkillsDropdown(resumeData) {
    const roles = typeof getJobRolesForSkillGap === 'function' ? getJobRolesForSkillGap() : [];
    const wrap = document.getElementById('missingSkillsDropdownWrap');
    const select = document.getElementById('missingSkillsJobSelect');
    const list = document.getElementById('missingSkillsList');
    const titleEl = document.getElementById('missingSkillsTitle');
    const hintEl = document.getElementById('missingSkillsHint');
    const countEl = document.getElementById('missingSkillsCount');
    const statusEl = document.getElementById('missingSkillsStatus');

    if (!wrap || !select || !list) return;

    if (!roles || roles.length === 0) {
        wrap.style.display = 'none';
        if (titleEl) titleEl.textContent = '⚠️ Missing Skills for Job';
        if (hintEl) hintEl.style.display = 'none';
        list.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-500);">No company jobs posted yet. Companies need to add job roles first.</p>';
        return;
    }

    wrap.style.display = 'block';
    if (titleEl) titleEl.textContent = '⚠️ Missing Skills for Job';
    if (hintEl) {
        hintEl.textContent = "Select a job — shows only the required skills you're missing for that role.";
        hintEl.style.display = 'block';
    }

    // Preserve selection across periodic refreshes (dashboard refresh runs every ~3s)
    const prevValue = select.value;

    // Populate dropdown
    select.innerHTML = '<option value="">Select company & job...</option>' +
        roles.map((r, i) => {
            const label = `${r.companyName || 'Company'} - ${r.title || 'Job Role'}`;
            return `<option value="${i}">${label}</option>`;
        }).join('');

    select.onchange = function () {
        const idx = this.value;
        if (idx === '' || idx === null) {
            list.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-500);">Select a company & job to see missing skills for that role.</p>';
            if (countEl) countEl.textContent = '—';
            if (statusEl) statusEl.textContent = 'Select a job';
            return;
        }
        const role = roles[parseInt(idx, 10)];
        if (!role || !resumeData) return;
        const { missingRequired, missingNice } = getMissingSkillsForJob(role, resumeData);

        if (missingRequired.length === 0 && missingNice.length === 0) {
            list.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--success); font-weight:600;">✓ You have all required skills for this role!</p>';
            if (countEl) countEl.textContent = '0';
            if (statusEl) statusEl.textContent = 'All required skills';
            return;
        }

        // Show only required skills first, then nice-to-have (both are for this job only)
        const items = [];
        if (missingRequired.length > 0) {
            items.push(...missingRequired.map(name => ({
                name, priority: 'High', category: 'Required', requiredBy: [role.companyName || 'Company']
            })));
        }
        if (missingNice.length > 0) {
            items.push(...missingNice.map(name => ({
                name, priority: 'Medium', category: 'Nice to have', requiredBy: [role.companyName || 'Company']
            })));
        }
        populateMissingSkills(items);

        // Update the stat card count (focus on required missing)
        if (countEl) countEl.textContent = String(missingRequired.length);
        if (statusEl) {
            statusEl.textContent = missingRequired.length === 0
                ? 'All required skills'
                : 'Required missing';
        }
    };

    // Restore previous selection (if still valid) and re-render its missing skills
    if (prevValue !== '' && prevValue !== null && select.querySelector(`option[value="${prevValue}"]`)) {
        select.value = prevValue;
        select.onchange();
    } else {
        // Initial state: prompt to select
        list.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-500);">Select a company & job to see missing skills for that role.</p>';
        if (countEl) countEl.textContent = '—';
        if (statusEl) statusEl.textContent = 'Select a job';
    }
}

// Load resume data into dashboard
function loadResumeData(resumeData) {
    latestResumeData = resumeData;
    // Update stats cards
    if (resumeData.scores) {
        const overallScore = resumeData.scores.overall || 0;
        document.getElementById('resumeScore').textContent = overallScore + '%';
        document.getElementById('resumeScoreStatus').textContent = overallScore >= 80 ? 'Excellent!' : overallScore >= 60 ? 'Good' : 'Needs Improvement';
        document.getElementById('resumeScoreStatus').className = overallScore >= 80 ? 'stat-change positive' : overallScore >= 60 ? 'stat-change' : 'stat-change';

        document.getElementById('atsScoreValue').textContent = (resumeData.scores.ats || 0) + '%';
        document.getElementById('atsScoreStatus').textContent = resumeData.scores.ats >= 80 ? 'High compatibility' : 'Needs optimization';
    }

    // Update skills found count
    if (resumeData.foundSkills) {
        document.getElementById('skillsFoundCount').textContent = resumeData.foundSkills.length;
        document.getElementById('skillsFoundStatus').textContent = 'Skills detected';
    }

    // Missing skills: only company job requirements — dropdown to select company & job
    const roles = typeof getJobRolesForSkillGap === 'function' ? getJobRolesForSkillGap() : [];
    if (roles && roles.length > 0) {
        setupMissingSkillsDropdown(resumeData);
        // Don't overwrite count/status — setupMissingSkillsDropdown sets them (or restores selection)
    } else {
        document.getElementById('missingSkillsDropdownWrap').style.display = 'none';
        document.getElementById('missingSkillsTitle').textContent = '⚠️ Missing Skills for Job';
        const hintEl = document.getElementById('missingSkillsHint');
        if (hintEl) hintEl.style.display = 'none';
        document.getElementById('missingSkillsCount').textContent = '—';
        document.getElementById('missingSkillsStatus').textContent = 'No company jobs';
        document.getElementById('missingSkillsList').innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-500);">No company jobs posted. Select a job once companies add roles to see required skills you need.</p>';
    }

    // Populate strengths list
    populateStrengths(resumeData.foundSkills || []);
}

// Compute and render job matches: use backend API for accurate compatibility (single source of truth)
async function loadJobMatches(resumeData) {
    const container = document.getElementById('jobMatchesList');
    if (!container) return;
    if (!resumeData) {
        container.innerHTML = `
            <p style="text-align: center; padding: 2rem; color: var(--gray-500);">
                Upload your resume and ensure companies have added job roles to see your match scores.
            </p>
        `;
        return;
    }

    // Use only resume-detected skills for job matching
    const foundSkills = Array.isArray(resumeData.foundSkills) ? resumeData.foundSkills : [];
    if (foundSkills.length === 0) {
        container.innerHTML = `
            <p style="text-align: center; padding: 2rem; color: var(--gray-500);">
                Upload and analyze your resume to see how well you match company job roles.
            </p>
        `;
        return;
    }

    const matches = await getJobMatchesCached({ ...resumeData, foundSkills });

    if (!matches || matches.length === 0) {
        container.innerHTML = `
            <p style="text-align: center; padding: 2rem; color: var(--gray-500);">
                No company job roles found. Once companies post roles, you'll see your match scores here.
            </p>
        `;
        return;
    }

    container.innerHTML = `
        <div class="job-matches-grid">
            ${matches.map(m => `
                <div class="job-match-card">
                    <div class="job-match-header">
                        <div>
                            <div class="job-match-title">${m.title}</div>
                            <div class="job-match-company">${m.companyName}</div>
                        </div>
                        <div class="job-match-score-wrap">
                            <span class="job-match-score-label">Compatibility</span>
                            <span class="job-match-score">${m.score}%</span>
                        </div>
                    </div>
                    <div class="job-match-meta">
                        ${m.department || 'General'} • ${m.experience || 'Any experience'}<br>
                        Match on ${m.matchedRequiredCount}/${m.totalRequiredCount || 0} required skills
                    </div>
                    <div class="job-match-missing">
                        ${m.missingRequired && m.missingRequired.length ? `
                            <strong>Missing required skills for this role:</strong>
                            ${m.missingRequired.join(', ')}
                        ` : '<strong>Missing required skills:</strong> None 🎉'}
                        ${m.missingNice && m.missingNice.length ? `
                            <br><strong>Nice to have (missing):</strong>
                            ${m.missingNice.join(', ')}
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function openResumeSkillsModal() {
    const modal = document.getElementById('resumeSkillsModal');
    if (!modal) return;

    let resumeData = latestResumeData;
    if (!resumeData) {
        try {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
            resumeData = currentUser?.resumeData || null;
        } catch { /* ignore */ }
    }
    if (!resumeData) {
        try {
            resumeData = JSON.parse(localStorage.getItem('lastResumeAnalysis') || 'null');
        } catch { /* ignore */ }
    }

    // Show modal early with a friendly empty state
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    renderResumeSkillsModal(resumeData);
}

function closeResumeSkillsModal() {
    const modal = document.getElementById('resumeSkillsModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

async function renderResumeSkillsModal(resumeData) {
    const listEl = document.getElementById('resumeSkillsModalList');
    const countEl = document.getElementById('resumeSkillsCountMeta');
    const selectEl = document.getElementById('resumeSkillsModalJobSelect');
    const compatEl = document.getElementById('resumeSkillsModalCompat');

    if (!listEl || !selectEl || !compatEl) return;

    const skills = Array.isArray(resumeData?.foundSkills) ? [...resumeData.foundSkills] : [];
    if (skills.length === 0) {
        if (countEl) countEl.textContent = '';
        listEl.innerHTML = '<p style="margin:0; color: var(--gray-600);">No skills found yet. Upload and analyze your resume first.</p>';
        selectEl.innerHTML = '<option value="">No roles available</option>';
        compatEl.innerHTML = '<p style="margin:0; color: var(--gray-600);">Analyze a resume to compute compatibility.</p>';
        return;
    }

    // Skills list
    skills.sort((a, b) => (Number(b?.level) || 0) - (Number(a?.level) || 0) || String(a?.name || '').localeCompare(String(b?.name || '')));
    if (countEl) countEl.textContent = `${skills.length} skills`;

    listEl.innerHTML = skills.map(s => {
        const name = (typeof s === 'string' ? s : (s?.name || '')).toString().trim();
        return `
            <div class="modal-skill-chip" title="${name}">
                <span class="name">${name || 'Skill'}</span>
            </div>
        `;
    }).join('');

    // Compatibility section (backend = source of truth)
    compatEl.innerHTML = '<p style="margin:0; color: var(--gray-600);">Loading compatibility…</p>';
    const matches = await getJobMatchesCached(resumeData);

    if (!matches || matches.length === 0) {
        selectEl.innerHTML = '<option value="">No company roles posted yet</option>';
        compatEl.innerHTML = '<p style="margin:0; color: var(--gray-600);">No company job roles found. Ask companies to add job roles to see compatibility.</p>';
        return;
    }

    // Build dropdown from matches (already contains title/company/score + missing)
    selectEl.innerHTML = '<option value="">Select company & role…</option>' + matches.map((m, i) => {
        const label = `${m.companyName || 'Company'} — ${m.title || 'Job Role'} (${m.score ?? 0}%)`;
        return `<option value="${i}">${label}</option>`;
    }).join('');

    selectEl.onchange = function () {
        const idx = this.value;
        if (idx === '' || idx === null) {
            compatEl.innerHTML = '<p style="margin:0; color: var(--gray-600);">Select a role above to see your compatibility score and missing required skills.</p>';
            return;
        }
        const m = matches[parseInt(idx, 10)];
        if (!m) return;

        const missingReq = Array.isArray(m.missingRequired) ? m.missingRequired : [];
        const missingNice = Array.isArray(m.missingNice) ? m.missingNice : [];
        const matchedReq = Number(m.matchedRequiredCount) || 0;
        const totalReq = Number(m.totalRequiredCount) || 0;

        compatEl.innerHTML = `
            <div class="compat-score-row">
                <div class="compat-score">${Number(m.score) || 0}%</div>
                <div class="compat-sub">
                    Matched ${matchedReq}/${totalReq} required skills
                </div>
            </div>
            <div>
                <strong>Missing required skills</strong>
                <div class="compat-tags">
                    ${missingReq.length ? missingReq.map(s => `<span class="compat-tag missing">${s}</span>`).join('') : '<span class="compat-tag have">None</span>'}
                </div>
            </div>
            ${missingNice.length ? `
                <div style="margin-top:0.75rem;">
                    <strong>Nice to have (missing)</strong>
                    <div class="compat-tags">
                        ${missingNice.map(s => `<span class="compat-tag">${s}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    };

    compatEl.innerHTML = '<p style="margin:0; color: var(--gray-600);">Select a role above to see your compatibility score and missing required skills.</p>';
}

// Close modal on outside click / ESC
document.addEventListener('click', (e) => {
    const modal = document.getElementById('resumeSkillsModal');
    if (!modal || modal.style.display === 'none') return;
    if (e.target === modal) closeResumeSkillsModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('resumeSkillsModal');
    if (!modal || modal.style.display === 'none') return;
    closeResumeSkillsModal();
});

function populateStrengths(skills) {
    const strengthsList = document.getElementById('strengthsList');
    if (!strengthsList) return;

    if (skills.length === 0) {
        strengthsList.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-500);">Upload your resume to see your skills analysis</p>';
        return;
    }

    // Sort by level (highest first) and take top 4
    const topSkills = skills.sort((a, b) => b.level - a.level).slice(0, 4);

    strengthsList.innerHTML = topSkills.map(skill => {
        const levelClass = skill.level >= 85 ? 'excellent' : skill.level >= 70 ? 'good' : 'average';
        return `
            <div class="skill-item ${levelClass}">
                <div class="skill-info">
                    <span class="skill-name">${skill.name}</span>
                </div>
                <div class="skill-bar-container">
                    <div class="skill-bar" style="width: ${skill.level}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function populateMissingSkills(missingSkills) {
    const missingList = document.getElementById('missingSkillsList');
    if (!missingList) return;

    if (!missingSkills || missingSkills.length === 0) {
        missingList.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-500);">No missing skills detected</p>';
        return;
    }

    // Sort by priority (High first) and take top 8 so company-required list is useful
    const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
    const sorted = [...missingSkills].sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
    const topMissing = sorted.slice(0, 8);

    missingList.innerHTML = topMissing.map(skill => {
        const priorityClass = skill.priority === 'High' ? 'needs-work' : skill.priority === 'Medium' ? 'average' : 'good';
        const requiredBy = skill.requiredBy && skill.requiredBy.length ? ` (Required by: ${skill.requiredBy.join(', ')})` : '';
        return `
            <div class="skill-item ${priorityClass}">
                <div class="skill-info">
                    <span class="skill-name">${skill.name}</span>
                    <span class="skill-level">${skill.priority} Priority</span>
                </div>
                <div class="skill-bar-container">
                    <div class="skill-bar warning" style="width: ${skill.priority === 'High' ? 30 : skill.priority === 'Medium' ? 50 : 70}%"></div>
                    <span class="skill-percentage">${skill.category}${requiredBy}</span>
                </div>
            </div>
        `;
    }).join('');
}

function showNoResumeMessage() {
    document.getElementById('resumeScore').textContent = '--';
    document.getElementById('resumeScoreStatus').textContent = 'Upload resume to see score';
    document.getElementById('skillsFoundCount').textContent = '--';
    document.getElementById('missingSkillsCount').textContent = '--';
    document.getElementById('atsScoreValue').textContent = '--';
}

// Load section content dynamically
function loadSectionContent(sectionName) {
    const section = document.getElementById(sectionName + 'Section');

    // You can load different content based on section
    switch (sectionName) {
        case 'profile':
            loadProfileSection(section);
            break;
        case 'skills':
            loadSkillsSection(section);
            break;
        case 'missing':
            loadMissingSection(section);
            break;
        case 'study':
            loadStudySection(section);
            break;
        case 'practice':
            loadPracticeSection(section);
            break;
        case 'resume':
            // Resume section is loaded from resume.html
            window.location.href = 'resume.html';
            break;
        case 'interview':
            loadInterviewSection(section);
            break;
        case 'prediction':
            loadPredictionSection(section);
            break;
    }
}

// Sample section loaders (you can expand these)
function loadProfileSection(section) {
    section.innerHTML = `
        <div class="page-header">
            <div>
                <h1>👤 Profile Analysis</h1>
                <p class="page-subtitle">AI-powered analysis of your skills and background</p>
            </div>
        </div>
        <div class="profile-content">
            <div class="profile-card">
                <h3>📊 Profile Completion</h3>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 75%">75%</div>
                </div>
                <p class="progress-note">Complete your profile to get better recommendations</p>
            </div>
        </div>
    `;
}

function loadSkillsSection(section) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const resumeData = currentUser?.resumeData;
    const roles = typeof getJobRolesForSkillGap === 'function' ? getJobRolesForSkillGap() : [];

    section.innerHTML = `
        <div class="page-header">
            <div>
                <h1>📊 Skills Assessment</h1>
                <p class="page-subtitle">Combined top questions for all missing skills per company</p>
            </div>
        </div>

        <div class="practice-content">
            ${(!resumeData || !resumeData.foundSkills) ? `
                <div class="empty-state">
                    <p>Please upload and analyze your resume first to detect missing skills.</p>
                    <button class="btn-primary" onclick="window.location.href='resume.html'">Upload Resume</button>
                </div>
            ` : `
                <div class="practice-panel">
                    <div class="practice-controls" style="grid-template-columns: 1fr;">
                        <div>
                            <label for="skillAssessmentCompanySelect" style="display:block; font-weight:700; margin-bottom:0.5rem;">Select company & role</label>
                            <select id="skillAssessmentCompanySelect" class="missing-skills-select" style="max-width: 100%;">
                                <option value="">Select company & job...</option>
                                ${roles && roles.length ? roles.map((r, i) => `<option value="${i}">${escapeHtml(r.companyName || 'Company')} - ${escapeHtml(r.title || 'Role')}</option>`).join('') : '<option value="">No company roles posted</option>'}
                            </select>
                        </div>
                    </div>

                    <div style="margin-top: 1.5rem; text-align: center;">
                        <button class="btn-primary" id="startCombinedAssessmentBtn" style="padding: 1rem 2rem; font-size: 1.1rem; border-radius: var(--radius-xl);">
                            🚀 Start Assessment
                        </button>
                    </div>

                    <div class="practice-workspace" id="assessmentWorkspace" style="display: none; margin-top: 2rem; grid-template-columns: 1fr;">
                        <div class="practice-problem">
                            <div class="practice-problem-header">
                                <h3 id="assessmentProblemTitle" style="margin:0;">Assessment</h3>
                                <span id="assessmentProblemMeta" class="badge primary"></span>
                            </div>
                            <div id="assessmentProblemBody" class="practice-problem-body">
                                <p style="margin:0; color:var(--gray-600);">Questions will appear here.</p>
                            </div>
                        </div>
                        <div class="practice-solution" style="margin-top: 1rem;">
                            <h3 style="margin:0 0 1rem; border-bottom: 2px solid var(--gray-200); padding-bottom: 0.5rem;">Review Your Final Submission</h3>
                            <div class="practice-actions">
                                <button id="assessmentReviewBtn" class="btn-primary" type="button" disabled style="padding: 0.75rem 1.5rem; font-size: 1rem; background: var(--secondary);">Review of the Test</button>
                                <span id="assessmentStatus" style="color:var(--gray-600); font-size:0.95rem;"></span>
                            </div>
                            <div id="assessmentFeedback" class="practice-feedback" style="display:none;"></div>
                        </div>
                    </div>
                </div>

                <div class="practice-panel" style="margin-top:1.5rem;">
                    <div class="card-header" style="margin-bottom:1rem;">
                        <h2 style="margin:0;">📈 Progress Report</h2>
                        <span class="badge success">Auto-updated</span>
                    </div>
                    <div id="assessmentProgressReport"></div>
                </div>
            `}
        </div>
    `;

    if (!resumeData || !resumeData.foundSkills) return;

    const companySelect = section.querySelector('#skillAssessmentCompanySelect');
    const startBtn = section.querySelector('#startCombinedAssessmentBtn');
    const workspace = section.querySelector('#assessmentWorkspace');
    const titleEl = section.querySelector('#assessmentProblemTitle');
    const metaEl = section.querySelector('#assessmentProblemMeta');
    const bodyEl = section.querySelector('#assessmentProblemBody');
    const reviewBtn = section.querySelector('#assessmentReviewBtn');
    const statusEl = section.querySelector('#assessmentStatus');
    const feedbackEl = section.querySelector('#assessmentFeedback');

    let currentTest = null;
    let currentQuestionIndex = 0;
    let currentAnswers = [];

    function renderProgressReport() {
        const attempts = _readPracticeAttempts();
        const wrap = section.querySelector('#assessmentProgressReport');
        if (!wrap) return;
        
        const combinedAttempts = attempts.filter(a => a.difficulty === 'combined');
        if (!combinedAttempts.length) {
            wrap.innerHTML = `<p style="margin:0; color:var(--gray-600);">No combined assessments taken yet. Select a role and start the assessment to see your eligibility status.</p>`;
            return;
        }

        const recent = [...combinedAttempts].sort((a, b) => (b?.ts || 0) - (a?.ts || 0)).slice(0, 10);

        wrap.innerHTML = `
            <div class="progress-table">
                <div class="progress-row head">
                    <div>Assessment</div><div>Role</div><div>Score</div><div>Status</div><div>When</div>
                </div>
                ${recent.map(a => {
                    const score = Number(a?.score) || 0;
                    const passed = score >= 60;
                    const when = a?.ts ? new Date(a.ts).toLocaleString() : '';
                    return `
                        <div class="progress-row">
                            <div>Combined</div>
                            <div>${escapeHtml(a.skill || 'Assessment')}</div>
                            <div>${score}</div>
                            <div><span class="badge ${passed ? 'success' : 'warning'}">${passed ? 'Eligible' : 'Keep Practicing'}</span></div>
                            <div style="color:var(--gray-600); font-size:0.9rem;">${escapeHtml(when)}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderCurrentQuestion() {
        if (!currentTest || !Array.isArray(currentTest.questions) || !currentTest.questions.length) {
            bodyEl.innerHTML = '<p style="margin:0; color:var(--gray-600);">No questions found in this test.</p>';
            if (reviewBtn) reviewBtn.disabled = true;
            return;
        }
        const questions = currentTest.questions;
        const idx = currentQuestionIndex;
        const q = questions[idx];
        const num = idx + 1;
        const type = (q.type || '').toLowerCase() === 'mcq' ? 'MCQ' : 'Coding';
        const qid = `q_${num}`;
        const saved = currentAnswers[idx] || {};

        function normalizeOptionText(raw) {
            return String(raw ?? '').trim();
        }

        const optionsHtml = (Array.isArray(q.options) ? q.options : []).map((opt, oi) => {
            const value = normalizeOptionText(opt);
            const checked = saved.type === 'mcq' && saved.answer === value ? 'checked' : '';
            return `
                <label class="test-q-option" style="display: flex; align-items: center; padding: 1.25rem; border: 2px solid ${checked ? 'var(--primary)' : 'var(--gray-200)'}; border-radius: var(--radius-lg); margin-bottom: 1rem; cursor: pointer; transition: all 0.2s ease; background: ${checked ? 'rgba(99, 102, 241, 0.05)' : 'var(--white)'}; box-shadow: ${checked ? '0 4px 12px rgba(99, 102, 241, 0.1)' : 'none'};" onmouseover="this.style.borderColor='var(--primary)'; this.style.background='rgba(99, 102, 241, 0.02)';" onmouseout="this.style.borderColor='${checked ? 'var(--primary)' : 'var(--gray-200)'}'; this.style.background='${checked ? 'rgba(99, 102, 241, 0.05)' : 'var(--white)'}';">
                    <input type="radio" name="${qid}" value="${escapeHtml(value)}" ${checked} style="width: 22px; height: 22px; margin-right: 1.25rem; cursor: pointer; accent-color: var(--primary);">
                    <span style="font-size: 1.1rem; font-weight: ${checked ? '700' : '500'}; color: ${checked ? 'var(--primary)' : 'var(--gray-800)'};">${String.fromCharCode(65 + oi)}. ${escapeHtml(value)}</span>
                </label>
            `;
        }).join('');

        const codeValue = saved.type === 'coding' ? (saved.answer || '') : '';

        bodyEl.innerHTML = `
            <div class="single-question-wrapper" style="max-width: 900px; margin: 0 auto; padding: 1.5rem 0;">
                <div class="test-question" style="background: var(--white); padding: 2.5rem; border-radius: var(--radius-xl); box-shadow: var(--shadow-lg); border: 2px solid var(--gray-100); transition: border-color 0.3s ease;" onmouseover="this.style.borderColor='var(--primary-light, #e0e7ff)';" onmouseout="this.style.borderColor='var(--gray-100)';">
                    <div class="test-q-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 2px solid var(--gray-50); padding-bottom: 1.5rem;">
                        <span class="test-q-number" style="font-weight: 800; color: var(--primary); font-size: 1.2rem; background: rgba(99, 102, 241, 0.1); padding: 0.5rem 1rem; border-radius: var(--radius-md);">Question ${num} of ${questions.length}</span>
                        <span class="test-q-type badge" style="padding: 0.6rem 1.2rem; font-size: 0.9rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">${type}</span>
                    </div>
                    
                    <div style="margin-bottom: 2.5rem;">
                        <p class="test-q-prompt" style="font-weight: 900; font-size: 1.5rem; color: var(--gray-900); line-height: 1.4; margin-bottom: 1.25rem;">${escapeHtml(q.title || '')}</p>
                        <p class="test-q-body" style="font-size: 1.15rem; line-height: 1.7; color: var(--gray-700);">${escapeHtml(q.prompt || '')}</p>
                    </div>

                    <div class="answer-section" style="margin-top: 2.5rem;">
                        <p style="font-weight: 800; color: var(--gray-400); text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.1em; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="width: 20px; height: 2px; background: var(--gray-200);"></span>
                            Your Solution
                            <span style="width: 20px; height: 2px; background: var(--gray-200);"></span>
                        </p>
                        ${type === 'MCQ' ? `
                            <div class="test-q-options">
                                ${optionsHtml}
                            </div>
                        ` : `
                            <div style="border-radius: var(--radius-lg); overflow: hidden; border: 2px solid var(--gray-200); transition: border-color 0.3s ease;" onfocusin="this.style.borderColor='var(--primary)';" onfocusout="this.style.borderColor='var(--gray-200)';">
                                <textarea class="test-q-code" data-qid="${qid}" placeholder="Write your code or explanation here..." style="width: 100%; min-height: 350px; padding: 1.5rem; font-family: 'Fira Code', 'Consolas', monospace; font-size: 1.05rem; line-height: 1.6; border: none; outline: none; background: #fafafa; display: block;">${escapeHtml(codeValue)}</textarea>
                            </div>
                        `}
                    </div>
                </div>

                <div class="test-nav-row" style="display: flex; gap: 1.5rem; margin-top: 2.5rem; align-items: center;">
                    <button type="button" class="btn-secondary" id="testPrevBtn" ${idx === 0 ? 'disabled' : ''} style="padding: 1rem 2rem; font-weight: 800; border-radius: var(--radius-lg); transition: all 0.2s ease; display: flex; align-items: center; gap: 0.5rem;">
                        <span>←</span> Previous
                    </button>
                    
                    <div style="flex-grow: 1; text-align: center; padding: 0 2rem;">
                        <div style="font-size: 0.9rem; font-weight: 700; color: var(--gray-500); margin-bottom: 0.5rem;">Progress: ${Math.round((num / questions.length) * 100)}%</div>
                        <div style="height: 10px; background: var(--gray-200); border-radius: 5px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                            <div style="width: ${(num / questions.length) * 100}%; height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary)); transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                        </div>
                    </div>

                    ${idx < questions.length - 1
                        ? `<button type="button" class="btn-primary" id="testNextBtn" style="padding: 1rem 2rem; font-weight: 800; border-radius: var(--radius-lg); transition: all 0.2s ease; display: flex; align-items: center; gap: 0.5rem; box-shadow: var(--shadow-md);">
                            Next Question <span>→</span>
                           </button>`
                        : `<button type="button" class="btn-primary" id="testFinishBtn" style="padding: 1rem 2.5rem; font-weight: 800; border-radius: var(--radius-lg); background: var(--success); border-color: var(--success); box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3); transition: all 0.2s ease;">
                            🚀 Submit
                           </button>`}
                </div>
            </div>
        `;

        if (reviewBtn) {
            const isLast = idx === questions.length - 1;
            // reviewBtn is initially disabled until submission
            if (!currentTest.evaluated) {
                reviewBtn.disabled = true;
            }
        }

        const prevBtn = bodyEl.querySelector('#testPrevBtn');
        const nextBtn = bodyEl.querySelector('#testNextBtn');
        const finishBtn = bodyEl.querySelector('#testFinishBtn');

        if (finishBtn) {
            finishBtn.addEventListener('click', () => {
                persistCurrentAnswer();
                evaluateAssessment();
            });
        }

        function persistCurrentAnswer() {
            if (!currentTest) return;
            const qNow = currentTest.questions[currentQuestionIndex];
            const qidNow = `q_${currentQuestionIndex + 1}`;
            if ((qNow.type || '').toLowerCase() === 'mcq') {
                const chosen = bodyEl.querySelector(`input[name="${qidNow}"]:checked`);
                currentAnswers[currentQuestionIndex] = {
                    id: qNow.id || qidNow,
                    type: 'mcq',
                    answer: chosen ? chosen.value : ''
                };
            } else {
                const ta = bodyEl.querySelector(`textarea[data-qid="${qidNow}"]`);
                currentAnswers[currentQuestionIndex] = {
                    id: qNow.id || qidNow,
                    type: 'coding',
                    answer: (ta?.value || '').toString()
                };
            }
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                persistCurrentAnswer();
                if (currentQuestionIndex > 0) {
                    currentQuestionIndex -= 1;
                    renderCurrentQuestion();
                }
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                persistCurrentAnswer();
                if (currentQuestionIndex < questions.length - 1) {
                    currentQuestionIndex += 1;
                    renderCurrentQuestion();
                }
            });
        }
    }

    async function handleStartAssessment() {
        const companyIdx = companySelect?.value;
        const role = roles && companyIdx !== '' && companyIdx !== null ? roles[parseInt(companyIdx, 10)] : null;
        if (!role) {
            alert('Please select a company and role first.');
            return;
        }

        const { missingRequired, missingNice } = getMissingSkillsForJob(role, resumeData);
        const skills = [...missingRequired, ...missingNice].map(s => (s || '').toString().trim()).filter(Boolean);
        if (!skills.length) {
            alert('No missing skills for this role! You are already eligible.');
            return;
        }

        workspace.style.display = 'grid';
        feedbackEl.style.display = 'none';
        statusEl.textContent = 'Generating your assessment...';
        startBtn.disabled = true;

        try {
            const assessment = await generateCombinedAssessmentAPI(skills, role.companyName, role.title);
            currentTest = assessment;
            currentTest.difficulty = 'combined';
            currentQuestionIndex = 0;
            currentAnswers = [];
            
            titleEl.textContent = `Assessment: ${role.companyName}`;
            metaEl.textContent = `${assessment.questions.length} Questions`;
            
            renderCurrentQuestion();
            statusEl.textContent = 'Assessment started. Navigate through the questions and submit when ready.';
        } catch (e) {
            statusEl.textContent = `Failed to load assessment: ${e.message}`;
            startBtn.disabled = false;
        }
    }

    async function evaluateAssessment() {
        if (!currentTest) return;
        const roleIdx = companySelect.value;
        const role = roles[parseInt(roleIdx, 10)];
        const language = 'python'; // Default to python since lang selection is removed

        // Persist last question
        const qNow = currentTest.questions[currentQuestionIndex];
        const qidNow = `q_${currentQuestionIndex + 1}`;
        if ((qNow.type || '').toLowerCase() === 'mcq') {
            const chosen = bodyEl.querySelector(`input[name="${qidNow}"]:checked`);
            currentAnswers[currentQuestionIndex] = { id: qNow.id || qidNow, type: 'mcq', answer: chosen ? chosen.value : '' };
        } else {
            const ta = bodyEl.querySelector(`textarea[data-qid="${qidNow}"]`);
            if (ta) currentAnswers[currentQuestionIndex] = { id: qNow.id || qidNow, type: 'coding', answer: (ta?.value || '').toString() };
        }

        if (reviewBtn) reviewBtn.disabled = true;
        statusEl.textContent = 'Evaluating your assessment...';

        try {
            const result = await evaluatePracticeTestAPI(currentTest, currentAnswers, language);
            currentTest.evaluated = true;
            const score = Number(result?.score) || 0;
            
            const attempts = _readPracticeAttempts();
            attempts.push({ ts: Date.now(), skill: role.title, difficulty: 'combined', score, passed: score >= 60 });
            _writePracticeAttempts(attempts);

            feedbackEl.style.display = 'block';
            
            const eligibilityMsg = score >= 60
                ? `<div class="congratulations-card" style="margin-top: 1rem; padding: 1.5rem; background: linear-gradient(135deg, #10b981, #059669); color: white; border-radius: var(--radius-lg); text-align: center; box-shadow: var(--shadow-lg);">
                    <h2 style="margin: 0 0 0.5rem; font-size: 1.75rem;">🎉 Congratulations!</h2>
                    <p style="margin: 0; font-size: 1.1rem; font-weight: 500;">You scored ${score}/100. You are officially eligible for the ${role.title} position at ${role.companyName}!</p>
                   </div>`
                : `<div style="margin-top: 1rem; padding: 1rem; background: var(--gray-100); border-radius: var(--radius-lg); text-align: center;">
                    <p style="margin: 0; font-weight: 600; color: var(--gray-700);">You scored ${score}/100. A score of 60+ is required for eligibility. Keep practicing!</p>
                   </div>`;

            const resultsBreakdownHtml = (Array.isArray(result?.results) && result.results.length)
                ? `<div id="detailedResultsContainer" style="display: none; margin-top: 2rem; animation: fadeIn 0.3s ease;">
                    <h3 style="margin-bottom: 1.5rem; border-bottom: 2px solid var(--gray-200); padding-bottom: 0.75rem; color: var(--gray-900); font-weight: 800;">Detailed Results Breakdown</h3>
                    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                        ${result.results.map((r, i) => {
                            const q = currentTest.questions[i] || {};
                            const studentAns = currentAnswers[i]?.answer || 'No answer';
                            const isCorrect = r.correct === true;
                            const statusColor = isCorrect ? '#059669' : '#dc2626';
                            const bgColor = isCorrect ? '#f0fdf4' : '#fef2f2';
                            const borderColor = isCorrect ? '#bcf0da' : '#fee2e2';

                            return `
                                <div class="result-item" style="padding: 1.5rem; border: 2px solid ${borderColor}; border-radius: var(--radius-lg); background: ${bgColor}; transition: transform 0.2s ease;" onmouseover="this.style.transform='translateX(5px)';" onmouseout="this.style.transform='translateX(0)';">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 0.75rem;">
                                        <span style="font-weight: 800; color: ${statusColor}; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                                            ${isCorrect ? '✅' : '❌'} Question ${i + 1}: ${isCorrect ? 'Correct' : 'Incorrect'}
                                        </span>
                                        <span class="badge" style="font-size: 0.8rem; background: rgba(0,0,0,0.05); color: var(--gray-700); font-weight: 700; text-transform: uppercase;">${(q.type || 'MCQ').toUpperCase()}</span>
                                    </div>
                                    
                                    <div style="margin-bottom: 1.25rem;">
                                        <p style="margin: 0 0 0.5rem; font-weight: 800; font-size: 1.1rem; color: var(--gray-900);">${escapeHtml(q.title || 'Question')}</p>
                                        <p style="margin: 0; color: var(--gray-700); font-size: 1rem; line-height: 1.5;">${escapeHtml(q.prompt || '')}</p>
                                    </div>

                                    <div style="display: grid; grid-template-columns: 1fr; gap: 1rem; background: rgba(255,255,255,0.5); padding: 1rem; border-radius: var(--radius-md);">
                                        <div style="font-size: 0.95rem;">
                                            <strong style="color: var(--gray-800);">Your Answer:</strong> 
                                            <div style="margin-top: 0.25rem; padding: 0.5rem; background: ${isCorrect ? 'rgba(5, 150, 105, 0.1)' : 'rgba(220, 38, 38, 0.1)'}; border-radius: 4px; font-family: ${q.type === 'coding' ? 'monospace' : 'inherit'};">
                                                ${escapeHtml(studentAns)}
                                            </div>
                                        </div>
                                        
                                        ${!isCorrect ? `
                                            <div style="font-size: 0.95rem;">
                                                <strong style="color: #059669;">Correct Answer:</strong>
                                                <div style="margin-top: 0.25rem; padding: 0.5rem; background: rgba(5, 150, 105, 0.1); border-radius: 4px; font-weight: 700; color: #059669;">
                                                    ${escapeHtml(r.correctAnswer || 'N/A')}
                                                </div>
                                            </div>
                                        ` : ''}
                                        
                                        <div style="font-size: 0.95rem; border-top: 1px dashed rgba(0,0,0,0.1); pt: 0.75rem;">
                                            <strong style="color: var(--gray-800);">AI Explanation:</strong>
                                            <p style="margin: 0.25rem 0 0; color: var(--gray-600); line-height: 1.5; font-style: italic;">
                                                ${escapeHtml(r.explanation || 'No explanation provided.')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                   </div>`
                : '';

            feedbackEl.innerHTML = `
                <div class="feedback-header"><div class="feedback-score"><span style="font-weight:800; font-size: 1.25rem;">Final Score: ${score}/100</span></div></div>
                ${eligibilityMsg}
                <p style="margin-top: 1rem; font-size: 1.1rem; line-height: 1.6;">${escapeHtml(result?.feedback || '')}</p>
                ${resultsBreakdownHtml}
            `;

            statusEl.textContent = 'Assessment complete. Click "Review of the Test" to see detailed results.';
            renderProgressReport();
            startBtn.disabled = false;
            
            // Setup review toggle
            const currentReviewBtn = section.querySelector('#assessmentReviewBtn');
            if (currentReviewBtn && currentReviewBtn.parentNode) {
                currentReviewBtn.disabled = false;
                // Use addEventListener instead of onclick to avoid overwriting issues
                const newReviewBtn = currentReviewBtn.cloneNode(true);
                currentReviewBtn.parentNode.replaceChild(newReviewBtn, currentReviewBtn);
                
                newReviewBtn.addEventListener('click', () => {
                    const container = section.querySelector('#detailedResultsContainer');
                    if (container) {
                        const isHidden = window.getComputedStyle(container).display === 'none';
                        container.style.display = isHidden ? 'block' : 'none';
                        newReviewBtn.textContent = isHidden ? 'Hide Review' : 'Review of the Test';
                        if (isHidden) {
                            setTimeout(() => {
                                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 50);
                        }
                    } else {
                        console.error('detailedResultsContainer not found in section');
                    }
                });
            } else if (reviewBtn) {
                // Fallback for the closure variable
                reviewBtn.disabled = false;
            }
        } catch (e) {
            console.error('Evaluation error:', e);
            statusEl.textContent = `Evaluation failed: ${e.message}`;
            if (reviewBtn) reviewBtn.disabled = false;
        }
    }

    if (startBtn) startBtn.addEventListener('click', handleStartAssessment);
    renderProgressReport();
}

function loadMissingSection(section) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const resumeData = currentUser?.resumeData;
    const roles = typeof getJobRolesForSkillGap === 'function' ? getJobRolesForSkillGap() : [];

    if (!resumeData || !resumeData.foundSkills) {
        section.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>⚠️ Missing Skills (by Company)</h1>
                    <p class="page-subtitle">Upload your resume to see missing skills for each company job</p>
                </div>
            </div>
            <div class="missing-content">
                <div class="empty-state">
                    <p>Please upload your resume first to analyze missing skills for company roles.</p>
                    <button class="btn-primary" onclick="window.location.href='resume.html'">Upload Resume</button>
                </div>
            </div>
        `;
        return;
    }

    if (!roles || roles.length === 0) {
        section.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>⚠️ Missing Skills (by Company)</h1>
                    <p class="page-subtitle">Skills you need to add for specific company roles</p>
                </div>
            </div>
            <div class="missing-content">
                <div class="empty-state">
                    <p>No company job roles posted yet. Once companies add job roles, select one below to see the skills you need for that role.</p>
                </div>
            </div>
        `;
        return;
    }

    section.innerHTML = `
        <div class="page-header">
            <div>
                <h1>⚠️ Missing Skills (by Company)</h1>
                <p class="page-subtitle">Select a company and job to see skills you need to add for that role</p>
            </div>
        </div>
        <div class="missing-content">
            <div class="missing-dropdown-full">
                <label for="missingSectionJobSelect">Select company & job:</label>
                <select id="missingSectionJobSelect" class="missing-skills-select">
                    <option value="">Select company & job...</option>
                    ${roles.map((r, i) => `<option value="${i}">${r.companyName || 'Company'} - ${r.title || 'Job Role'}</option>`).join('')}
                </select>
            </div>
            <div id="missingSectionSkillsContent" class="missing-section-skills">
                <p class="missing-select-prompt">Select a company & job above to see missing skills for that role.</p>
            </div>
        </div>
    `;

    const select = section.querySelector('#missingSectionJobSelect');
    const content = section.querySelector('#missingSectionSkillsContent');

    select.onchange = function () {
        const idx = this.value;
        if (idx === '' || idx === null) {
            content.innerHTML = '<p class="missing-select-prompt">Select a company & job above to see missing skills for that role.</p>';
            return;
        }
        const role = roles[parseInt(idx, 10)];
        if (!role) return;
        const { missingRequired, missingNice } = getMissingSkillsForJob(role, resumeData);

        if (missingRequired.length === 0 && missingNice.length === 0) {
            content.innerHTML = '<div class="empty-state"><p class="success-msg">✓ You have all required and nice-to-have skills for this role!</p></div>';
            return;
        }

        let html = '';
        if (missingRequired.length > 0) {
            html += `
                <div class="missing-category">
                    <h3>🔴 Required skills (missing) — ${role.companyName || 'Company'}: ${role.title || 'Role'} (${missingRequired.length})</h3>
                    <div class="missing-skills-grid">
                        ${missingRequired.map(skill => `
                            <div class="missing-skill-card high">
                                <div class="skill-header">
                                    <h4>${skill}</h4>
                                    <span class="priority-badge high">Required</span>
                                </div>
                                <p class="skill-description">Add this skill to your resume to match this role.</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        if (missingNice.length > 0) {
            html += `
                <div class="missing-category">
                    <h3>🟡 Nice to have (missing) (${missingNice.length})</h3>
                    <div class="missing-skills-grid">
                        ${missingNice.map(skill => `
                            <div class="missing-skill-card medium">
                                <div class="skill-header">
                                    <h4>${skill}</h4>
                                    <span class="priority-badge medium">Nice to have</span>
                                </div>
                                <p class="skill-description">Adding this will strengthen your profile for this role.</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        content.innerHTML = html;
    };
}

function loadStudySection(section) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const resumeData = currentUser?.resumeData;
    const roles = typeof getJobRolesForSkillGap === 'function' ? getJobRolesForSkillGap() : [];

    section.innerHTML = `
        <div class="page-header">
            <div>
                <h1>📚 Personalized Study Plan</h1>
                <p class="page-subtitle">Select a company role → missing skill → get AI-generated study notes</p>
            </div>
        </div>

        <div class="practice-panel">
            ${(!resumeData || !resumeData.foundSkills) ? `
                <div class="empty-state">
                    <p>Please upload and analyze your resume first to detect missing skills.</p>
                    <button class="btn-primary" onclick="window.location.href='resume.html'">Upload Resume</button>
                </div>
            ` : `
                <div class="practice-controls" style="grid-template-columns: 1fr 1fr 1fr;">
                    <div>
                        <label for="studyCompanySelect" style="display:block; font-weight:700; margin-bottom:0.5rem;">Select company & role</label>
                        <select id="studyCompanySelect" class="missing-skills-select">
                            <option value="">Select company & job...</option>
                            ${roles && roles.length ? roles.map((r, i) => `<option value="${i}">${escapeHtml(r.companyName || 'Company')} - ${escapeHtml(r.title || 'Role')}</option>`).join('') : '<option value="">No company roles posted</option>'}
                        </select>
                    </div>
                    <div>
                        <label for="studySkillSelect" style="display:block; font-weight:700; margin-bottom:0.5rem;">Missing skill for this role</label>
                        <select id="studySkillSelect" class="missing-skills-select">
                            <option value="">Select a company role first</option>
                        </select>
                    </div>
                    <div>
                        <label for="studyNotesTypeSelect" style="display:block; font-weight:700; margin-bottom:0.5rem;">Notes Depth</label>
                        <select id="studyNotesTypeSelect" class="missing-skills-select">
                            <option value="quick">Quick Notes (Bullet points)</option>
                            <option value="long">Long Notes (Deep dive explanations)</option>
                        </select>
                    </div>
                </div>

                <div class="study-plan-panel" id="studyPlanPanel" style="margin-top:1.25rem; border:none; box-shadow:none; background:transparent; padding:0;">
                    <div class="card-header" style="margin-bottom:1rem;">
                        <h2 style="margin:0; font-size:1.25rem;">📚 Your AI Study Notes</h2>
                        <span id="studyPlanBadge" class="badge" style="display:none;">Generated</span>
                    </div>
                    <div id="studyPlanContent" class="study-plan-content" style="background: var(--white); padding: 1.5rem; border-radius: var(--radius-xl); box-shadow: var(--shadow-md);">
                        <div class="empty-state" style="padding:2rem 1.5rem; box-shadow:none;">
                            <p style="margin:0; color:var(--gray-600);">Select company & a missing skill to generate your study plan.</p>
                        </div>
                    </div>
                </div>
            `}
        </div>
    `;

    if (!resumeData || !resumeData.foundSkills) return;

    const companySelect = section.querySelector('#studyCompanySelect');
    const skillSelect = section.querySelector('#studySkillSelect');
    const notesTypeSelect = section.querySelector('#studyNotesTypeSelect');
    const studyPlanContent = section.querySelector('#studyPlanContent');
    const studyPlanBadge = section.querySelector('#studyPlanBadge');

    const STUDY_PLAN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
    const studyPlanCache = new Map();
    let studyPlanReqToken = 0;

    function _studyPlanKey(role, missingSkill, notesType) {
        const roleId = role?.id ?? role?.title ?? 'role';
        const companyName = role?.companyName ?? 'company';
        return `${companyName}:${roleId}:${missingSkill}:${notesType}`.toLowerCase().trim();
    }

    function clearStudyPlanUI(message) {
        if (!studyPlanContent) return;
        if (studyPlanBadge) studyPlanBadge.style.display = 'none';
        studyPlanContent.innerHTML = `
            <div class="empty-state" style="padding:2rem 1.5rem; box-shadow:none;">
                <p style="margin:0; color:var(--gray-600);">${escapeHtml(message || 'Select a company & a missing skill to generate your study plan.')}</p>
            </div>
        `;
    }

    function _readDoneTopics(storageKey) {
        try {
            const raw = localStorage.getItem(storageKey) || '[]';
            const arr = JSON.parse(raw);
            return new Set(Array.isArray(arr) ? arr : []);
        } catch {
            return new Set();
        }
    }

    function _writeDoneTopics(storageKey, doneSet) {
        try {
            localStorage.setItem(storageKey, JSON.stringify(Array.from(doneSet)));
        } catch { /* ignore */ }
    }

    function _sanitizeForUI(s) {
        // Only replace multiple spaces, keep newlines if they are already there from the AI (though our current cleanup removes them)
        return escapeHtml(String(s ?? '').trim());
    }

    function renderStudyPlan(plan, role, missingSkill) {
        if (!studyPlanContent) return;

        const topics = Array.isArray(plan?.topics) ? plan.topics : [];
        if (!topics.length) {
            clearStudyPlanUI('No study plan topics found. Try generating again.');
            return;
        }

        const key = _studyPlanKey(role, missingSkill, plan.notesType || 'quick');
        const storageKey = `studyPlanDone:${key}`;
        const doneTopics = _readDoneTopics(storageKey);

        const total = topics.length;
        const completed = doneTopics.size;
        const pct = total ? Math.round((completed / total) * 100) : 0;

        studyPlanContent.innerHTML = `
            <div class="study-plan-container">
                <div class="study-progress-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin:0; font-size: 1.1rem; color: var(--gray-900);">Overall Progress</h3>
                        <span id="studyPlanProgressPct" style="font-weight: 800; color: var(--primary); font-size: 1.25rem;">${pct}%</span>
                    </div>
                    <div class="study-progress-bar" style="height: 12px; background: var(--gray-100); border-radius: 6px; overflow: hidden; margin-bottom: 0.5rem;">
                        <div id="studyPlanProgressFill" class="study-progress-fill" style="width:${pct}%; height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary)); transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                    </div>
                    <p style="margin:0; font-size: 0.85rem; color: var(--gray-500); font-weight: 600;">${completed} of ${total} topics mastered</p>
                </div>

                <div class="study-plan-topics">
                    ${topics.map((t, i) => {
                        const tid = (t?.id || t?.topic || `t${i + 1}`).toString();
                        const isDone = doneTopics.has(tid);
                        const quickNotes = Array.isArray(t?.quickNotes) ? t.quickNotes : [];
                        const longNotes = Array.isArray(t?.longNotes) ? t.longNotes : [];
                        const officialLink = t?.officialLink || '';

                        const notesTitle = plan.notesType === 'long' ? 'Deep Dive Notes' : 'Quick Summary';
                        const notesList = plan.notesType === 'long' ? longNotes : quickNotes;

                        const notesHtml = notesList.length
                            ? `<div class="study-notes-box">
                                ${notesList.map(x => {
                                    let content = _sanitizeForUI(x);
                                    content = content.replace(/```([\s\S]*?)```/g, '<pre style="background: #1e293b; color: #f8fafc; padding: 1.25rem; border-radius: var(--radius-md); overflow-x: auto; margin: 1.25rem 0; font-family: \'Fira Code\', monospace; font-size: 0.9rem; line-height: 1.6; border: 1px solid #334155;"><code style="color: inherit;">$1</code></pre>');
                                    return `<p>${content}</p>`;
                                }).join('')}
                               </div>`
                            : `<p style="color:var(--gray-500); font-style: italic;">No notes available for this topic.</p>`;

                        const topicTitle = t?.topic || `Topic ${i + 1}`;

                        return `
                            <div class="study-topic-card ${isDone ? 'completed' : ''}" data-topic-id="${escapeHtml(tid)}">
                                <div class="study-topic-header">
                                    <div class="study-topic-info">
                                        <div class="study-topic-checkbox ${isDone ? 'checked' : ''}" onclick="event.stopPropagation(); toggleTopicDone('${escapeHtml(tid)}', this)">
                                            ${isDone ? '✓' : ''}
                                        </div>
                                        <span class="study-topic-title">${i + 1}. ${_sanitizeForUI(topicTitle)}</span>
                                    </div>
                                    <div class="study-topic-meta">
                                        <span class="chevron-icon">▼</span>
                                    </div>
                                </div>
                                <div class="study-topic-content">
                                    <div class="study-section-title">📖 ${notesTitle}</div>
                                    ${notesHtml}

                                    ${officialLink ? `
                                        <div style="margin-top: 1.5rem; border-top: 1px solid var(--gray-100); pt: 1rem;">
                                            <a href="${escapeHtml(officialLink)}" target="_blank" class="official-doc-btn">
                                                <span>🔗</span> Official Documentation
                                            </a>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        if (studyPlanBadge) {
            studyPlanBadge.style.display = 'inline-flex';
            studyPlanBadge.textContent = 'Ready';
        }

        // Add event listeners for accordion
        const topicCards = studyPlanContent.querySelectorAll('.study-topic-card');
        topicCards.forEach(card => {
            const header = card.querySelector('.study-topic-header');
            header.addEventListener('click', () => {
                const isOpen = card.classList.contains('open');
                // Close others
                topicCards.forEach(c => c.classList.remove('open'));
                // Toggle current
                if (!isOpen) card.classList.add('open');
            });
        });

        // Global function for checkbox toggle
        window.toggleTopicDone = (tid, el) => {
            const card = el.closest('.study-topic-card');
            const isDone = el.classList.contains('checked');
            
            if (isDone) {
                el.classList.remove('checked');
                el.innerHTML = '';
                card.classList.remove('completed');
                doneTopics.delete(tid);
            } else {
                el.classList.add('checked');
                el.innerHTML = '✓';
                card.classList.add('completed');
                doneTopics.add(tid);
            }

            _writeDoneTopics(storageKey, doneTopics);
            
            // Update progress
            const currentTotal = topics.length;
            const currentCompleted = doneTopics.size;
            const currentPct = currentTotal ? Math.round((currentCompleted / currentTotal) * 100) : 0;
            
            const fill = studyPlanContent.querySelector('#studyPlanProgressFill');
            const pctText = studyPlanContent.querySelector('#studyPlanProgressPct');
            const footerText = studyPlanContent.querySelector('.study-progress-card p');

            if (fill) fill.style.width = `${currentPct}%`;
            if (pctText) pctText.textContent = `${currentPct}%`;
            if (footerText) footerText.textContent = `${currentCompleted} of ${currentTotal} topics mastered`;
        };
    }

    async function maybeGenerateStudyPlan() {
        if (typeof getStudyPlanAPI !== 'function') {
            clearStudyPlanUI('Study plan backend API is not configured.');
            return;
        }

        const companyIdx = companySelect?.value;
        const missingSkill = (skillSelect?.value || '').toString().trim();
        const notesType = notesTypeSelect?.value || 'quick';
        const role = roles && companyIdx !== '' && companyIdx !== null ? roles[parseInt(companyIdx, 10)] : null;

        if (!role || !missingSkill) {
            clearStudyPlanUI();
            return;
        }

        const key = _studyPlanKey(role, missingSkill, notesType);
        const cacheHit = studyPlanCache.get(key);
        const now = Date.now();
        if (cacheHit && cacheHit.plan && (now - cacheHit.ts) < STUDY_PLAN_CACHE_TTL_MS) {
            renderStudyPlan(cacheHit.plan, role, missingSkill);
            return;
        }

        const token = ++studyPlanReqToken;
        if (studyPlanBadge) studyPlanBadge.style.display = 'none';
        if (studyPlanContent) {
            studyPlanContent.innerHTML = `
                <div class="empty-state" style="padding:2rem 1.5rem; box-shadow:none;">
                    <p style="margin:0; color:var(--gray-600); font-weight:800;">Generating study plan...</p>
                    <p style="margin-top:0.75rem; color:var(--gray-500);">This will create topic-wise AI notes for your selected role.</p>
                </div>
            `;
        }

        try {
            const plan = await getStudyPlanAPI(resumeData, role, missingSkill, notesType);
            if (token !== studyPlanReqToken) return;
            if (!plan) {
                throw new Error('Server returned an empty study plan.');
            }
            studyPlanCache.set(key, { ts: Date.now(), plan });
            renderStudyPlan(plan, role, missingSkill);
        } catch (e) {
            if (token !== studyPlanReqToken) return;
            clearStudyPlanUI(`Study plan generation failed: ${e?.message || 'Unknown error'}`);
        }
    }

    function populateSkillOptionsForRole(roleIdx) {
        if (!skillSelect) return;
        const idx = typeof roleIdx === 'number' ? roleIdx : parseInt(roleIdx || '-1', 10);
        const role = roles && idx >= 0 && roles[idx] ? roles[idx] : null;
        if (!role || !resumeData) {
            skillSelect.innerHTML = '<option value="">Select a company role first</option>';
            return;
        }
        const { missingRequired, missingNice } = getMissingSkillsForJob(role, resumeData);
        const skills = [...missingRequired, ...missingNice].map(s => (s || '').toString().trim()).filter(Boolean);
        if (!skills.length) {
            skillSelect.innerHTML = '<option value="">No missing skills for this role 🎉</option>';
            return;
        }
        skillSelect.innerHTML = skills.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    }

    if (companySelect) {
        companySelect.addEventListener('change', () => {
            populateSkillOptionsForRole(companySelect.value);
            if (skillSelect) skillSelect.value = '';
            clearStudyPlanUI('Select a missing skill to generate your study plan.');
        });
    }
    if (skillSelect) {
        skillSelect.addEventListener('change', () => {
            maybeGenerateStudyPlan();
        });
    }
    if (notesTypeSelect) {
        notesTypeSelect.addEventListener('change', () => {
            maybeGenerateStudyPlan();
        });
    }
}

function loadPracticeSection(section) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const resumeData = currentUser?.resumeData;
    const roles = typeof getJobRolesForSkillGap === 'function' ? getJobRolesForSkillGap() : [];

    section.innerHTML = `
        <div class="page-header">
            <div>
                <h1>💻 Coding Practice</h1>
                <p class="page-subtitle">Select a company role → missing skill → take Easy / Medium / Hard test</p>
            </div>
        </div>

        <div class="practice-content">
            ${(!resumeData || !resumeData.foundSkills) ? `
                <div class="empty-state">
                    <p>Please upload and analyze your resume first to detect missing skills.</p>
                    <button class="btn-primary" onclick="window.location.href='resume.html'">Upload Resume</button>
                </div>
            ` : `
                <div class="practice-panel">
                    <div class="practice-controls">
                        <div>
                            <label for="practiceCompanySelect" style="display:block; font-weight:700; margin-bottom:0.5rem;">Select company & role</label>
                            <select id="practiceCompanySelect" class="missing-skills-select">
                                <option value="">Select company & job...</option>
                                ${roles && roles.length ? roles.map((r, i) => `<option value="${i}">${escapeHtml(r.companyName || 'Company')} - ${escapeHtml(r.title || 'Role')}</option>`).join('') : '<option value="">No company roles posted</option>'}
                            </select>
                        </div>
                        <div>
                            <label for="practiceSkillSelect" style="display:block; font-weight:700; margin-bottom:0.5rem;">Missing skill for this role</label>
                            <select id="practiceSkillSelect" class="missing-skills-select">
                                <option value="">Select a company role first</option>
                            </select>
                            <p style="margin:0.5rem 0 0; color:var(--gray-600); font-size:0.9rem;">Passing a test (score ≥ 70) marks this skill as covered for that role.</p>
                        </div>
                        <div class="practice-language">
                            <label for="practiceLangSelect" style="display:block; font-weight:700; margin-bottom:0.5rem;">Language</label>
                            <select id="practiceLangSelect" class="missing-skills-select">
                                <option value="python">Python</option>
                                <option value="javascript">JavaScript</option>
                                <option value="java">Java</option>
                                <option value="cpp">C++</option>
                            </select>
                        </div>
                    </div>


                    <div class="difficulty-cards">
                        <div class="difficulty-card easy">
                            <h3>Easy</h3>
                            <p class="count">Warm-up</p>
                            <button class="btn-primary" type="button" data-difficulty="easy">Generate New</button>
                        </div>
                        <div class="difficulty-card medium">
                            <h3>Medium</h3>
                            <p class="count">Interview</p>
                            <button class="btn-primary" type="button" data-difficulty="medium">Generate New</button>
                        </div>
                        <div class="difficulty-card hard">
                            <h3>Hard</h3>
                            <p class="count">Advanced</p>
                            <button class="btn-primary" type="button" data-difficulty="hard">Generate New</button>
                        </div>
                    </div>

                    <div class="practice-workspace">
                        <div class="practice-problem">
                            <div class="practice-problem-header">
                                <h3 id="practiceProblemTitle" style="margin:0;">Select difficulty to generate a test</h3>
                                <span id="practiceProblemMeta" class="badge" style="display:none;"></span>
                            </div>
                            <div id="practiceProblemBody" class="practice-problem-body">
                                <p style="margin:0; color:var(--gray-600);">Test questions will appear here.</p>
                            </div>
                        </div>
                        <div class="practice-solution">
                            <h3 style="margin:0 0 0.75rem;">Your Answers</h3>
                            <div class="practice-actions">
                                <button id="practiceEvaluateBtn" class="btn-primary" type="button" disabled>Submit Test</button>
                                <span id="practiceStatus" style="color:var(--gray-600); font-size:0.95rem;"></span>
                            </div>
                            <div id="practiceFeedback" class="practice-feedback" style="display:none;"></div>
                        </div>
                    </div>
                </div>

                <div class="practice-panel" style="margin-top:1.5rem;">
                    <div class="card-header" style="margin-bottom:1rem;">
                        <h2 style="margin:0;">📈 Progress Report</h2>
                        <span class="badge success">Auto-updated</span>
                    </div>
                    <div id="practiceProgressReport"></div>
                </div>
            `}
        </div>
    `;

    if (!resumeData || !resumeData.foundSkills) return;

    const companySelect = section.querySelector('#practiceCompanySelect');
    const skillSelect = section.querySelector('#practiceSkillSelect');
    const langSelect = section.querySelector('#practiceLangSelect');
    const genButtons = Array.from(section.querySelectorAll('button[data-difficulty]'));
    const combinedBtn = section.querySelector('#practiceCombinedBtn');
    const titleEl = section.querySelector('#practiceProblemTitle');
    const metaEl = section.querySelector('#practiceProblemMeta');
    const bodyEl = section.querySelector('#practiceProblemBody');
    const evalBtn = section.querySelector('#practiceEvaluateBtn');
    const statusEl = section.querySelector('#practiceStatus');
    const feedbackEl = section.querySelector('#practiceFeedback');

    let currentTest = null;
    let currentQuestionIndex = 0;
    let currentAnswers = [];

    async function generateCombinedAssessment() {
        const companyIdx = companySelect ? companySelect.value : '';
        const role = roles && companyIdx !== '' && companyIdx !== null ? roles[parseInt(companyIdx, 10)] : null;
        if (!role) {
            statusEl.textContent = 'Please select a company role first.';
            return;
        }

        const { missingRequired, missingNice } = getMissingSkillsForJob(role, resumeData);
        const skills = [...missingRequired, ...missingNice].map(s => (s || '').toString().trim()).filter(Boolean);
        if (!skills.length) {
            statusEl.textContent = 'No missing skills for this role! You are already prepared.';
            return;
        }

        if (typeof generateCombinedAssessmentAPI !== 'function') {
            statusEl.textContent = 'Backend API not configured.';
            return;
        }

        statusEl.textContent = 'Generating 50-question combined assessment for all missing skills…';
        feedbackEl.style.display = 'none';
        evalBtn.disabled = true;
        currentTest = null;
        currentQuestionIndex = 0;
        currentAnswers = [];
        metaEl.style.display = 'none';

        try {
            const assessment = await generateCombinedAssessmentAPI(skills, role.companyName, role.title);
            currentTest = assessment;
            currentTest.difficulty = 'combined'; // For tracking
            currentQuestionIndex = 0;
            currentAnswers = [];
            titleEl.textContent = `Combined Interview Assessment: ${role.companyName}`;
            metaEl.textContent = `70 Questions • ${role.title}`;
            metaEl.className = `badge primary`;
            metaEl.style.display = 'inline-flex';

            renderCurrentQuestion();
            statusEl.textContent = 'Assessment ready. Complete all 70 questions to see your eligibility.';
        } catch (e) {
            statusEl.textContent = `Generation failed: ${e?.message || 'Unknown error'}`;
        }
    }

    function renderProgressReport() {
        const attempts = _readPracticeAttempts();
        const wrap = section.querySelector('#practiceProgressReport');
        if (!wrap) return;
        if (!attempts.length) {
            wrap.innerHTML = `<p style="margin:0; color:var(--gray-600);">No attempts yet. Generate a problem and submit your solution to start tracking progress.</p>`;
            return;
        }

        const recent = [...attempts].sort((a, b) => (b?.ts || 0) - (a?.ts || 0)).slice(0, 12);
        const covered = getCoveredSkillsSet();

        wrap.innerHTML = `
            <div class="progress-summary">
                <div><strong>Skills covered:</strong> ${covered.size}</div>
                <div><strong>Total attempts:</strong> ${attempts.length}</div>
            </div>
            <div class="progress-table">
                <div class="progress-row head">
                    <div>Skill</div><div>Difficulty</div><div>Score</div><div>Status</div><div>When</div>
                </div>
                ${recent.map(a => {
            const score = Number(a?.score) || 0;
            const passed = !!a?.passed;
            const when = a?.ts ? new Date(a.ts).toLocaleString() : '';
            return `
                        <div class="progress-row">
                            <div>${escapeHtml(a.skill || '')}</div>
                            <div>${escapeHtml((a.difficulty || '').toString())}</div>
                            <div>${score}</div>
                            <div><span class="badge ${passed ? 'success' : 'warning'}">${passed ? 'Passed' : 'Needs work'}</span></div>
                            <div style="color:var(--gray-600); font-size:0.9rem;">${escapeHtml(when)}</div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    function populateSkillOptionsForRole(roleIdx) {
        if (!skillSelect) return;
        const idx = typeof roleIdx === 'number' ? roleIdx : parseInt(roleIdx || '-1', 10);
        const role = roles && idx >= 0 && roles[idx] ? roles[idx] : null;
        if (!role || !resumeData) {
            skillSelect.innerHTML = '<option value="">Select a company role first</option>';
            return;
        }
        const { missingRequired, missingNice } = getMissingSkillsForJob(role, resumeData);
        const skills = [...missingRequired, ...missingNice].map(s => (s || '').toString().trim()).filter(Boolean);
        if (!skills.length) {
            skillSelect.innerHTML = '<option value="">No missing skills for this role 🎉</option>';
            return;
        }
        skillSelect.innerHTML = skills.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    }

    function renderCurrentQuestion() {
        if (!currentTest || !Array.isArray(currentTest.questions) || !currentTest.questions.length) {
            bodyEl.innerHTML = '<p style="margin:0; color:var(--gray-600);">No questions found in this test.</p>';
            evalBtn.disabled = true;
            return;
        }
        const questions = currentTest.questions;
        const idx = currentQuestionIndex;
        const q = questions[idx];
        const num = idx + 1;
        const type = (q.type || '').toLowerCase() === 'mcq' ? 'MCQ' : 'Coding';
        const qid = `q_${num}`;
        const saved = currentAnswers[idx] || {};

        function normalizeOptionText(raw) {
            const cleaned = String(raw ?? '')
                .replace(/<br\s*\/?>/gi, ' ')
                .replace(/[\r\n]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // If the model returns spaced letters like: "J a v a S c r i p t"
            // convert back to "JavaScript" even if punctuation tokens (like ".") are present.
            const value = cleaned;
            const tokens = value.split(/\s+/).filter(Boolean);
            const singleLetters = tokens.filter(t => t.length === 1 && /[A-Za-z]/.test(t));
            const ratio = tokens.length ? (singleLetters.length / tokens.length) : 0;
            if (singleLetters.length >= 6 && ratio >= 0.6) {
                const joined = singleLetters.join('');
                if (joined && joined.trim()) return joined;
            }
            return value;
        }

        const optionsHtml = (Array.isArray(q.options) ? q.options : []).map((opt, oi) => {
            const value = normalizeOptionText(opt);
            const checked = saved.type === 'mcq' && saved.answer === value ? 'checked' : '';
            return `
                <label class="test-q-option">
                    <input type="radio" name="${qid}" value="${escapeHtml(value)}" ${checked}>
                    <span title="${escapeHtml(value)}">${String.fromCharCode(65 + oi)}. ${escapeHtml(value)}</span>
                </label>
            `;
        }).join('');

        const codeValue = saved.type === 'coding' ? (saved.answer || '') : '';

        bodyEl.innerHTML = `
            <div class="single-question-wrapper">
                <div class="test-question">
                    <div class="test-q-header">
                        <span class="test-q-number">Q${num} of ${questions.length}</span>
                        <span class="test-q-type badge">${type}</span>
                    </div>
                    <p class="test-q-prompt">${escapeHtml(q.title || '')}</p>
                    <p class="test-q-body">${escapeHtml(q.prompt || '')}</p>
                    ${type === 'MCQ' ? `
                        <div class="test-q-options">
                            ${optionsHtml}
                        </div>
                    ` : `
                        <textarea class="test-q-code" data-qid="${qid}" placeholder="Write your code answer here...">${escapeHtml(codeValue)}</textarea>
                    `}
                </div>
                <div class="test-nav-row">
                    <button type="button" class="btn-secondary" id="testPrevBtn" ${idx === 0 ? 'disabled' : ''}>Previous</button>
                    <div class="test-nav-spacer"></div>
                    ${idx < questions.length - 1
                ? `<button type="button" class="btn-primary" id="testNextBtn">Next Question</button>`
                : ''}
                </div>
            </div>
        `;

        // Enable and show submit only on last question
        if (evalBtn) {
            const isLast = idx === questions.length - 1;
            evalBtn.disabled = !isLast;
            evalBtn.style.visibility = isLast ? 'visible' : 'hidden';
        }

        const prevBtn = bodyEl.querySelector('#testPrevBtn');
        const nextBtn = bodyEl.querySelector('#testNextBtn');

        function persistCurrentAnswer() {
            if (!currentTest) return;
            const qNow = currentTest.questions[currentQuestionIndex];
            const numNow = currentQuestionIndex + 1;
            const qidNow = `q_${numNow}`;
            if ((qNow.type || '').toLowerCase() === 'mcq') {
                const chosen = bodyEl.querySelector(`input[name="${qidNow}"]:checked`);
                currentAnswers[currentQuestionIndex] = {
                    id: qNow.id || qidNow,
                    type: 'mcq',
                    answer: chosen ? chosen.value : ''
                };
            } else {
                const ta = bodyEl.querySelector(`textarea[data-qid="${qidNow}"]`);
                currentAnswers[currentQuestionIndex] = {
                    id: qNow.id || qidNow,
                    type: 'coding',
                    answer: (ta?.value || '').toString()
                };
            }
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                persistCurrentAnswer();
                if (currentQuestionIndex > 0) {
                    currentQuestionIndex -= 1;
                    renderCurrentQuestion();
                }
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                persistCurrentAnswer();
                if (currentQuestionIndex < questions.length - 1) {
                    currentQuestionIndex += 1;
                    renderCurrentQuestion();
                }
            });
        }
    }

    async function generateTest(difficulty) {
        const companyIdx = companySelect ? companySelect.value : '';
        const skill = (skillSelect?.value || '').toString().trim();
        if (!companyIdx) {
            statusEl.textContent = 'Please select a company role first.';
            return;
        }
        if (!skill) {
            statusEl.textContent = 'Please select a missing skill for this role.';
            return;
        }
        if (typeof generatePracticeTestAPI !== 'function') {
            statusEl.textContent = 'Backend API not configured.';
            return;
        }
        statusEl.textContent = 'Generating test…';
        feedbackEl.style.display = 'none';
        evalBtn.disabled = true;
        currentTest = null;
        currentQuestionIndex = 0;
        currentAnswers = [];
        metaEl.style.display = 'none';

        try {
            const test = await generatePracticeTestAPI(skill, difficulty);
            currentTest = test;
            currentQuestionIndex = 0;
            currentAnswers = [];
            titleEl.textContent = `Test for ${skill} (${difficulty.toUpperCase()})`;
            metaEl.textContent = `${(test?.skill || skill)} • ${(test?.difficulty || difficulty).toUpperCase()}`;
            metaEl.className = `badge ${difficulty === 'easy' ? 'success' : difficulty === 'medium' ? 'warning' : 'danger'}`;
            metaEl.style.display = 'inline-flex';

            renderCurrentQuestion();
            statusEl.textContent = 'Test ready. Navigate through questions, then submit after the last one.';
        } catch (e) {
            statusEl.textContent = `Generation failed: ${e?.message || 'Unknown error'}`;
        }
    }

    async function evaluateCurrentSolution() {
        if (!currentTest) return;
        const skill = currentTest.difficulty === 'combined' ? 'Combined Assessment' : (skillSelect?.value || '').toString().trim();
        const difficulty = (currentTest?.difficulty || '').toString().toLowerCase().trim() || 'unknown';
        const language = (langSelect?.value || 'python').toString();
        if (typeof evaluatePracticeTestAPI !== 'function') {
            statusEl.textContent = 'Backend API not configured.';
            return;
        }

        // Ensure current (last) question answer is stored
        if (currentTest && Array.isArray(currentTest.questions) && currentTest.questions.length) {
            const idx = currentQuestionIndex;
            const qNow = currentTest.questions[idx];
            const numNow = idx + 1;
            const qidNow = `q_${numNow}`;
            if ((qNow.type || '').toLowerCase() === 'mcq') {
                const chosen = bodyEl.querySelector(`input[name="${qidNow}"]:checked`);
                currentAnswers[idx] = {
                    id: qNow.id || qidNow,
                    type: 'mcq',
                    answer: chosen ? chosen.value : ''
                };
            } else {
                const ta = bodyEl.querySelector(`textarea[data-qid="${qidNow}"]`);
                currentAnswers[idx] = {
                    id: qNow.id || qidNow,
                    type: 'coding',
                    answer: (ta?.value || '').toString()
                };
            }
        }

        // Build answers array for all questions (keep order)
        const answers = [];
        const questions = Array.isArray(currentTest?.questions) ? currentTest.questions : [];
        questions.forEach((q, idx) => {
            const num = idx + 1;
            const qid = `q_${num}`;
            const saved = currentAnswers[idx] || {};
            if ((q.type || '').toLowerCase() === 'mcq') {
                answers.push({
                    id: q.id || qid,
                    type: 'mcq',
                    answer: typeof saved.answer === 'string' ? saved.answer : ''
                });
            } else {
                answers.push({
                    id: q.id || qid,
                    type: 'coding',
                    answer: (saved.answer || '').toString()
                });
            }
        });

        evalBtn.disabled = true;
        statusEl.textContent = 'Evaluating test…';
        feedbackEl.style.display = 'none';

        try {
            const result = await evaluatePracticeTestAPI(currentTest, answers, language);
            const score = Number(result?.score) || 0;
            const passed = !!result?.passed;

            const attempts = _readPracticeAttempts();
            attempts.push({ ts: Date.now(), skill, difficulty, score, passed });
            _writePracticeAttempts(attempts);

            feedbackEl.style.display = 'block';
            
            // Check eligibility message (score 60-70 range, or just 60+)
            const eligibilityMsg = (difficulty === 'combined' && score >= 60)
                ? `<div class="congratulations-card" style="margin-top: 1rem; padding: 1.5rem; background: linear-gradient(135deg, #10b981, #059669); color: white; border-radius: var(--radius-lg); text-align: center; box-shadow: var(--shadow-lg);">
                    <h2 style="margin: 0 0 0.5rem; font-size: 1.75rem;">🎉 Congratulations!</h2>
                    <p style="margin: 0; font-size: 1.1rem; font-weight: 500;">You scored ${score}/100. Based on your performance, you are officially eligible for the ${currentTest.role || 'role'} position at ${currentTest.assessmentTitle?.split(': ')[1] || 'the company'}!</p>
                    <div style="margin-top: 1rem; font-size: 0.9rem; opacity: 0.9;">Your readiness has been recorded in your progress report.</div>
                   </div>`
                : '';

            feedbackEl.innerHTML = `
                <div class="feedback-header">
                    <div class="feedback-score">
                        <span class="badge ${passed ? 'success' : 'warning'}">${passed ? 'Passed' : 'Needs work'}</span>
                        <span style="margin-left:0.5rem; font-weight:800;">Score: ${score}/100</span>
                    </div>
                </div>
                ${eligibilityMsg}
                <p style="margin:0.75rem 0 0; white-space:pre-wrap;">${escapeHtml(result?.feedback || '')}</p>
                ${(Array.isArray(result?.improvements) && result.improvements.length) ? `
                    <p style="margin:1rem 0 0.5rem; font-weight:700;">Next improvements</p>
                    <ul style="margin:0; padding-left:1.25rem;">
                        ${result.improvements.slice(0, 5).map(x => `<li>${escapeHtml(x)}</li>`).join('')}
                    </ul>
                ` : ''}
            `;

            statusEl.textContent = passed
                ? 'Great! This skill is now counted as covered for this role and eligibility.'
                : 'Saved to progress report. Try generating a new question and improve your score.';

            renderProgressReport();
            window.dispatchEvent(new CustomEvent('practiceCompleted'));
        } catch (e) {
            statusEl.textContent = `Evaluation failed: ${e?.message || 'Unknown error'}`;
        } finally {
            evalBtn.disabled = false;
        }
    }

    if (companySelect) {
        companySelect.addEventListener('change', () => {
            populateSkillOptionsForRole(companySelect.value);
            if (skillSelect) skillSelect.value = '';
        });
    }
    genButtons.forEach(btn => btn.addEventListener('click', () => generateTest(btn.getAttribute('data-difficulty'))));
    if (combinedBtn) {
        combinedBtn.addEventListener('click', generateCombinedAssessment);
    }
    evalBtn.addEventListener('click', evaluateCurrentSolution);
    renderProgressReport();
}


function loadInterviewSection(section) {
        section.innerHTML = `
        <div class="page-header">
            <div>
                <h1>💼 Mock Interviews</h1>
                <p class="page-subtitle">Practice with AI-powered interview simulations</p>
            </div>
            <button class="btn-primary" onclick="startMockInterview()">
                <span>🎙️</span> Start Interview
            </button>
        </div>
        <div class="interview-content">
            <div class="interview-types">
                <div class="interview-type-card">
                    <h3>Technical Interview</h3>
                    <p>DSA, System Design, Coding</p>
                    <button class="btn-secondary">Practice</button>
                </div>
                <div class="interview-type-card">
                    <h3>HR Interview</h3>
                    <p>Behavioral, Situational</p>
                    <button class="btn-secondary">Practice</button>
                </div>
                <div class="interview-type-card">
                    <h3>Domain Specific</h3>
                    <p>Role-based questions</p>
                    <button class="btn-secondary">Practice</button>
                </div>
            </div>
        </div>
    `;
    }

    function loadPredictionSection(section) {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const resumeData = currentUser?.resumeData;
        const prediction = resumeData?.placementPrediction;

        if (!prediction) {
            section.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>🎯 Placement Prediction</h1>
                    <p class="page-subtitle">AI-powered analysis of your placement prospects</p>
                </div>
            </div>
            <div class="prediction-content">
                <div class="empty-state">
                    <p>Please upload and analyze your resume first to generate placement prediction.</p>
                    <button class="btn-primary" onclick="window.location.href='resume.html'">Upload Resume</button>
                </div>
            </div>
        `;
            return;
        }

        const verdictClass = prediction.verdictClass || 'success';

        section.innerHTML = `
        <div class="page-header">
            <div>
                <h1>🎯 Placement Prediction</h1>
                <p class="page-subtitle">AI-powered analysis of your placement prospects</p>
            </div>
        </div>
        <div class="prediction-content">
            <div class="prediction-card">
                <div class="prediction-score">
                    <div class="score-circle-large">
                        <span class="score-number">${prediction.score}</span>
                        <span class="score-max">/10</span>
                    </div>
                    <h3>Placement Readiness Score</h3>
                    <p class="score-verdict ${verdictClass}">${prediction.verdict}</p>
                </div>
                <div class="prediction-details">
                    <h4>Best Fit Roles:</h4>
                    <ul>
                        ${prediction.bestFitRoles.map(role => `<li>${role}</li>`).join('')}
                    </ul>
                    <h4>Target Companies:</h4>
                    <ul>
                        ${prediction.targetCompanies.map(company => `<li>${company}</li>`).join('')}
                    </ul>
                    <h4>Expected Package Range:</h4>
                    <p class="package-range">${prediction.salaryRange}</p>
                    ${prediction.generatedAt ? `
                        <p class="prediction-date" style="margin-top: 1rem; font-size: 0.875rem; color: var(--gray-500);">
                            Generated on: ${new Date(prediction.generatedAt).toLocaleDateString()}
                        </p>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    }

    // Handle logout
    function handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('rememberMe');
            window.location.href = 'login.html';
        }
    }

    // Helper functions
    function startSkillTest() {
        alert('Skill test feature coming soon!');
    }

    function startMockInterview() {
        alert('Mock interview feature coming soon!');
    }

    // Show notification
    function showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--success);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    `;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Add dynamic styles for dynamic content
    const style = document.createElement('style');
    style.textContent = `
    .profile-card, .prediction-card {
        background: var(--white);
        padding: 2rem;
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-md);
        margin-top: 2rem;
    }
    
    .progress-bar {
        height: 40px;
        background: var(--gray-200);
        border-radius: var(--radius-full);
        overflow: hidden;
        margin: 1.5rem 0;
    }
    
    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--primary), var(--secondary));
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--white);
        font-weight: 700;
        transition: width 1s ease;
    }
    
    .difficulty-cards, .interview-types {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 2rem;
        margin-top: 2rem;
    }
    
    .difficulty-card, .interview-type-card {
        background: var(--white);
        padding: 2rem;
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-md);
        text-align: center;
    }
    
    .difficulty-card.easy { border-top: 4px solid var(--success); }
    .difficulty-card.medium { border-top: 4px solid var(--warning); }
    .difficulty-card.hard { border-top: 4px solid var(--danger); }

    .practice-panel {
        background: var(--white);
        padding: 1.5rem;
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-md);
        margin-top: 1.25rem;
    }

    .practice-controls {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.25rem;
        align-items: flex-end;
        margin-bottom: 1.5rem;
    }

    .practice-workspace {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 1.5rem;
        margin-top: 1.5rem;
    }

    .practice-problem, .practice-solution {
        background: var(--gray-50);
        border: 1px solid var(--gray-200);
        padding: 1.25rem;
        border-radius: var(--radius-lg);
    }

    .practice-problem-header {
        display:flex;
        align-items:center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.75rem;
    }

    .practice-textarea {
        width: 100%;
        min-height: 240px;
        resize: vertical;
        padding: 0.9rem 1rem;
        border-radius: var(--radius-lg);
        border: 1px solid var(--gray-300);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 0.95rem;
        line-height: 1.5;
        background: var(--white);
        outline: none;
    }

    .practice-actions {
        display:flex;
        align-items:center;
        gap: 1rem;
        margin-top: 0.75rem;
    }

    .practice-feedback {
        margin-top: 1rem;
        background: var(--white);
        border: 1px solid var(--gray-200);
        border-radius: var(--radius-lg);
        padding: 1rem;
    }

    .example-box {
        background: rgba(99, 102, 241, 0.06);
        border: 1px solid rgba(99, 102, 241, 0.18);
        padding: 0.9rem 1rem;
        border-radius: var(--radius-lg);
    }

    .test-question-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .test-question {
        background: var(--white);
        border-radius: var(--radius-lg);
        border: 1px solid var(--gray-200);
        padding: 0.9rem 1rem;
        width: 100%;
    }

    .test-q-header {
        display:flex;
        justify-content: space-between;
        align-items:center;
        margin-bottom: 0.5rem;
    }

    .test-q-number {
        font-weight: 700;
        color: var(--gray-800);
    }

    .test-q-prompt {
        margin: 0 0 0.25rem;
        color: var(--gray-900);
        font-weight: 600;
        font-size: 0.98rem;
    }

    .test-q-body {
        margin: 0 0 0.5rem;
        color: var(--gray-700);
        font-size: 0.95rem;
    }

    .test-q-options {
        display:flex;
        flex-direction: column;
        gap: 0.35rem;
        margin-top: 0.5rem;
        align-items: stretch;
        max-width: 100%;
        width: 100%;
    }

    .test-q-option {
        display: grid;
        grid-template-columns: 28px 1fr;
        align-items: start;
        column-gap: 0.65rem;
        font-size: 0.95rem;
        color: var(--gray-800);
        padding: 0.25rem 0.4rem;
        cursor: pointer;
        width: 100%;
    }

    .test-q-option input[type="radio"] {
        margin: 0;
        accent-color: var(--primary);
        flex-shrink: 0;
        margin-top: 0.2rem;
    }

    .test-q-option span {
        display: block;
        white-space: normal;
        overflow: visible;
        text-overflow: unset;
        word-break: break-word;
        font-size: 0.95rem;
        color: var(--gray-800);
        line-height: 1.3;
        text-align: left;
    }

    .test-q-option:hover {
        color: var(--primary);
    }

    .test-q-code {
        width: 100%;
        min-height: 140px;
        resize: vertical;
        padding: 0.6rem 0.75rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--gray-300);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 0.9rem;
        line-height: 1.5;
    }

    .progress-summary {
        display:flex;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
        color: var(--gray-800);
        font-weight: 600;
    }

    .progress-table {
        display:flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .progress-row {
        display:grid;
        grid-template-columns: 1.2fr 0.7fr 0.4fr 0.6fr 1fr;
        gap: 0.75rem;
        align-items:center;
        padding: 0.8rem 0.9rem;
        background: var(--white);
        border: 1px solid var(--gray-200);
        border-radius: var(--radius-lg);
    }

    .progress-row.head {
        background: var(--gray-50);
        border-color: var(--gray-200);
        font-weight: 800;
        color: var(--gray-800);
    }

    @media (max-width: 980px) {
        .practice-workspace { grid-template-columns: 1fr; }
        .practice-controls { grid-template-columns: 1fr; }
        .progress-row { grid-template-columns: 1fr 1fr 1fr; }
        .progress-row > div:nth-child(4), .progress-row > div:nth-child(5) { display:none; }
        .progress-row.head > div:nth-child(4), .progress-row.head > div:nth-child(5) { display:none; }
    }
    
    .score-circle-large {
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin: 0 auto 2rem;
        color: var(--white);
    }
    
    .score-number {
        font-size: 4rem;
        font-weight: 800;
        line-height: 1;
    }
    
    .score-max {
        font-size: 1.5rem;
        opacity: 0.8;
    }
    
    .score-verdict.success {
        color: var(--success);
        font-weight: 700;
        font-size: 1.1rem;
    }
    
    .package-range {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--primary);
        margin-top: 0.5rem;
    }
    
    .missing-content {
        margin-top: 2rem;
    }
    
    .missing-category {
        margin-bottom: 3rem;
    }
    
    .missing-category h3 {
        color: var(--gray-900);
        margin-bottom: 1.5rem;
        font-size: 1.5rem;
    }
    
    .missing-skills-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1.5rem;
    }
    
    .missing-skill-card {
        background: var(--white);
        padding: 1.5rem;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        border-left: 4px solid var(--gray-300);
        transition: all var(--transition-base);
    }
    
    .missing-skill-card:hover {
        transform: translateY(-3px);
        box-shadow: var(--shadow-md);
    }
    
    .missing-skill-card.high {
        border-left-color: var(--danger);
        background: rgba(239, 68, 68, 0.02);
    }
    
    .missing-skill-card.medium {
        border-left-color: var(--warning);
        background: rgba(245, 158, 11, 0.02);
    }
    
    .missing-skill-card.low {
        border-left-color: var(--info);
        background: rgba(59, 130, 246, 0.02);
    }
    
    .skill-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }
    
    .skill-header h4 {
        color: var(--gray-900);
        font-size: 1.1rem;
        margin: 0;
    }
    
    .priority-badge {
        padding: 0.25rem 0.75rem;
        border-radius: var(--radius-full);
        font-size: 0.75rem;
        font-weight: 700;
    }
    
    .priority-badge.high {
        background: rgba(239, 68, 68, 0.1);
        color: var(--danger);
    }
    
    .priority-badge.medium {
        background: rgba(245, 158, 11, 0.1);
        color: var(--warning);
    }
    
    .priority-badge.low {
        background: rgba(59, 130, 246, 0.1);
        color: var(--info);
    }
    
    .skill-category {
        color: var(--gray-600);
        font-size: 0.875rem;
        margin-bottom: 0.5rem;
    }
    
    .skill-description {
        color: var(--gray-700);
        font-size: 0.9rem;
        line-height: 1.6;
        margin: 0;
    }
    
    .requirements-section {
        margin-top: 3rem;
        background: var(--white);
        padding: 2rem;
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-md);
    }
    
    .requirements-section h3 {
        color: var(--gray-900);
        margin-bottom: 1.5rem;
        font-size: 1.5rem;
    }
    
    .requirements-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
    }
    
    .requirement-category {
        background: var(--gray-50);
        padding: 1.5rem;
        border-radius: var(--radius-lg);
    }
    
    .requirement-category h4 {
        color: var(--gray-900);
        margin-bottom: 1rem;
        font-size: 1.1rem;
    }
    
    .requirement-category ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    
    .requirement-category li {
        padding: 0.75rem 0;
        padding-left: 1.5rem;
        position: relative;
        color: var(--gray-700);
        line-height: 1.6;
    }
    
    .requirement-category li:before {
        content: '✓';
        position: absolute;
        left: 0;
        color: var(--primary);
        font-weight: 700;
    }
    
    .empty-state {
        text-align: center;
        padding: 4rem 2rem;
        background: var(--white);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-sm);
    }
    
    .empty-state p {
        color: var(--gray-600);
        margin-bottom: 1.5rem;
        font-size: 1.1rem;
    }
    
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .score-verdict.danger {
        color: var(--danger);
        font-weight: 700;
        font-size: 1.1rem;
    }
    
    .score-verdict.warning {
        color: var(--warning);
        font-weight: 700;
        font-size: 1.1rem;
    }

    /* Personalized Study Plan Panel */
    .study-plan-panel {
        background: var(--white);
        padding: 1.5rem;
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-md);
        margin-top: 1.25rem;
    }

    .study-plan-topics {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
    }

    .study-topic-details {
        border: 1px solid var(--gray-200);
        border-radius: var(--radius-lg);
        background: var(--gray-50);
        padding: 0.75rem 1rem;
    }

    .study-topic-details summary {
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        list-style: none;
    }

    .study-topic-details summary::-webkit-details-marker {
        display: none;
    }

    .study-topic-checkbox {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-weight: 900;
        color: var(--gray-900);
    }

    .study-topic-done {
        cursor: pointer;
    }

    .study-topic-time {
        color: var(--gray-600);
        font-size: 0.9rem;
        font-weight: 700;
        white-space: nowrap;
    }

    .study-topic-body {
        margin-top: 0.75rem;
    }

    .study-subheading {
        font-weight: 900;
        color: var(--gray-900);
        margin: 0.75rem 0 0.5rem;
        font-size: 0.95rem;
    }

    .study-notes-list {
        margin: 0 0 0 1.25rem;
        color: var(--gray-700);
        line-height: 1.6;
    }

    .study-materials {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
        margin-top: 0.25rem;
    }

    .study-material-chip {
        background: var(--white);
        border: 1px solid var(--gray-200);
        border-radius: var(--radius-lg);
        padding: 0.75rem 0.9rem;
    }

    .study-material-link {
        display: inline-block;
        margin-top: 0.35rem;
        color: var(--primary);
        font-weight: 900;
        text-decoration: none;
    }

    .study-material-link:hover {
        text-decoration: underline;
    }

    .study-progress-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        color: var(--gray-900);
        font-weight: 900;
    }

    .study-progress-bar {
        flex: 1;
        height: 10px;
        background: var(--gray-200);
        border-radius: var(--radius-full);
        overflow: hidden;
    }

    .study-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--primary), var(--secondary));
        width: 0%;
        transition: width 0.3s ease;
    }
`;
    document.head.appendChild(style);

    // Refresh missing-skills eligibility after practice attempts
    window.addEventListener('practiceCompleted', () => {
        try {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
            if (currentUser?.resumeData && currentUser?.resumeUploaded) {
                loadResumeData(currentUser.resumeData);
            }
        } catch { /* ignore */ }
    });

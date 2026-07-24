// Company Dashboard - Job Roles Management

const STORAGE_JOBS_KEY = 'allJobRoles';  // Global - used by skill gap detection

function loadCompanyData() {
    const company = JSON.parse(localStorage.getItem('currentCompany'));
    if (!company) {
        window.location.href = 'company-login.html';
        return null;
    }
    
    document.getElementById('companyName').textContent = company.companyName || 'Company';
    document.getElementById('companyEmail').textContent = company.email || '';
    const initials = (company.companyName || 'CO').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('companyInitials').textContent = initials;
    
    return company;
}

function toggleCompanyMenu() {
    document.getElementById('companyDropdown').classList.toggle('show');
}

document.addEventListener('click', (e) => {
    const menu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('companyDropdown');
    if (menu && dropdown && !menu.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});

function showCompanySection(sectionName, clickedEl) {
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    
    const target = document.getElementById(sectionName + 'Section');
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (clickedEl) clickedEl.classList.add('active');
    
    if (sectionName === 'jobs') {
        renderJobRoles();
    }
}

function getAllJobRoles() {
    const roles = JSON.parse(localStorage.getItem(STORAGE_JOBS_KEY) || '[]');
    if (roles.length) return roles;
    const company = JSON.parse(localStorage.getItem('currentCompany'));
    if (company?.jobRoles?.length) {
        return company.jobRoles.map(jr => ({ ...jr, companyName: company.companyName }));
    }
    return [];
}

function getCompanyJobRoles() {
    const company = JSON.parse(localStorage.getItem('currentCompany'));
    if (!company) return [];
    const list = company.jobRoles || [];
    return list.map(jr => ({ ...jr, companyName: company.companyName }));
}

async function saveJobRole(jobRole) {
    const company = JSON.parse(localStorage.getItem('currentCompany'));
    if (!company) return;
    
    const apiBase = (typeof API_CONFIG !== 'undefined' && API_CONFIG?.BASE_URL) ? API_CONFIG.BASE_URL : 'http://localhost:5000';
    
    try {
        const response = await fetch(`${apiBase}/api/companies/job-roles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: jobRole.title,
                department: jobRole.department,
                experience: jobRole.experience,
                skillsRequired: jobRole.skillsRequired,
                niceToHave: jobRole.niceToHave,
                description: jobRole.description,
                companyEmail: company.email
            })
        });
        const data = await response.json();
        
        if (response.ok && data.jobRole) {
            const newJob = { ...data.jobRole, companyName: company.companyName };
            if (!company.jobRoles) company.jobRoles = [];
            company.jobRoles.push(newJob);
            localStorage.setItem('currentCompany', JSON.stringify(company));
        } else {
            // Fallback: add to local state for display (offline / API error)
            if (!company.jobRoles) company.jobRoles = [];
            company.jobRoles.push({ ...jobRole, companyName: company.companyName });
            localStorage.setItem('currentCompany', JSON.stringify(company));
        }
    } catch (e) {
        if (!company.jobRoles) company.jobRoles = [];
        company.jobRoles.push({ ...jobRole, companyName: company.companyName });
        localStorage.setItem('currentCompany', JSON.stringify(company));
        console.warn('Could not sync job role to backend:', e.message);
    }
    
    syncJobRolesToGlobal();
    if (typeof refreshJobRolesFromAPI === 'function') await refreshJobRolesFromAPI();
}

function syncJobRolesToGlobal() {
    const company = JSON.parse(localStorage.getItem('currentCompany'));
    const roles = (company?.jobRoles || []).map(jr => ({ ...jr, companyName: company.companyName }));
    // Local company view writes its roles; student dashboard will be refreshed from backend.
    localStorage.setItem(STORAGE_JOBS_KEY, JSON.stringify(roles));
}

async function handleAddJobRole(event) {
    event.preventDefault();
    
    const skillsText = document.getElementById('skillsRequired').value;
    const niceText = document.getElementById('niceToHave').value;
    
    const jobRole = {
        id: Date.now(),
        title: document.getElementById('jobTitle').value,
        department: document.getElementById('jobDepartment').value || '',
        experience: document.getElementById('experience').value || '',
        skillsRequired: skillsText.split(',').map(s => s.trim()).filter(Boolean),
        niceToHave: niceText ? niceText.split(',').map(s => s.trim()).filter(Boolean) : [],
        description: document.getElementById('jobDescription').value || '',
        createdAt: new Date().toISOString()
    };
    
    await saveJobRole(jobRole);
    
    document.getElementById('jobRoleForm').reset();
    
    showCompanyNotification('Job role added successfully!');
    
    showCompanySection('jobs', document.querySelector('.nav-item'));
    document.querySelectorAll('.nav-item')[0].classList.add('active');
}

function renderJobRoles() {
    const roles = getCompanyJobRoles();
    const container = document.getElementById('jobRolesList');
    
    if (roles.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No job roles yet. Click "Add Job Role" to add your first role.</p>
                <button class="btn-primary" onclick="showCompanySection('add', document.querySelectorAll('.nav-item')[1])">Add Job Role</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = roles.map(jr => `
        <div class="job-role-card">
            <div class="job-role-header">
                <h3>${jr.title}</h3>
                <span class="job-role-meta">${jr.department || 'General'} • ${jr.experience || 'Any'}</span>
            </div>
            ${jr.description ? `<p class="job-role-desc">${jr.description}</p>` : ''}
            <div class="job-role-skills">
                <strong>Required:</strong>
                ${jr.skillsRequired.map(s => `<span class="skill-tag">${s}</span>`).join('')}
            </div>
            ${jr.niceToHave && jr.niceToHave.length ? `
                <div class="job-role-skills">
                    <strong>Nice to have:</strong>
                    ${jr.niceToHave.map(s => `<span class="skill-tag optional">${s}</span>`).join('')}
                </div>
            ` : ''}
            <button class="btn-outline btn-sm" onclick="deleteJobRole(${jr.id})">Delete</button>
        </div>
    `).join('');
}

async function deleteJobRole(id) {
    if (!confirm('Delete this job role?')) return;
    
    const company = JSON.parse(localStorage.getItem('currentCompany'));
    if (!company) return;

    // Optimistic local update
    company.jobRoles = (company.jobRoles || []).filter(jr => jr.id !== id);
    localStorage.setItem('currentCompany', JSON.stringify(company));
    syncJobRolesToGlobal();
    renderJobRoles();

    const apiBase = (typeof API_CONFIG !== 'undefined' && API_CONFIG?.BASE_URL) ? API_CONFIG.BASE_URL : 'http://localhost:5000';
    try {
        const response = await fetch(`${apiBase}/api/companies/job-roles/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            console.warn('Backend delete failed for job role', id);
        } else {
            // After backend delete, refresh global cache from API so student dashboard matches DB
            if (typeof refreshJobRolesFromAPI === 'function') await refreshJobRolesFromAPI();
        }
    } catch (e) {
        console.warn('Could not delete job role from backend:', e.message);
    }

    showCompanyNotification('Job role deleted.');
}

function showCompanyNotification(message) {
    const n = document.createElement('div');
    n.style.cssText = 'position:fixed;top:20px;right:20px;background:var(--success,#10b981);color:white;padding:1rem 1.5rem;border-radius:0.75rem;box-shadow:0 10px 25px rgba(0,0,0,0.15);z-index:9999;';
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

window.addEventListener('DOMContentLoaded', async () => {
    loadCompanyData();
    renderJobRoles();
    syncJobRolesToGlobal();
    if (typeof refreshJobRolesFromAPI === 'function') await refreshJobRolesFromAPI();
});

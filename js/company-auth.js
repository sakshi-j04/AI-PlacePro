// Company Authentication JavaScript - uses backend API / database

const API_BASE = (typeof API_CONFIG !== 'undefined' && API_CONFIG?.BASE_URL) ? API_CONFIG.BASE_URL : 'http://localhost:5000';

async function handleCompanySignup(event) {
    event.preventDefault();
    
    const companyName = document.getElementById('companyName').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const industry = document.getElementById('industry').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/companies/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyName, email, phone, industry, password })
        });
        const data = await response.json();

        if (!response.ok) {
            showNotification(data.error || 'Registration failed', 'error');
            if (response.status === 409) {
                setTimeout(() => { window.location.href = 'company-login.html'; }, 1500);
            }
            return;
        }
        
        const company = data.company;
        localStorage.setItem('currentCompany', JSON.stringify(company));
        
        showNotification('Company account created! Redirecting to dashboard...', 'success');
        setTimeout(() => { window.location.href = 'company-dashboard.html'; }, 1500);
    } catch (e) {
        showNotification('Network error. Is the backend running?', 'error');
    }
}

async function handleCompanyLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/companies/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (!response.ok) {
            showNotification(data.error || 'Invalid email or password!', 'error');
            return;
        }
        
        const company = data.company;
        localStorage.setItem('currentCompany', JSON.stringify(company));
        
        if (document.getElementById('remember')?.checked) {
            localStorage.setItem('rememberCompany', 'true');
        }
        
        showNotification('Login successful! Redirecting...', 'success');
        setTimeout(() => { window.location.href = 'company-dashboard.html'; }, 1000);
    } catch (e) {
        showNotification('Network error. Is the backend running?', 'error');
    }
}

function handleCompanyLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('currentCompany');
        localStorage.removeItem('rememberCompany');
        window.location.href = '../index.html';
    }
}

function showNotification(message, type) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
            <span class="notification-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add notification styles
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 1rem 1.5rem;
        border-radius: 0.75rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        transform: translateX(400px);
        transition: transform 0.3s ease;
    }
    .notification.show { transform: translateX(0); }
    .notification.success { border-left: 4px solid #10b981; }
    .notification.error { border-left: 4px solid #ef4444; }
    .notification-content { display: flex; align-items: center; gap: 0.75rem; }
    .notification-icon {
        width: 24px; height: 24px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-weight: bold; font-size: 0.875rem; color: white;
    }
    .notification.success .notification-icon { background: #10b981; }
    .notification.error .notification-icon { background: #ef4444; }
    .notification-message { color: #1f2937; font-weight: 500; }
`;
document.head.appendChild(style);

window.addEventListener('DOMContentLoaded', () => {
    const currentCompany = JSON.parse(localStorage.getItem('currentCompany'));
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentCompany && (currentPage === 'company-login.html' || currentPage === 'company-signup.html')) {
        window.location.href = 'company-dashboard.html';
    }
});

// Authentication JavaScript - uses backend API / database

const API_BASE = (typeof API_CONFIG !== 'undefined' && API_CONFIG?.BASE_URL) ? API_CONFIG.BASE_URL : 'http://localhost:5000';

// Handle Signup
async function handleSignup(event) {
    event.preventDefault();
    
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const college = document.getElementById('college').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, phone, college, password })
        });
        const data = await response.json();

        if (!response.ok) {
            showNotification(data.error || 'Registration failed', 'error');
            if (response.status === 409) {
                setTimeout(() => { window.location.href = 'login.html'; }, 1500);
            }
            return;
        }
        
        const user = data.user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        showNotification('Account created successfully! Redirecting...', 'success');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    } catch (e) {
        showNotification('Network error. Is the backend running?', 'error');
    }
}

// Handle Login
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (!response.ok) {
            showNotification(data.error || 'Invalid email or password!', 'error');
            return;
        }
        
        const user = data.user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        if (remember) localStorage.setItem('rememberMe', 'true');
        
        showNotification('Login successful! Redirecting...', 'success');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
    } catch (e) {
        showNotification('Network error. Is the backend running?', 'error');
    }
}

// Show Notification
function showNotification(message, type = 'info') {
    // Remove existing notification if any
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">
                ${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span class="notification-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add notification styles dynamically
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
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.success {
        border-left: 4px solid #10b981;
    }
    
    .notification.error {
        border-left: 4px solid #ef4444;
    }
    
    .notification.info {
        border-left: 4px solid #3b82f6;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .notification-icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 0.875rem;
    }
    
    .notification.success .notification-icon {
        background: #10b981;
        color: white;
    }
    
    .notification.error .notification-icon {
        background: #ef4444;
        color: white;
    }
    
    .notification.info .notification-icon {
        background: #3b82f6;
        color: white;
    }
    
    .notification-message {
        color: #1f2937;
        font-weight: 500;
    }
`;
document.head.appendChild(style);

// Check if user is already logged in
window.addEventListener('DOMContentLoaded', () => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentUser && (currentPage === 'login.html' || currentPage === 'signup.html')) {
        // Redirect to dashboard if already logged in
        window.location.href = 'dashboard.html';
    }
});

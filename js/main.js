// Main JavaScript File

// Smooth scroll behavior
document.documentElement.style.scrollBehavior = 'smooth';

// Page load animation
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);
});

// Animate elements on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all cards and sections
document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.card, .feature-card, .module-card, .problem-card, .timeline-item');
    elements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Utility: Get current user
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('currentUser'));
}

// Utility: Update user data
function updateUser(updatedData) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const updatedUser = { ...currentUser, ...updatedData };
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    
    // Update in users array
    let users = JSON.parse(localStorage.getItem('users')) || [];
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    if (userIndex !== -1) {
        users[userIndex] = updatedUser;
        localStorage.setItem('users', JSON.stringify(users));
    }
}

// Console branding
console.log('%c🎓 AI PlacePro', 'color: #6366f1; font-size: 24px; font-weight: bold;');
console.log('%cAI-Powered Placement Training System', 'color: #8b5cf6; font-size: 14px;');
console.log('%cBuilt with ❤️ for students', 'color: #6b7280; font-size: 12px;');

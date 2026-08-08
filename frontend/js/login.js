

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    const toggleIcon = document.getElementById('toggle-icon');
    const submitBtn = document.getElementById('submit-btn');
    const messageContainer = document.getElementById('login-message');

    // 1. Show/Hide Password Toggle Logic
    if (togglePasswordBtn && passwordInput && toggleIcon) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            
            // Toggle input type
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            
            // Toggle icon class
            if (isPassword) {
                toggleIcon.classList.remove('fa-eye');
                toggleIcon.classList.add('fa-eye-slash');
                togglePasswordBtn.setAttribute('aria-label', 'Hide password');
            } else {
                toggleIcon.classList.remove('fa-eye-slash');
                toggleIcon.classList.add('fa-eye');
                togglePasswordBtn.setAttribute('aria-label', 'Show password');
            }
        });
    }

    // 2. Form Submission Handling (Placeholder / Client-Side Demo Only)
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            // Clear previous messages
            messageContainer.className = 'login-message';
            messageContainer.textContent = '';

            // Simple client-side validation check
            if (!email || !password) {
                messageContainer.textContent = 'Please fill in both email and password fields.';
                messageContainer.classList.add('error');
                return;
            }

            // Show loading state
            submitBtn.classList.add('loading');
            submitBtn.innerHTML = '<span class="spinner"></span> Authenticating...';

            // Simulate authentication delay for UI preview before redirecting to dashboard
            setTimeout(() => {
                messageContainer.textContent = 'Authentication successful! Redirecting to Dashboard...';
                messageContainer.classList.add('success');

                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            }, 1200);
        });
    }
});

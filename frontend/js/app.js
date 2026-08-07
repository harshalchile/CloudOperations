/* 
 * Cloud Operations Center - Global JavaScript (app.js)
 * Master Application Navigation, Dynamic Date, Sidebar & Profile Dropdown handlers.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Highlight Active Sidebar Menu Item
    const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
    const sidebarLinks = document.querySelectorAll('.sidebar-link');

    sidebarLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // 2. Display Real-time Current Date
    const currentDateElement = document.getElementById('current-date-text');
    if (currentDateElement) {
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        const today = new Date();
        currentDateElement.textContent = today.toLocaleDateString('en-US', options);
    }

    // 3. Mobile Sidebar Toggle Handler
    const sidebarToggleBtn = document.getElementById('btn-sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    if (sidebarToggleBtn && sidebar) {
        sidebarToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        });

        // Close sidebar on clicking outside in mobile view
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
                if (!sidebar.contains(e.target) && e.target !== sidebarToggleBtn) {
                    sidebar.classList.remove('active');
                }
            }
        });
    }

    // 4. Profile Dropdown Menu Handler
    const profileTrigger = document.getElementById('profile-trigger');
    const profileMenu = document.getElementById('profile-dropdown-menu');

    if (profileTrigger && profileMenu) {
        profileTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle('active');
        });

        // Close profile dropdown when clicking outside
        document.addEventListener('click', () => {
            if (profileMenu.classList.contains('active')) {
                profileMenu.classList.remove('active');
            }
        });
    }
});

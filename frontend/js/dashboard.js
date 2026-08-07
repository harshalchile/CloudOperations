/* 
 * Cloud Operations Center - Dashboard JavaScript (dashboard.js)
 * Chart time period filters and EC2 table action feedback handlers.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Time Filter Buttons Toggle for CPU Line Chart
    const timeBtns = document.querySelectorAll('.btn-chart-time');
    
    timeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            timeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            console.log(`Chart filter switched to: ${btn.textContent}`);
        });
    });

    // 2. EC2 Instance Table Actions Handler (Demo Interaction)
    const ec2ActionBtns = document.querySelectorAll('.ec2-action-btn');
    
    ec2ActionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.textContent.trim();
            const instanceId = e.target.closest('tr').children[0].textContent.trim();
            
            alert(`[AWS EC2 Action] Executing '${action}' on instance: ${instanceId}`);
        });
    });
});

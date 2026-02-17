frappe.provide('ai_accountant');

// Add custom sidebar item after Call Logs
$(document).on('app_ready', function() {
    setTimeout(() => {
        addTestMenu();
    }, 2000);
});

function addTestMenu() {
    const sidebar = document.querySelector('.desk-sidebar');
    if (!sidebar) {
        console.log('Sidebar not found');
        return;
    }

    // Check if already added
    if (document.querySelector('.test-menu-item')) {
        console.log('Test menu already exists');
        return;
    }

    // Create custom menu item
    const menuItem = document.createElement('div');
    menuItem.className = 'sidebar-item-container test-menu-item';
    menuItem.innerHTML = `
        <div class="desk-sidebar-item standard-sidebar-item" 
             style="cursor: pointer; padding: 8px 12px;">
            <div class="item-anchor" style="display: flex; align-items: center;">
                <svg class="icon icon-sm" style="margin-right: 8px;">
                    <use href="#icon-star"></use>
                </svg>
                <span class="sidebar-item-label">Test Menu</span>
            </div>
        </div>
    `;

    // Add click handler - redirect to Dashboard
    menuItem.addEventListener('click', function() {
        console.log('Test Menu clicked!');
        frappe.set_route(''); // Redirects to Dashboard
        frappe.show_alert({
            message: 'Hello World from Test Menu!',
            indicator: 'green'
        });
    });

    // Find Call Logs menu item and insert after it
    const callLogsItem = Array.from(sidebar.querySelectorAll('.desk-sidebar-item')).find(
        item => item.textContent.trim().includes('Call Logs')
    );

    if (callLogsItem && callLogsItem.parentElement) {
        callLogsItem.parentElement.after(menuItem);
        console.log('Test menu added after Call Logs');
    } else {
        // Fallback: add before "Getting started" at the bottom
        const gettingStarted = sidebar.querySelector('[data-page-name="Getting started"]');
        if (gettingStarted && gettingStarted.parentElement) {
            gettingStarted.parentElement.before(menuItem);
            console.log('Test menu added before Getting Started');
        }
    }
}

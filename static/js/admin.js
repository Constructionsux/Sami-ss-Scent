// Auth Check
const token = localStorage.getItem('admin_token');
if (!token && !window.location.pathname.includes('admin_login')) {
    window.location.href = '/admin/login';
}

function logoutAdmin() {
    localStorage.removeItem('admin_token');
    window.location.href = '/admin/login';
}

// API Helper
async function adminFetch(endpoint, options = {}) {
    const headers = {
        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        ...options.headers
    };
    // Remove Content-Type for FormData (browser sets it with boundary)
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    } else {
        headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(endpoint, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
        logoutAdmin();
        throw new Error('Session expired');
    }
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Request failed');
    }
    return res.json();
}

// Dashboard Initialization
document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.pathname === '/admin/dashboard') {
        await loadDashboard();
        await loadDropdowns();
    }
});

async function loadDashboard() {
    try {
        const stats = await adminFetch('/api/admin/stats');
        document.getElementById('statOrders').textContent = stats.total_orders;
        document.getElementById('statRevenue').textContent = '₦' + stats.total_revenue.toLocaleString();
        document.getElementById('statPending').textContent = stats.pending_payments;

        // FIXED: Use the correct endpoint that exists in the backend
        const orders = await adminFetch('/api/admin/orders'); 
        const tbody = document.getElementById('ordersTableBody');
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No recent orders</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td><strong>#${order.order_number}</strong></td>
                <td>${order.customer_name}</td>
                <td>₦${order.total_amount.toLocaleString()}</td>
                <td>${order.created_at}</td>
                <td><span class="status-badge status-${order.payment_status}">${order.payment_status}</span></td>
                <td>
                    ${order.payment_status === 'submitted' ? `
                        <button class="btn-primary btn-sm" onclick="updatePayment('${order.id}', 'verified')">Verify</button>
                        <button class="btn-secondary btn-sm" style="color:#ef4444; border-color:#ef4444;" onclick="updatePayment('${order.id}', 'rejected')">Reject</button>
                    ` : '<span style="color:#6b7280; font-size:0.85rem;">Processed</span>'}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

async function updatePayment(orderId, status) {
    if (!confirm(`Mark this payment as ${status}?`)) return;
    
    const formData = new FormData();
    formData.append('status', status);

    try {
        await adminFetch(`/api/admin/orders/${orderId}/payment-status`, {
            method: 'PATCH',
            body: formData
        });
        alert(`Payment marked as ${status}`);
        loadDashboard(); // Refresh table
    } catch (error) {
        alert('Failed to update: ' + error.message);
    }
}

async function loadDropdowns() {
    try {
        const brands = await adminFetch('/api/admin/brands/list');
        const categories = await adminFetch('/api/admin/categories/list');
        
        const brandSelect = document.getElementById('brandSelect');
        brandSelect.innerHTML = brands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        
        const catSelect = document.getElementById('categorySelect');
        catSelect.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (error) {
        console.error('Failed to load dropdowns:', error);
    }
}

// Modal Handling
function openModal(id) {
    document.getElementById(id).classList.add('active');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Add Product Form
document.getElementById('addProductForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = 'Uploading & Creating...';

    try {
        await adminFetch('/api/admin/products', {
            method: 'POST',
            body: formData
        });
        alert('Product created successfully!');
        closeModal('productModal');
        e.target.reset();
    } catch (error) {
        alert('Failed to create product: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.toggle('active');
    if (overlay) {
        overlay.classList.toggle('active');
    }
}

// Newsletter Form
document.getElementById('newsletterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const btn = e.target.querySelector('button[type="submit"]');
    
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        await adminFetch('/api/admin/newsletter/send', {
            method: 'POST',
            body: formData
        });
        alert('Newsletter queued for sending!');
        closeModal('newsletterModal');
        e.target.reset();
    } catch (error) {
        alert('Failed to send: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send to All Subscribers';
    }
});

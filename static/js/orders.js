/* ============================================
   SAMI'S SCENT - ORDERS PAGE LOGIC
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
    // Shared UI components are initialized by shop.js
    await loadOrders();
    
    if (typeof CartManager !== 'undefined') {
        CartManager.updateCartCount();
    }
});

async function loadOrders() {
    const loadingEl = document.getElementById('ordersLoading');
    const authEl = document.getElementById('ordersAuthRequired');
    const emptyEl = document.getElementById('ordersEmpty');
    const listEl = document.getElementById('ordersList');

    try {
        const orders = await apiRequest('/api/orders/');
        loadingEl.style.display = 'none';

        if (!orders || orders.length === 0) {
            emptyEl.style.display = 'block';
            listEl.style.display = 'none';
            return;
        }

        listEl.style.display = 'flex';
        listEl.innerHTML = orders.map(order => renderOrderCard(order)).join('');

    } catch (error) {
        console.error('Failed to load orders:', error);
        loadingEl.style.display = 'none';
        
        if (error.message.includes('401') || error.message.includes('Invalid token')) {
            authEl.style.display = 'block';
        } else {
            listEl.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle" style="color: var(--color-error);"></i>
                    <h2>Error Loading Orders</h2>
                    <p>${error.message}</p>
                </div>
            `;
            listEl.style.display = 'block';
        }
    }
}

function renderOrderCard(order) {
    const date = new Date(order.created_at).toLocaleDateString('en-NG', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    return `
        <div class="order-card">
            <div class="order-header">
                <div>
                    <div class="order-number">Order #${order.order_number}</div>
                    <div class="order-date">Placed on ${date}</div>
                </div>
                <div class="order-statuses">
                    <span class="status-badge ${order.payment_status}">${formatStatus(order.payment_status)} Payment</span>
                    <span class="status-badge ${order.order_status}">${formatStatus(order.order_status)}</span>
                </div>
            </div>
            <div class="order-footer">
                <div class="order-total">₦${parseFloat(order.total_amount).toLocaleString()}</div>
                <button class="view-details-btn" onclick="viewOrderDetails('${order.order_number}')">
                    View Details
                </button>
            </div>
        </div>
    `;
}

async function viewOrderDetails(orderNumber) {
    const modal = document.getElementById('orderDetailsModal');
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = '<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i><p>Loading details...</p></div>';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
        const order = await apiRequest(`/api/orders/${orderNumber}`);
        
        const date = new Date(order.created_at).toLocaleDateString('en-NG', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        modalBody.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">Order Number</span>
                <span class="detail-value">#${order.order_number}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Date Placed</span>
                <span class="detail-value">${date}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Delivery Method</span>
                <span class="detail-value">${formatStatus(order.delivery_method)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Delivery Address</span>
                <span class="detail-value">${order.delivery_address}${order.city ? ', ' + order.city : ''}${order.state ? ', ' + order.state : ''}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Payment Status</span>
                <span class="detail-value"><span class="status-badge ${order.payment_status}">${formatStatus(order.payment_status)}</span></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Order Status</span>
                <span class="detail-value"><span class="status-badge ${order.order_status}">${formatStatus(order.order_status)}</span></span>
            </div>

            <div class="modal-items-list">
                <h4>Items Ordered (${order.items.length})</h4>
                ${order.items.map(item => `
                    <div class="modal-item">
                        <div>
                            <div class="modal-item-name">${item.product_name}</div>
                            <div class="modal-item-qty">Qty: ${item.quantity} × ₦${parseFloat(item.product_price).toLocaleString()}</div>
                        </div>
                        <div class="modal-item-price">₦${parseFloat(item.total_price).toLocaleString()}</div>
                    </div>
                `).join('')}
            </div>

            <div class="detail-row" style="margin-top: 1.5rem; border-top: 2px solid var(--color-border); padding-top: 1rem;">
                <span class="detail-label">Subtotal</span>
                <span class="detail-value">₦${parseFloat(order.subtotal).toLocaleString()}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Shipping Fee</span>
                <span class="detail-value">₦${parseFloat(order.shipping_fee).toLocaleString()}</span>
            </div>
            <div class="detail-row" style="font-size: 1.1rem;">
                <span class="detail-label" style="font-weight: 700; color: var(--color-text-primary);">Total Paid</span>
                <span class="detail-value" style="color: var(--color-accent);">₦${parseFloat(order.total_amount).toLocaleString()}</span>
            </div>
        `;
    } catch (error) {
        modalBody.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle" style="color: var(--color-error);"></i>
                <p>Failed to load order details: ${error.message}</p>
            </div>
        `;
    }
}

function closeModal() {
    const modal = document.getElementById('orderDetailsModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Event listeners for modal
document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('orderDetailsModal').addEventListener('click', (e) => {
    if (e.target.id === 'orderDetailsModal') closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// Helpers
function formatStatus(str) {
    if (!str) return '';
    return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

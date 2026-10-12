document.addEventListener('DOMContentLoaded', async () => {
    await loadOrderStats();
    await loadOrders();
});

async function loadOrderStats() {
    try {
        const stats = await adminFetch('/api/admin/orders/stats');
        document.getElementById('statTotalOrders').textContent = stats.total_orders;
        document.getElementById('statTopClient').textContent = stats.top_client;
        document.getElementById('statTopBrand').textContent = stats.top_brand;
        document.getElementById('statTopProduct').textContent = stats.top_product;
    } catch (error) {
        console.error('Failed to load order stats:', error);
    }
}

async function loadOrders() {
    try {
        const orders = await adminFetch('/api/admin/orders');
        const tbody = document.getElementById('ordersTableBody');
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem;">No orders found</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td><strong>#${order.order_number}</strong></td>
                <td>
                    <div>${order.customer_name}</div>
                    <small style="color: #6b7280;">${order.customer_email}</small>
                </td>
                <td>${order.created_at}</td>
                <td>${order.items_count}</td>
                <td>₦${order.total_amount.toLocaleString()}</td>
                <td><span class="status-badge status-${order.payment_status}">${order.payment_status}</span></td>
                <td><span class="status-badge status-${order.order_status}">${order.order_status}</span></td>
                <td>
                    <select onchange="updateOrderStatus('${order.id}', this.value)" class="status-select">
                        <option value="pending" ${order.order_status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="processing" ${order.order_status === 'processing' ? 'selected' : ''}>Processing</option>
                        <option value="shipped" ${order.order_status === 'shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="delivered" ${order.order_status === 'delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="completed" ${order.order_status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="cancelled" ${order.order_status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load orders:', error);
        document.getElementById('ordersTableBody').innerHTML = 
            `<tr><td colspan="8" style="text-align:center; color: #ef4444; padding: 2rem;">Failed to load orders</td></tr>`;
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        await adminFetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        // Optional: Show a subtle success toast or just let the UI reflect the change
        console.log(`Order ${orderId} updated to ${newStatus}`);
    } catch (error) {
        alert('Failed to update order status: ' + error.message);
        // Revert the dropdown selection on error
        await loadOrders(); 
    }
}

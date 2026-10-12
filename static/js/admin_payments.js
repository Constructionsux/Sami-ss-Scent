let currentOrderId = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadPaymentStats();
    await loadPayments();
});

async function loadPaymentStats() {
    try {
        const stats = await adminFetch('/api/admin/payments/stats');
        document.getElementById('statRevenue').textContent = '₦' + stats.total_revenue.toLocaleString(undefined, {minimumFractionDigits: 2});
        document.getElementById('statPending').textContent = stats.pending;
        document.getElementById('statVerified').textContent = stats.verified;
        document.getElementById('statRejected').textContent = stats.rejected;
    } catch (error) {
        console.error('Failed to load payment stats:', error);
    }
}

async function loadPayments() {
    try {
        const payments = await adminFetch('/api/admin/payments');
        const tbody = document.getElementById('paymentsTableBody');
        
        if (payments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No payment records found</td></tr>';
            return;
        }

        tbody.innerHTML = payments.map(p => `
            <tr>
                <td><strong>#${p.order_number}</strong></td>
                <td>${p.customer_name}</td>
                <td>₦${p.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td>${p.created_at}</td>
                <td>
                    ${p.receipt_url ? 
                        `<button class="btn-secondary btn-sm" onclick="viewReceipt('${p.id}', '${p.receipt_url}')"><i class="fas fa-eye"></i> View</button>` : 
                        `<span style="color: #9ca3af; font-size: 0.85rem;">None</span>`
                    }
                </td>
                <td><span class="status-badge status-${p.payment_status}">${p.payment_status}</span></td>
                <td>
                    ${p.payment_status === 'submitted' ? `
                        <button class="btn-primary btn-sm" style="background: #059669;" onclick="updatePaymentStatus('${p.id}', 'verified')">Verify</button>
                        <button class="btn-secondary btn-sm" style="color: #dc2626; border-color: #dc2626;" onclick="updatePaymentStatus('${p.id}', 'rejected')">Reject</button>
                    ` : `<span style="color: #6b7280; font-size: 0.85rem;">Processed</span>`}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load payments:', error);
        document.getElementById('paymentsTableBody').innerHTML = 
            `<tr><td colspan="7" style="text-align:center; color: #ef4444; padding: 2rem;">Failed to load payments</td></tr>`;
    }
}

function viewReceipt(orderId, receiptUrl) {
    currentOrderId = orderId;
    const img = document.getElementById('receiptImage');
    const noMsg = document.getElementById('noReceiptMsg');
    
    if (receiptUrl) {
        img.src = receiptUrl;
        img.style.display = 'block';
        noMsg.style.display = 'none';
    } else {
        img.style.display = 'none';
        noMsg.style.display = 'block';
    }
    
    // Setup modal action buttons
    document.getElementById('modalVerifyBtn').onclick = () => {
        updatePaymentStatus(orderId, 'verified');
        closeModal('receiptModal');
    };
    document.getElementById('modalRejectBtn').onclick = () => {
        updatePaymentStatus(orderId, 'rejected');
        closeModal('receiptModal');
    };

    openModal('receiptModal');
}

async function updatePaymentStatus(orderId, newStatus) {
    if (!confirm(`Are you sure you want to mark this payment as ${newStatus}?`)) return;
    
    try {
        await adminFetch(`/api/admin/payments/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        // Refresh data
        await loadPaymentStats();
        await loadPayments();
    } catch (error) {
        alert('Failed to update payment status: ' + error.message);
    }
}

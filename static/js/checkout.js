let orderNumber = null;

document.addEventListener('DOMContentLoaded', () => {
    loadCartSummary();
    
    document.getElementById('checkoutForm')?.addEventListener('submit', handleCheckout);
    document.getElementById('receiptForm')?.addEventListener('submit', handleReceiptUpload);
});

async function loadCartSummary() {
    const cart = await CartManager.getCart();
    const container = document.getElementById('cartSummary');
    
    if (!container) return;
    
    let subtotal = 0;
    container.innerHTML = cart.items.map(item => {
        const total = item.product.price * item.quantity;
        subtotal += total;
        return `
            <div class="summary-row">
                <span>${item.product.name} × ${item.quantity}</span>
                <span>₦${total.toLocaleString()}</span>
            </div>
        `;
    }).join('');
    
    const shipping = 2500; // Default
    const total = subtotal + shipping;
    
    container.innerHTML += `
        <div class="summary-row">
            <span>Subtotal</span>
            <span>₦${subtotal.toLocaleString()}</span>
        </div>
        <div class="summary-row">
            <span>Shipping</span>
            <span>₦${shipping.toLocaleString()}</span>
        </div>
        <div class="summary-row total">
            <span>Total</span>
            <span>₦${total.toLocaleString()}</span>
        </div>
    `;
}

async function handleCheckout(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Processing...';
        
        const response = await apiRequest('/api/orders/', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        orderNumber = response.order_number;
        
        // Show bank details
        document.getElementById('checkoutForm').style.display = 'none';
        document.getElementById('paymentSection').style.display = 'block';
        document.getElementById('orderNumber').textContent = orderNumber;
        document.getElementById('orderTotal').textContent = `₦${response.total_amount.toLocaleString()}`;
        
        showToast('Order placed successfully!');
    } catch (error) {
        showToast(error.message, 'error');
        e.target.querySelector('button[type="submit"]').disabled = false;
        e.target.querySelector('button[type="submit"]').textContent = 'Place Order';
    }
}

async function handleReceiptUpload(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('receiptFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Please select a file', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Uploading...';
        
        await apiRequest(`/api/orders/${orderNumber}/upload-receipt`, {
            method: 'POST',
            body: formData
        });
        
        showToast('Receipt uploaded successfully!');
        
        setTimeout(() => {
            window.location.href = '/shop-home';
        }, 2000);
    } catch (error) {
        showToast(error.message, 'error');
        e.target.querySelector('button[type="submit"]').disabled = false;
        e.target.querySelector('button[type="submit"]').textContent = 'Upload Receipt';
    }
}

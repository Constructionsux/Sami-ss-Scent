/* ============================================
   SAMI'S SCENT - CHECKOUT PAGE LOGIC
   ============================================ */

let currentCart = null;
let currentOrderNumber = null;
let shippingFee = 0;

document.addEventListener('DOMContentLoaded', async () => {
    await loadCheckoutSummary();
});

// --- 1. Load Cart & Calculate Totals ---
async function loadCheckoutSummary() {
    try {
        currentCart = await CartManager.getCart();
        const itemsContainer = document.getElementById('summaryItems');
        let subtotal = 0;

        if (!currentCart.items || currentCart.items.length === 0) {
            window.location.href = '/cart';
            return;
        }

        itemsContainer.innerHTML = currentCart.items.map(item => {
            const lineTotal = parseFloat(item.product.price) * item.quantity;
            subtotal += lineTotal;
            return `
                <div class="summary-item">
                    <img src="${item.product.image_url || '/static/images/placeholder.jpg'}" alt="${item.product.name}">
                    <div class="summary-item-details">
                        <h4>${item.product.name}</h4>
                        <p>Qty: ${item.quantity} x ₦${parseFloat(item.product.price).toLocaleString()}</p>
                    </div>
                    <div style="font-weight: 600; font-size: 0.95rem;">
                        ₦${lineTotal.toLocaleString()}
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('summarySubtotal').textContent = formatCurrency(subtotal);
        updateTotal(subtotal);
    } catch (error) {
        console.error('Failed to load cart:', error);
        if (typeof showToast === 'function') showToast('Failed to load cart', 'error');
    }
}

// --- 2. Delivery Method Toggle ---
function toggleDeliveryMethod() {
    const method = document.querySelector('input[name="deliveryMethod"]:checked').value;
    document.getElementById('doorstepFields').style.display = method === 'doorstep' ? 'block' : 'none';
    document.getElementById('parkFields').style.display = method === 'park' ? 'block' : 'none';
    calculateShipping();
}

// --- 3. Load Parks from Backend ---
async function loadParks() {
    const state = document.getElementById('parkState').value;
    const parkSelect = document.getElementById('parkSelect');
    const loadingText = document.getElementById('parkLoading');

    if (!state) {
        parkSelect.innerHTML = '<option value="">Select a park to see price</option>';
        return;
    }

    loadingText.style.display = 'block';
    parkSelect.disabled = true;

    try {
        const parks = await apiRequest(`/api/orders/parks?state=${encodeURIComponent(state)}`);
        parkSelect.innerHTML = '<option value="">Select a park</option>';
        
        parks.forEach(park => {
            parkSelect.innerHTML += `
                <option value="${park.park_name}" data-fee="${park.fee}">
                    ${park.city} - ${park.park_name} (₦${parseFloat(park.fee).toLocaleString()})
                </option>
            `;
        });
    } catch (error) {
        console.error('Failed to load parks:', error);
        parkSelect.innerHTML = '<option value="">Error loading parks</option>';
    } finally {
        loadingText.style.display = 'none';
        parkSelect.disabled = false;
    }
}

// --- 4. Calculate Shipping & Total ---
function calculateShipping() {
    const method = document.querySelector('input[name="deliveryMethod"]:checked').value;
    const subtotal = parseFloat(document.getElementById('summarySubtotal').textContent.replace(/[^0-9.-]+/g,""));

    if (method === 'doorstep') {
        // Simple state-based shipping for doorstep
        const state = document.getElementById('doorstepState').value;
        const shippingRates = {
            'Lagos': 2500, 'Abuja': 3500, 'Rivers': 3000, 'Oyo': 2800,
            'Delta': 3000, 'Edo': 2800, 'Anambra': 3000, 'Enugu': 3200,
            'Imo': 3200, 'Kano': 4000
        };
        shippingFee = state ? (shippingRates[state] || 3500) : 0;
    } else {
        // Park-based shipping
        const parkSelect = document.getElementById('parkSelect');
        const selectedOption = parkSelect.options[parkSelect.selectedIndex];
        shippingFee = selectedOption && selectedOption.dataset.fee ? parseFloat(selectedOption.dataset.fee) : 0;
    }

    document.getElementById('summaryShipping').textContent = formatCurrency(shippingFee);
    updateTotal(subtotal);
}

function updateTotal(subtotal) {
    document.getElementById('summaryTotal').textContent = formatCurrency(subtotal + shippingFee);
}

// --- 5. Step 1 -> Step 2 Transition ---
async function goToStep2() {
    const name = document.getElementById('custName').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const method = document.querySelector('input[name="deliveryMethod"]:checked').value;

    if (!name || !email || !phone) {
        if (typeof showToast === 'function') showToast('Please fill in all contact details', 'error');
        return;
    }

    let address = '', city = '', state = '';
    if (method === 'doorstep') {
        state = document.getElementById('doorstepState').value;
        city = document.getElementById('doorstepCity').value;
        address = document.getElementById('doorstepAddress').value;
        if (!state || !address) {
            if (typeof showToast === 'function') showToast('Please complete your delivery address', 'error');
            return;
        }
    } else {
        state = document.getElementById('parkState').value;
        const parkSelect = document.getElementById('parkSelect');
        address = parkSelect.value;
        if (!state || !address) {
            if (typeof showToast === 'function') showToast('Please select a park for delivery', 'error');
            return;
        }
    }

    if (shippingFee === 0) {
        if (typeof showToast === 'function') showToast('Unable to calculate shipping fee', 'error');
        return;
    }

    // Show loading on button
    const btn = document.querySelector('#step1 .btn-primary');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const payload = {
            customer_name: name,
            customer_email: email,
            customer_phone: phone,
            delivery_method: method,
            delivery_address: address,
            city: city,
            state: state,
            shipping_fee: shippingFee,
            guest_token: localStorage.getItem('guest_token')
        };

        const response = await apiRequest('/api/orders/', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        currentOrderNumber = response.order_number;
        
        // Populate Bank Details
        document.getElementById('bankName').textContent = response.bank_details.bank_name;
        document.getElementById('accountName').textContent = response.bank_details.account_name;
        document.getElementById('accountNumber').innerHTML = `${response.bank_details.account_number} <i class="far fa-copy"></i>`;
        document.getElementById('payAmount').textContent = formatCurrency(response.total_amount);

        // Switch Steps
        document.getElementById('step1').style.display = 'none';
        document.getElementById('step2').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// --- 6. Handle Receipt Upload ---
document.getElementById('receiptForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('receiptFile');
    const file = fileInput.files[0];

    if (!file) {
        if (typeof showToast === 'function') showToast('Please select a receipt file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const btn = document.getElementById('submitReceiptBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    try {
        await apiRequest(`/api/orders/${currentOrderNumber}/upload-receipt`, {
            method: 'POST',
            body: formData
        });

        // Show success step
        document.getElementById('successEmail').textContent = document.getElementById('custEmail').value;
        document.getElementById('step2').style.display = 'none';
        document.getElementById('step3').style.display = 'block';
        
        // Clear cart locally
        localStorage.removeItem('cart_items'); // If you use local cart fallback
        if (typeof CartManager !== 'undefined') CartManager.updateCartCount();

    } catch (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Submit Receipt & Complete Order';
    }
});

// --- Utilities ---
function updateFileName(input) {
    const display = document.getElementById('fileNameDisplay');
    display.textContent = input.files.length > 0 ? input.files[0].name : 'No file chosen';
}

function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).textContent.replace('Loading...', '').trim();
    navigator.clipboard.writeText(text).then(() => {
        if (typeof showToast === 'function') showToast('Account number copied!', 'success');
    });
}

function formatCurrency(amount) {
    return '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ============================================
   SAMI'S SCENT - CART PAGE LOGIC
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    loadCartPage();
    
    const clearBtn = document.getElementById('clearCartBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear your entire cart?')) {
                try {
                    await apiRequest('/api/cart/', { method: 'DELETE' });
                    if (typeof showToast === 'function') showToast('Cart cleared', 'success');
                    loadCartPage(); // Reload to show empty state
                } catch (error) {
                    if (typeof showToast === 'function') showToast(error.message, 'error');
                }
            }
        });
    }
});

async function loadCartPage() {
    const loadingEl = document.getElementById('cartLoading');
    const emptyEl = document.getElementById('cartEmpty');
    const contentEl = document.getElementById('cartContent');
    const itemsListEl = document.getElementById('cartItemsList');

    // Show loading, hide others
    loadingEl.style.display = 'block';
    emptyEl.style.display = 'none';
    contentEl.style.display = 'none';

    try {
        const cart = await CartManager.getCart();
        loadingEl.style.display = 'none';

        if (!cart.items || cart.items.length === 0) {
            emptyEl.style.display = 'block';
            contentEl.style.display = 'none';
            return;
        }

        // Render Items
        contentEl.style.display = 'grid'; // or 'block' depending on CSS, grid is set in CSS
        itemsListEl.innerHTML = cart.items.map(item => renderCartItem(item)).join('');

        // Calculate Totals
        const subtotal = cart.items.reduce((sum, item) => {
            return sum + (parseFloat(item.product.price) * item.quantity);
        }, 0);

        document.getElementById('summarySubtotal').textContent = formatCurrency(subtotal);
        document.getElementById('summaryTotal').textContent = formatCurrency(subtotal);

        // Attach Event Listeners to new buttons
        attachCartEvents();

    } catch (error) {
        console.error('Failed to load cart page:', error);
        loadingEl.innerHTML = `<p style="color: var(--color-error);">Failed to load cart. Please refresh.</p>`;
    }
}

function renderCartItem(item) {
    const product = item.product;
    const lineTotal = parseFloat(product.price) * item.quantity;
    
    return `
        <div class="cart-item" data-item-id="${item.id}">
            <div class="cart-item-product">
                <img src="${product.image_url || '/static/images/placeholder.jpg'}" alt="${product.name}" class="cart-item-img">
                <div class="cart-item-details">
                    <h4>${product.name}</h4>
                    <span class="brand">${product.brand || 'Sami\'s Scent'}</span>
                </div>
            </div>
            
            <div class="cart-item-price">
                ${formatCurrency(parseFloat(product.price))}
            </div>
            
            <div class="quantity-control">
                <button class="qty-btn minus-btn" data-id="${item.id}" data-qty="${item.quantity - 1}" ${item.quantity <= 1 ? 'disabled' : ''}>
                    <i class="fas fa-minus"></i>
                </button>
                <span class="qty-value">${item.quantity}</span>
                <button class="qty-btn plus-btn" data-id="${item.id}" data-qty="${item.quantity + 1}">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            
            <div class="cart-item-total">
                ${formatCurrency(lineTotal)}
            </div>
            
            <button class="remove-btn" data-id="${item.id}" title="Remove item">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;
}

function attachCartEvents() {
    // Plus buttons
    document.querySelectorAll('.plus-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.dataset.id;
            const qty = parseInt(btn.dataset.qty);
            await updateItemQty(id, qty);
        });
    });

    // Minus buttons
    document.querySelectorAll('.minus-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.dataset.id;
            const qty = parseInt(btn.dataset.qty);
            if (qty >= 1) {
                await updateItemQty(id, qty);
            }
        });
    });

    // Remove buttons
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.dataset.id;
            await removeCartItem(id);
        });
    });
}

async function updateItemQty(itemId, newQty) {
    try {
        await CartManager.updateQuantity(itemId, newQty);
        loadCartPage(); // Reload to reflect changes and update totals
    } catch (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
    }
}

async function removeCartItem(itemId) {
    try {
        await CartManager.removeItem(itemId);
        loadCartPage(); // Reload to remove from UI and update totals
    } catch (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
    }
}

function formatCurrency(amount) {
    return '' + amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

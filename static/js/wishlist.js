/* ============================================
   SAMI'S SCENT - WISHLIST PAGE LOGIC
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
    // Shared UI components are initialized by shop.js
    // We just need to load the wishlist data
    await loadWishlist();
    
    // Ensure cart count is updated
    if (typeof CartManager !== 'undefined') {
        CartManager.updateCartCount();
    }
});

async function loadWishlist() {
    const loadingEl = document.getElementById('wishlistLoading');
    const emptyEl = document.getElementById('wishlistEmpty');
    const gridEl = document.getElementById('wishlistGrid');

    try {
        const response = await apiRequest('/api/wishlist/');
        loadingEl.style.display = 'none';

        if (!response.items || response.items.length === 0) {
            emptyEl.style.display = 'block';
            gridEl.style.display = 'none';
            return;
        }

        gridEl.style.display = 'grid';
        gridEl.innerHTML = response.items.map(item => renderWishlistItem(item)).join('');

    } catch (error) {
        console.error('Failed to load wishlist:', error);
        loadingEl.innerHTML = `
            <p style="color: var(--color-error, #9b2226);">
                <i class="fas fa-exclamation-circle"></i> Failed to load wishlist. 
                <br>Please ensure you are logged in.
            </p>
            <a href="/login" class="btn btn-primary" style="margin-top: 1rem;">Log In</a>
        `;
    }
}

function renderWishlistItem(item) {
    const product = item.product;
    if (!product) return '';

    const isOutOfStock = product.stock_quantity <= 0;

    return `
        <div class="wishlist-item" data-product-id="${product.id}">
            <button class="remove-wishlist-btn" onclick="removeFromWishlist('${product.id}')" title="Remove from wishlist">
                <i class="fas fa-times"></i>
            </button>
            
            <a href="/product/${product.id}" class="product-image">
                <img src="${product.image_url || '/static/images/placeholder.jpg'}" alt="${product.name}" loading="lazy">
            </a>
            
            <div class="product-info">
                <div class="product-brand">${product.brand || 'Sami\'s Scent'}</div>
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">₦${parseFloat(product.price).toLocaleString()}</div>
                
                <button class="add-to-cart-btn" 
                        onclick="CartManager.addToCart('${product.id}')" 
                        ${isOutOfStock ? 'disabled' : ''}>
                    ${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                </button>
            </div>
        </div>
    `;
}

async function removeFromWishlist(productId) {
    if (!confirm('Remove this item from your wishlist?')) return;

    try {
        await apiRequest(`/api/wishlist/items/${productId}`, {
            method: 'DELETE'
        });
        
        if (typeof showToast === 'function') {
            showToast('Removed from wishlist', 'success');
        }
        
        // Reload the wishlist to reflect changes
        await loadWishlist();
    } catch (error) {
        console.error('Failed to remove from wishlist:', error);
        if (typeof showToast === 'function') {
            showToast(error.message || 'Failed to remove item', 'error');
        }
    }
}

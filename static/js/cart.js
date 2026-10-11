/* ============================================
   SAMI'S SCENT - CART MANAGEMENT
   ============================================ */

class CartManager {
    static async addToCart(productId, quantity = 1) {
        try {
            // FIX: Payload must exactly match Pydantic CartItemAdd schema
            const payload = {
                product_id: productId,
                quantity: quantity
            };
            
            await apiRequest('/api/cart/items', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            if (typeof showToast === 'function') {
                showToast('Added to cart successfully', 'success');
            }
            this.updateCartCount();
        } catch (error) {
            if (typeof showToast === 'function') {
                showToast(error.message || 'Failed to add to cart', 'error');
            } else {
                alert('Failed to add to cart: ' + error.message);
            }
        }
    }
    
    static async getCart() {
        try {
            return await apiRequest('/api/cart/');
        } catch (error) {
            console.error('Failed to load cart:', error);
            return { items: [] };
        }
    }
    
    static async updateQuantity(itemId, quantity) {
        try {
            await apiRequest(`/api/cart/items/${itemId}`, {
                method: 'PATCH',
                body: JSON.stringify({ quantity: quantity })
            });
            this.updateCartCount();
        } catch (error) {
            if (typeof showToast === 'function') {
                showToast(error.message, 'error');
            }
        }
    }
    
    static async removeItem(itemId) {
        try {
            await apiRequest(`/api/cart/items/${itemId}`, {
                method: 'DELETE'
            });
            if (typeof showToast === 'function') {
                showToast('Item removed from cart', 'success');
            }
            this.updateCartCount();
        } catch (error) {
            if (typeof showToast === 'function') {
                showToast(error.message, 'error');
            }
        }
    }
    
    static async updateCartCount() {
        try {
            const cart = await this.getCart();
            const count = cart.items ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
            
            // Update all cart badges on the page
            const badges = document.querySelectorAll('#cartCount, #desktopCartCount, #mobileCartCount, #floatingCartCount');
            badges.forEach(badge => {
                if (badge) badge.textContent = count;
            });
        } catch (error) {
            console.error('Failed to update cart count:', error);
        }
    }
}

// Initialize cart count on page load
document.addEventListener('DOMContentLoaded', () => {
    CartManager.updateCartCount();
});

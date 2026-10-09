class CartManager {
    static async addToCart(productId, quantity = 1) {
        try {
            await apiRequest('/api/cart/items', {
                method: 'POST',
                body: JSON.stringify({
                    product_id: productId,
                    quantity: quantity
                })
            });
            
            showToast('Added to cart');
            this.updateCartCount();
        } catch (error) {
            showToast(error.message, 'error');
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
                body: JSON.stringify({ quantity })
            });
            this.updateCartCount();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
    
    static async removeItem(itemId) {
        try {
            await apiRequest(`/api/cart/items/${itemId}`, {
                method: 'DELETE'
            });
            showToast('Item removed');
            this.updateCartCount();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
    
    static async updateCartCount() {
        try {
            const cart = await this.getCart();
            const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
            const badge = document.getElementById('cart-count');
            if (badge) {
                badge.textContent = count;
            }
        } catch (error) {
            console.error('Failed to update cart count:', error);
        }
    }
}

// Update cart count on page load
document.addEventListener('DOMContentLoaded', () => {
    CartManager.updateCartCount();
});

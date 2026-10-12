/* ============================================
   SAMI'S SCENT - PRODUCT DETAIL PAGE LOGIC
   ============================================ */

let currentProduct = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Extract product ID from URL path (e.g., /product/123e4567-e89b-12d3-a456-426614174000)
    const pathParts = window.location.pathname.split('/');
    const productId = pathParts[pathParts.length - 1];

    if (productId) {
        await loadProductDetails(productId);
        await loadRecommendedProducts(productId);
    }

    // Initialize shared components
    initMobileMenu();
    initPopups();
    initSearch();
    initAccount();
    if (typeof CartManager !== 'undefined') {
        CartManager.updateCartCount();
    }
});

async function loadProductDetails(productId) {
    try {
        const product = await apiRequest(`/api/products/${productId}`);
        currentProduct = product;
        
        // Update Page Title & Breadcrumb
        document.title = `${product.name} | Sami's Scent`;
        document.getElementById('breadcrumbProduct').textContent = product.name;
        
        // Populate Details
        document.getElementById('productImage').src = product.image_url || '/static/images/placeholder.jpg';
        document.getElementById('productImage').alt = product.name;
        document.getElementById('productBrand').textContent = product.brand?.name || 'Sami\'s Scent';
        document.getElementById('productName').textContent = product.name;
        document.getElementById('productPrice').textContent = `₦${parseFloat(product.price).toLocaleString()}`;
        document.getElementById('productDescription').textContent = product.description || 'No description available.';
        
        if (product.compare_at_price) {
            const oldPriceEl = document.getElementById('productOldPrice');
            oldPriceEl.textContent = `₦${parseFloat(product.compare_at_price).toLocaleString()}`;
            oldPriceEl.style.display = 'inline';
        }

        const stockEl = document.getElementById('productStock');
        const addToCartBtn = document.getElementById('addToCartBtn');
        
        if (product.stock_quantity > 0) {
            stockEl.innerHTML = `<i class="fas fa-check-circle"></i> In Stock (${product.stock_quantity} available)`;
            stockEl.classList.remove('out-of-stock');
            addToCartBtn.disabled = false;
        } else {
            stockEl.innerHTML = `<i class="fas fa-times-circle"></i> Out of Stock`;
            stockEl.classList.add('out-of-stock');
            addToCartBtn.disabled = true;
            addToCartBtn.innerHTML = 'Out of Stock';
        }

        // Show content, hide loading
        document.getElementById('productLoading').style.display = 'none';
        document.getElementById('productContent').style.display = 'grid';

    } catch (error) {
        console.error('Failed to load product:', error);
        document.getElementById('productLoading').innerHTML = `
            <p style="color: var(--color-error);">Failed to load product details. Please try again later.</p>
            <a href="/shop" class="btn btn-primary" style="margin-top: 1rem;">Return to Shop</a>
        `;
    }
}

async function loadRecommendedProducts(currentProductId) {
    try {
        const products = await apiRequest('/api/products/?limit=4');
        const grid = document.getElementById('recommendedGrid');
        
        const filtered = products.filter(p => p.id !== currentProductId).slice(0, 4);
        
        if (filtered.length > 0) {
            document.getElementById('recommendedSection').style.display = 'block';
            grid.innerHTML = filtered.map(p => `
                <div class="product-card">
                    <a href="/product/${p.id}" class="product-image">
                        <img src="${p.image_url || '/static/images/placeholder.jpg'}" alt="${p.name}" loading="lazy">
                    </a>
                    <div class="product-info">
                        <div class="product-brand">${p.brand?.name || 'Sami\'s Scent'}</div>
                        <h3 class="product-name">${p.name}</h3>
                        <div class="product-price">₦${parseFloat(p.price).toLocaleString()}</div>
                        <button class="add-to-cart-btn" onclick="CartManager.addToCart('${p.id}')">Add to Cart</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load recommended products:', error);
    }
}

function updateDetailQty(change) {
    const input = document.getElementById('detailQty');
    let newVal = parseInt(input.value) + change;
    
    if (newVal < 1) newVal = 1;
    if (currentProduct && newVal > currentProduct.stock_quantity) {
        newVal = currentProduct.stock_quantity;
        if (typeof showToast === 'function') showToast('Maximum available stock reached', 'error');
    }
    
    input.value = newVal;
}

async function addDetailToCart() {
    if (!currentProduct) return;
    const qty = parseInt(document.getElementById('detailQty').value);
    await CartManager.addToCart(currentProduct.id, qty);
}

// --- Shared UI Functions ---
function initMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('closeMenuBtn');
    const drawer = document.getElementById('mobileMenuDrawer');
    if (menuBtn && drawer) {
        menuBtn.addEventListener('click', () => drawer.classList.add('active'));
        closeBtn.addEventListener('click', () => drawer.classList.remove('active'));
        document.addEventListener('click', (e) => {
            if (!drawer.contains(e.target) && !menuBtn.contains(e.target)) drawer.classList.remove('active');
        });
    }
}

function initPopups() {
    const searchOverlay = document.getElementById('searchOverlay');
    const accountOverlay = document.getElementById('accountOverlay');
    if (document.getElementById('closeSearchBtn')) document.getElementById('closeSearchBtn').addEventListener('click', () => searchOverlay.classList.remove('active'));
    if (document.getElementById('closeAccountBtn')) document.getElementById('closeAccountBtn').addEventListener('click', () => accountOverlay.classList.remove('active'));
    if (searchOverlay) searchOverlay.addEventListener('click', (e) => { if (e.target === searchOverlay) searchOverlay.classList.remove('active'); });
    if (accountOverlay) accountOverlay.addEventListener('click', (e) => { if (e.target === accountOverlay) accountOverlay.classList.remove('active'); });
}

function initSearch() {
    const mobileSearchIcon = document.getElementById('mobileSearchIcon');
    const desktopSearchBtn = document.getElementById('desktopSearchBtn');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout;

    const openSearch = () => { if (searchOverlay) { searchOverlay.classList.add('active'); setTimeout(() => searchInput && searchInput.focus(), 100); } };
    if (mobileSearchIcon) mobileSearchIcon.addEventListener('click', openSearch);
    if (desktopSearchBtn) desktopSearchBtn.addEventListener('click', openSearch);

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            if (query.length < 2) { searchResults.innerHTML = ''; return; }
            searchTimeout = setTimeout(async () => {
                try {
                    const products = await apiRequest(`/api/products/?search=${encodeURIComponent(query)}&limit=5`);
                    searchResults.innerHTML = products.length === 0 
                        ? '<p style="padding: 1rem; text-align: center; color: var(--color-text-muted);">No products found</p>'
                        : products.map(p => `
                            <div class="search-result-item" onclick="window.location.href='/product/${p.id}'">
                                <img src="${p.image_url || '/static/images/placeholder.jpg'}" alt="${p.name}">
                                <div>
                                    <div style="font-weight: 600; color: var(--color-text-primary);">${p.name}</div>
                                    <div style="color: var(--color-accent); font-size: 0.9rem;">₦${parseFloat(p.price).toLocaleString()}</div>
                                </div>
                            </div>
                        `).join('');
                } catch (error) { console.error('Search error:', error); }
            }, 300);
        });
    }
}

function initAccount() {
    const mobileAccountIcon = document.getElementById('mobileAccountIcon');
    const desktopAccountIcon = document.getElementById('desktopAccountIcon');
    const accountOverlay = document.getElementById('accountOverlay');
    const accountContent = document.getElementById('accountContent');

    const openAccount = async () => {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                const user = await apiRequest('/api/auth/me');
                accountContent.innerHTML = `
                    <div style="padding: 1rem; border-bottom: 1px solid var(--color-border); margin-bottom: 0.5rem;">
                        <div style="font-weight: 600; font-size: 1.1rem;">${user.full_name}</div>
                        <div style="color: var(--color-text-muted); font-size: 0.9rem;">${user.email}</div>
                    </div>
                    <a href="/account" class="account-option">My Account</a>
                    <a href="/orders" class="account-option">My Orders</a>
                    <a href="/wishlist" class="account-option">My Wishlist</a>
                    <a href="#" class="account-option" style="color: var(--color-error);" onclick="logout(); return false;">Logout</a>
                `;
            } catch (error) { showLoginOptions(accountContent); }
        } else { showLoginOptions(accountContent); }
        accountOverlay.classList.add('active');
    };

    if (mobileAccountIcon) mobileAccountIcon.addEventListener('click', openAccount);
    if (desktopAccountIcon) desktopAccountIcon.addEventListener('click', openAccount);
}

function showLoginOptions(container) {
    container.innerHTML = `
        <p style="padding: 0 1rem 1rem; color: var(--color-text-secondary);">Please log in to access your account details.</p>
        <a href="/login" class="account-option" style="text-align: center; background: var(--color-accent); color: white; border-radius: 4px; margin: 0 1rem 0.5rem;">Login</a>
        <a href="/login?tab=register" class="account-option" style="text-align: center; border: 1px solid var(--color-border); margin: 0 1rem;">Create Account</a>
    `;
}

function logout() {
    localStorage.removeItem('access_token');
    document.getElementById('accountOverlay').classList.remove('active');
    window.location.reload();
}

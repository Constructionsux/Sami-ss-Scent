// Shop page functionality
async function loadProducts() {
    const brandSlug = document.getElementById('brandFilter')?.value || '';
    const categorySlug = document.getElementById('categoryFilter')?.value || '';
    const sort = document.getElementById('sortFilter')?.value || 'newest';
    
    const params = new URLSearchParams();
    if (brandSlug) params.append('brand_slug', brandSlug);
    if (categorySlug) params.append('category_slug', categorySlug);
    params.append('sort', sort);
    
    try {
        const products = await apiRequest(`/api/products/?${params}`);
        renderProducts(products);
    } catch (error) {
        showToast('Failed to load products', 'error');
    }
}

function renderProducts(products) {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    
    if (products.length === 0) {
        grid.innerHTML = '<p style="text-align: center; padding: 3rem;">No products found.</p>';
        return;
    }
    
    grid.innerHTML = products.map(product => `
        <div class="product-card">
            <a href="/product/${product.id}" class="product-image">
                <img src="${product.image_url || '/static/images/placeholder.jpg'}" alt="${product.name}">
            </a>
            <div class="product-info">
                <div class="product-brand">${product.brand?.name || 'Sami\'s Scent'}</div>
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">
                    <span class="current-price">₦${parseFloat(product.price).toLocaleString()}</span>
                    ${product.compare_at_price ? `<span class="old-price">₦${parseFloat(product.compare_at_price).toLocaleString()}</span>` : ''}
                </div>
                <button class="add-to-cart-btn" onclick="CartManager.addToCart('${product.id}')">
                    Add to Cart
                </button>
            </div>
        </div>
    `).join('');
}

async function loadBrands() {
    try {
        const brands = await apiRequest('/api/products/brands/list');
        const select = document.getElementById('brandFilter');
        if (select) {
            select.innerHTML = '<option value="">All Brands</option>' +
                brands.map(b => `<option value="${b.slug}">${b.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Failed to load brands:', error);
    }
}

async function loadCategories() {
    try {
        const categories = await apiRequest('/api/products/categories/list');
        const select = document.getElementById('categoryFilter');
        if (select) {
            select.innerHTML = '<option value="">All Categories</option>' +
                categories.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadBrands();
    loadCategories();
    loadProducts();
    
    // Filter change handlers
    document.getElementById('brandFilter')?.addEventListener('change', loadProducts);
    document.getElementById('categoryFilter')?.addEventListener('change', loadProducts);
    document.getElementById('sortFilter')?.addEventListener('change', loadProducts);
});

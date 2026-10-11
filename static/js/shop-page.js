/* ============================================
   SAMI'S SCENT - SHOP PAGE LOGIC
   ============================================ */

let currentPage = 1;
const itemsPerPage = 12;
let allProducts = [];
let filteredProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadShopData();
    initFilterSidebar();
    initSearch();
    initAccount();
    
    // Event listeners
    document.getElementById('sortDropdown').addEventListener('change', handleSortChange);
    document.getElementById('categoryDropdown').addEventListener('change', handleCategoryChange);
});

async function loadShopData() {
    try {
        // Load all products
        const response = await apiRequest('/api/products/?limit=100');
        allProducts = response;
        filteredProducts = [...allProducts];
        
        // Load brands and categories for filters
        await loadFilterOptions();
        
        // Render products
        renderProducts();
        renderPagination();
        
    } catch (error) {
        console.error('Failed to load shop data:', error);
        document.getElementById('productGrid').innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <p style="color: var(--color-error);">Failed to load products. Please refresh.</p>
            </div>
        `;
    }
}

async function loadFilterOptions() {
    try {
        const brands = await apiRequest('/api/products/brands/list');
        const categories = await apiRequest('/api/products/categories/list');
        
        // Populate filter brand select
        const filterBrand = document.getElementById('filterBrand');
        filterBrand.innerHTML = '<option value="">All Brands</option>' +
            brands.map(b => `<option value="${b.slug}">${b.name}</option>`).join('');
        
        // Populate filter category select
        const filterCategory = document.getElementById('filterCategory');
        filterCategory.innerHTML = '<option value="">All Categories</option>' +
            categories.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
        
        // Populate category dropdown
        const categoryDropdown = document.getElementById('categoryDropdown');
        categoryDropdown.innerHTML = '<option value="">View all</option>' +
            categories.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
            
    } catch (error) {
        console.error('Failed to load filter options:', error);
    }
}

function renderProducts() {
    const grid = document.getElementById('productGrid');
    
    if (filteredProducts.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <i class="fas fa-search" style="font-size: 3rem; color: var(--color-border); margin-bottom: 1rem;"></i>
                <p>No products found matching your criteria.</p>
            </div>
        `;
        return;
    }
    
    // Calculate pagination
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageProducts = filteredProducts.slice(start, end);
    
    grid.innerHTML = pageProducts.map(p => `
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

function renderPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    html += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i>
    </button>`;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button onclick="changePage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span style="padding: 0.6rem;">...</span>`;
        }
    }
    
    // Next button
    html += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
        <i class="fas fa-chevron-right"></i>
    </button>`;
    
    pagination.innerHTML = html;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderProducts();
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleSortChange(e) {
    const sort = e.target.value;
    
    switch(sort) {
        case 'price_asc':
            filteredProducts.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
            break;
        case 'price_desc':
            filteredProducts.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
            break;
        case 'bestselling':
            filteredProducts.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
            break;
        case 'newest':
        default:
            filteredProducts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
    }
    
    currentPage = 1;
    renderProducts();
    renderPagination();
}

function handleCategoryChange(e) {
    const categorySlug = e.target.value;
    applyFilters();
}

function initFilterSidebar() {
    const overlay = document.getElementById('filterOverlay');
    const showBtn = document.getElementById('showFiltersBtn');
    const closeBtn = document.getElementById('closeFilterBtn');
    
    showBtn.addEventListener('click', () => {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    
    const closeFilter = () => {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    };
    
    closeBtn.addEventListener('click', closeFilter);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeFilter();
    });
}

function applyFilters() {
    const minPrice = parseFloat(document.getElementById('minPrice').value) || 0;
    const maxPrice = parseFloat(document.getElementById('maxPrice').value) || Infinity;
    const inStock = document.getElementById('inStock').checked;
    const onSale = document.getElementById('onSale').checked;
    const brandSlug = document.getElementById('filterBrand').value;
    const categorySlug = document.getElementById('filterCategory').value;
    
    filteredProducts = allProducts.filter(p => {
        const price = parseFloat(p.price);
        const matchesPrice = price >= minPrice && price <= maxPrice;
        const matchesStock = !inStock || p.stock_quantity > 0;
        const matchesSale = !onSale || p.compare_at_price;
        const matchesBrand = !brandSlug || (p.brand && p.brand.slug === brandSlug);
        const matchesCategory = !categorySlug || (p.categories && p.categories.some(c => c.slug === categorySlug));
        
        return matchesPrice && matchesStock && matchesSale && matchesBrand && matchesCategory;
    });
    
    currentPage = 1;
    renderProducts();
    renderPagination();
    
    // Close filter sidebar
    document.getElementById('filterOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function resetFilters() {
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.getElementById('inStock').checked = true;
    document.getElementById('onSale').checked = false;
    document.getElementById('filterBrand').value = '';
    document.getElementById('filterCategory').value = '';
    
    filteredProducts = [...allProducts];
    currentPage = 1;
    renderProducts();
    renderPagination();
}

function initSearch() {
    const mobileSearchIcon = document.getElementById('mobileSearchIcon');
    const desktopSearchBtn = document.getElementById('desktopSearchBtn');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout;

    const openSearch = () => {
        if (searchOverlay) {
            searchOverlay.classList.add('active');
            setTimeout(() => searchInput && searchInput.focus(), 100);
        }
    };

    const closeSearch = () => {
        if (searchOverlay) searchOverlay.classList.remove('active');
        if (searchInput) searchInput.value = '';
        if (searchResults) searchResults.innerHTML = '';
    };

    if (mobileSearchIcon) mobileSearchIcon.addEventListener('click', openSearch);
    if (desktopSearchBtn) desktopSearchBtn.addEventListener('click', openSearch);

    if (searchOverlay) {
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) closeSearch();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                searchResults.innerHTML = '';
                return;
            }

            searchTimeout = setTimeout(async () => {
                try {
                    const products = await apiRequest(`/api/products/?search=${encodeURIComponent(query)}&limit=5`);
                    
                    if (products.length === 0) {
                        searchResults.innerHTML = '<p style="padding: 1rem; text-align: center; color: var(--color-text-muted);">No products found</p>';
                    } else {
                        searchResults.innerHTML = products.map(p => `
                            <div class="search-result-item" onclick="window.location.href='/product/${p.id}'">
                                <img src="${p.image_url || '/static/images/placeholder.jpg'}" alt="${p.name}">
                                <div>
                                    <div style="font-weight: 600; color: var(--color-text-primary);">${p.name}</div>
                                    <div style="color: var(--color-accent); font-size: 0.9rem;">₦${parseFloat(p.price).toLocaleString()}</div>
                                </div>
                            </div>
                        `).join('');
                    }
                } catch (error) {
                    console.error('Search error:', error);
                }
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
            } catch (error) {
                showLoginOptions(accountContent);
            }
        } else {
            showLoginOptions(accountContent);
        }
        
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

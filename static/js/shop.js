console.log("✅ SAFE VERSION OF shop.js LOADED");

document.addEventListener('DOMContentLoaded', () => {
    // 1. Safely run homepage-specific loaders ONLY if the elements exist
    if (document.getElementById('carouselSlides')) loadCarousel();
    if (document.getElementById('brandsVertical')) loadBrandsVertical();
    if (document.getElementById('categoriesScroll')) loadCategoriesHorizontal();
    if (document.getElementById('newArrivalsScroll')) loadHorizontalProducts('/api/products/new-arrivals', 'newArrivalsScroll');
    if (document.getElementById('bestsellersScroll')) loadHorizontalProducts('/api/products/bestsellers', 'bestsellersScroll');
    if (document.getElementById('recommendedScroll')) loadHorizontalProducts('/api/products/?limit=8', 'recommendedScroll');
    if (document.getElementById('featuredProduct')) loadFeaturedProduct();
    
    // 2. Initialize shared UI components
    initMobileMenu();
    initPopups();
    initSearch();
    initAccount();
    initNewsletter();
    
    // 3. Update cart count
    if (typeof CartManager !== 'undefined') {
        CartManager.updateCartCount();
    }
});

/* --- Shared UI: Mobile Menu --- */
function initMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('closeMenuBtn');
    const drawer = document.getElementById('mobileMenuDrawer');
    if (menuBtn && drawer) {
        menuBtn.addEventListener('click', () => drawer.classList.add('active'));
        if (closeBtn) closeBtn.addEventListener('click', () => drawer.classList.remove('active'));
        document.addEventListener('click', (e) => {
            if (!drawer.contains(e.target) && !menuBtn.contains(e.target)) drawer.classList.remove('active');
        });
    }
}

/* --- Shared UI: Popups --- */
function initPopups() {
    const searchOverlay = document.getElementById('searchOverlay');
    const accountOverlay = document.getElementById('accountOverlay');
    const closeSearch = document.getElementById('closeSearchBtn');
    const closeAccount = document.getElementById('closeAccountBtn');

    if (closeSearch && searchOverlay) closeSearch.addEventListener('click', () => searchOverlay.classList.remove('active'));
    if (closeAccount && accountOverlay) closeAccount.addEventListener('click', () => accountOverlay.classList.remove('active'));

    if (searchOverlay) searchOverlay.addEventListener('click', (e) => { if (e.target === searchOverlay) searchOverlay.classList.remove('active'); });
    if (accountOverlay) accountOverlay.addEventListener('click', (e) => { if (e.target === accountOverlay) accountOverlay.classList.remove('active'); });
}

/* --- Shared UI: Search --- */
function initSearch() {
    const mobileSearchIcon = document.getElementById('mobileSearchIcon');
    const desktopSearchBtn = document.getElementById('desktopSearchBtn');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    
    if (!searchOverlay || !searchInput) return; // EXIT SAFELY if not on this page

    let searchTimeout;
    const openSearch = () => { searchOverlay.classList.add('active'); setTimeout(() => searchInput.focus(), 100); };

    if (mobileSearchIcon) mobileSearchIcon.addEventListener('click', openSearch);
    if (desktopSearchBtn) desktopSearchBtn.addEventListener('click', openSearch);

    searchOverlay.addEventListener('click', (e) => {
        if (e.target === searchOverlay) { searchOverlay.classList.remove('active'); searchInput.value = ''; if(searchResults) searchResults.innerHTML = ''; }
    });

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length < 2) { if(searchResults) searchResults.innerHTML = ''; return; }

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
            } catch (error) { console.error('Search error:', error); }
        }, 300);
    });
}

/* --- Shared UI: Account --- */
function initAccount() {
    const mobileAccountIcon = document.getElementById('mobileAccountIcon');
    const desktopAccountIcon = document.getElementById('desktopAccountIcon');
    const accountOverlay = document.getElementById('accountOverlay');
    const accountContent = document.getElementById('accountContent');

    if (!accountOverlay || !accountContent) return; // EXIT SAFELY

    const openAccount = async () => {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                const user = await apiRequest('/api/auth/me');
                accountContent.innerHTML = `
                    <div style="padding: 1rem; border-bottom: 1px solid var(--color-border); margin-bottom: 0.5rem;">
                        <div style="font-weight: 600;">${user.full_name}</div>
                        <div style="color: var(--color-text-muted); font-size: 0.9rem;">${user.email}</div>
                    </div>
                    <a href="/account" class="account-option">My Account</a>
                    <a href="/orders" class="account-option">My Orders</a>
                    <a href="/wishlist" class="account-option">My Wishlist</a>
                    <a href="#" class="account-option" style="color: var(--color-error);" onclick="logoutAccount(); return false;">Logout</a>
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
        <p style="padding: 0 1rem 1rem; color: var(--color-text-secondary);">Please log in.</p>
        <a href="/login" class="account-option" style="text-align: center; background: var(--color-accent); color: white; border-radius: 4px; margin: 0 1rem 0.5rem;">Login</a>
        <a href="/login?tab=register" class="account-option" style="text-align: center; border: 1px solid var(--color-border); margin: 0 1rem;">Register</a>
    `;
}

function logoutAccount() {
    localStorage.removeItem('access_token');
    document.getElementById('accountOverlay').classList.remove('active');
    window.location.reload();
}

/* --- Shared UI: Newsletter --- */
function initNewsletter() {
    const form = document.getElementById('newsletterForm');
    if (!form) return; // EXIT SAFELY

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const btn = form.querySelector('button');
        const originalText = btn.textContent;
        btn.disabled = true; btn.textContent = 'Subscribing...';

        try {
            await apiRequest('/api/subscribe', { method: 'POST', body: JSON.stringify({ email: formData.get('email'), full_name: formData.get('full_name') }) });
            if (typeof showToast === 'function') showToast('Subscribed successfully!', 'success');
            form.reset();
        } catch (error) {
            if (typeof showToast === 'function') showToast('Failed to subscribe', 'error');
        } finally {
            btn.disabled = false; btn.textContent = originalText;
        }
    });
}

/* --- Homepage Loaders (SAFE: Will exit immediately if element is missing) --- */
async function loadCarousel() {
    const slides = document.getElementById('carouselSlides');
    if (!slides) return;
    try {
        const products = await apiRequest('/api/products/featured');
        if (!products || products.length === 0) return;
        slides.innerHTML = products.map(p => `
            <div class="carousel-slide">
                <img src="${p.image_url || '/static/images/placeholder.jpg'}" alt="${p.name}">
                <div class="carousel-content">
                    <h2>${p.name}</h2>
                    <p>${p.description ? p.description.substring(0, 120) + '...' : 'Discover this exquisite fragrance'}</p>
                    <a href="https://api.whatsapp.com/message/ANGMFTZI4R6LH1?text=I'm interested in ${encodeURIComponent(p.name)}" class="whatsapp-btn" target="_blank"><i class="fab fa-whatsapp"></i> Chat on WhatsApp</a>
                </div>
            </div>
        `).join('');
        let currentSlide = 0;
        setInterval(() => { currentSlide = (currentSlide + 1) % products.length; slides.style.transform = `translateX(-${currentSlide * 100}%)`; }, 5000);
    } catch (error) { console.error('Carousel load error:', error); }
}

async function loadBrandsVertical() {
    const container = document.getElementById('brandsVertical');
    if (!container) return;
    try {
        const brands = await apiRequest('/api/products/brands/list');
        if (!brands || brands.length === 0) return;
        container.innerHTML = brands.slice(0, 3).map(b => `
            <div class="brand-card-vertical" onclick="window.location.href='/shop?brand_slug=${b.slug}'">
                <img src="${b.logo_url || '/static/images/brand-placeholder.jpg'}" alt="${b.name}">
                <div class="brand-overlay"><h3>${b.name}</h3><span class="shop-now-btn">Shop Now <i class="fas fa-arrow-right"></i></span></div>
            </div>
        `).join('');
    } catch (error) { console.error('Brands load error:', error); }
}

async function loadCategoriesHorizontal() {
    const container = document.getElementById('categoriesScroll');
    if (!container) return;
    try {
        const categories = await apiRequest('/api/products/categories/list');
        if (!categories || categories.length === 0) return;
        container.innerHTML = categories.map(c => `
            <div class="category-circle" onclick="window.location.href='/shop?category_slug=${c.slug}'" title="${c.name}">
                <img src="${c.image_url || '/static/images/category-placeholder.jpg'}" alt="${c.name}">
                <div class="category-circle-name">${c.name}</div>
            </div>
        `).join('');
    } catch (error) { console.error('Categories load error:', error); }
}

async function loadHorizontalProducts(endpoint, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const products = await apiRequest(endpoint);
        if (!products || products.length === 0) return;
        container.innerHTML = products.map(p => `
            <div class="product-card-horizontal">
                <a href="/product/${p.id}" class="product-image"><img src="${p.image_url || '/static/images/placeholder.jpg'}" alt="${p.name}" loading="lazy"></a>
                <div class="product-info">
                    <div class="product-brand">${p.brand?.name || 'Sami\'s Scent'}</div>
                    <h3 class="product-name">${p.name}</h3>
                    <div class="current-price">₦${parseFloat(p.price).toLocaleString()}</div>
                    <button class="add-to-cart-btn-small" onclick="event.stopPropagation(); CartManager.addToCart('${p.id}')">Add to Cart</button>
                </div>
            </div>
        `).join('');
    } catch (error) { console.error(`Products load error (${endpoint}):`, error); }
}

async function loadFeaturedProduct() {
    const container = document.getElementById('featuredProduct');
    if (!container) return;
    try {
        const products = await apiRequest('/api/products/?limit=1'); 
        if (products && products.length > 0) {
            const p = products[0];
            container.innerHTML = `
                <div style="width: 100%; max-width: 280px;">
                    <div class="product-card" style="border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden;">
                        <a href="/product/${p.id}" class="product-image" style="aspect-ratio: 3/4;"><img src="${p.image_url || '/static/images/placeholder.jpg'}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover;"></a>
                        <div class="product-info" style="padding: 1.25rem; text-align: center;">
                            <div class="product-brand" style="margin-bottom: 0.5rem;">${p.brand?.name || 'Sami\'s Scent'}</div>
                            <h3 class="product-name" style="font-size: 1.25rem; margin-bottom: 0.75rem;">${p.name}</h3>
                            <div class="current-price" style="font-size: 1.25rem; margin-bottom: 1rem;">₦${parseFloat(p.price).toLocaleString()}</div>
                            <button class="btn btn-primary" onclick="CartManager.addToCart('${p.id}')" style="width: 100%;">Add to Cart</button>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) { console.error('Featured product load error:', error); }
}

/* ============================================
   SAMI'S SCENT - SHOPPING HOME PAGE LOGIC
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initPopups();
    initSearch();
    initAccount();
    initNewsletter();
    
    // Load dynamic content
    loadCarousel();
    loadBrandsVertical();
    loadCategoriesHorizontal();
    loadHorizontalProducts('/api/products/new-arrivals', 'newArrivalsScroll');
    loadHorizontalProducts('/api/products/bestsellers', 'bestsellersScroll');
    loadHorizontalProducts('/api/products/?limit=8', 'recommendedScroll');
    loadFeaturedProduct();
    
    // Update cart counts
    if (typeof CartManager !== 'undefined') {
        CartManager.updateCartCount();
    }
});

/* --- Mobile Menu Logic --- */
function initMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('closeMenuBtn');
    const drawer = document.getElementById('mobileMenuDrawer');

    if (menuBtn && drawer) {
        menuBtn.addEventListener('click', () => drawer.classList.add('active'));
        closeBtn.addEventListener('click', () => drawer.classList.remove('active'));
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!drawer.contains(e.target) && !menuBtn.contains(e.target)) {
                drawer.classList.remove('active');
            }
        });
    }
}

/* --- Popup Overlay Logic --- */
function initPopups() {
    const searchOverlay = document.getElementById('searchOverlay');
    const accountOverlay = document.getElementById('accountOverlay');
    
    const closeSearch = document.getElementById('closeSearchBtn');
    const closeAccount = document.getElementById('closeAccountBtn');

    if (closeSearch) closeSearch.addEventListener('click', () => searchOverlay.classList.remove('active'));
    if (closeAccount) closeAccount.addEventListener('click', () => accountOverlay.classList.remove('active'));

    // Close on overlay click
    if (searchOverlay) {
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) searchOverlay.classList.remove('active');
        });
    }
    if (accountOverlay) {
        accountOverlay.addEventListener('click', (e) => {
            if (e.target === accountOverlay) accountOverlay.classList.remove('active');
        });
    }
}

/* --- Search Logic with Debounce --- */
function initSearch() {
    const searchIcon = document.getElementById('searchIcon');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout;

    if (searchIcon && searchOverlay) {
        searchIcon.addEventListener('click', () => {
            searchOverlay.classList.add('active');
            setTimeout(() => searchInput.focus(), 100);
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
                        searchResults.innerHTML = '<p style="padding: 1rem; text-align: center; color: var(--color-text-muted, #999);">No products found</p>';
                    } else {
                        searchResults.innerHTML = products.map(p => `
                            <div class="search-result-item" onclick="window.location.href='/product/${p.id}'">
                                <img src="${p.image_url || '/static/images/placeholder.jpg'}" alt="${p.name}">
                                <div>
                                    <div style="font-weight: 600; color: var(--color-text-primary);">${p.name}</div>
                                    <div style="color: var(--color-accent, #8c735a); font-size: 0.9rem;">₦${parseFloat(p.price).toLocaleString()}</div>
                                </div>
                            </div>
                        `).join('');
                    }
                } catch (error) {
                    console.error('Search error:', error);
                    searchResults.innerHTML = '<p style="padding: 1rem; text-align: center; color: var(--color-error, #9b2226);">Error searching</p>';
                }
            }, 300); // 300ms debounce
        });
    }
}

/* --- Account Popup Logic --- */
function initAccount() {
    const accountIcon = document.getElementById('accountIcon');
    const accountOverlay = document.getElementById('accountOverlay');
    const accountContent = document.getElementById('accountContent');

    if (accountIcon && accountOverlay) {
        accountIcon.addEventListener('click', async () => {
            const token = localStorage.getItem('access_token');
            
            if (token) {
                try {
                    const user = await apiRequest('/api/auth/me');
                    accountContent.innerHTML = `
                        <div style="padding: 1rem; border-bottom: 1px solid var(--color-border, #e5e5e5); margin-bottom: 0.5rem;">
                            <div style="font-weight: 600; font-size: 1.1rem;">${user.full_name}</div>
                            <div style="color: var(--color-text-muted, #999); font-size: 0.9rem;">${user.email}</div>
                        </div>
                        <a href="/account" class="account-option">My Account</a>
                        <a href="/orders" class="account-option">My Orders</a>
                        <a href="/wishlist" class="account-option">My Wishlist</a>
                        <a href="#" class="account-option" style="color: var(--color-error, #9b2226);" onclick="logout(); return false;">Logout</a>
                    `;
                } catch (error) {
                    // Token invalid, show login
                    showLoginOptions(accountContent);
                }
            } else {
                showLoginOptions(accountContent);
            }
            
            accountOverlay.classList.add('active');
        });
    }
}

function showLoginOptions(container) {
    container.innerHTML = `
        <p style="padding: 0 1rem 1rem; color: var(--color-text-secondary);">Please log in to access your account details.</p>
        <a href="/login" class="account-option" style="text-align: center; background: var(--color-accent, #8c735a); color: white; border-radius: 4px; margin: 0 1rem 0.5rem;">Login</a>
        <a href="/login?tab=register" class="account-option" style="text-align: center; border: 1px solid var(--color-border); margin: 0 1rem;">Create Account</a>
    `;
}

function logout() {
    localStorage.removeItem('access_token');
    document.getElementById('accountOverlay').classList.remove('active');
    window.location.reload();
}

/* --- Newsletter Logic --- */
function initNewsletter() {
    const form = document.getElementById('newsletterForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const email = formData.get('email');
            const fullName = formData.get('full_name');
            
            const btn = form.querySelector('button');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Subscribing...';

            try {
                await apiRequest('/api/subscribe', {
                    method: 'POST',
                    body: JSON.stringify({ email: email, full_name: fullName })
                });
                
                if (typeof showToast === 'function') {
                    showToast('Thank you for subscribing to our newsletter!', 'success');
                } else {
                    alert('Thank you for subscribing!');
                }
                form.reset();
            } catch (error) {
                if (typeof showToast === 'function') {
                    showToast(error.message || 'Failed to subscribe', 'error');
                } else {
                    alert('Failed to subscribe. Please try again.');
                }
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }
}

/* --- Dynamic Content Loaders --- */

async function loadCarousel() {
    try {
        const products = await apiRequest('/api/products/featured');
        const slides = document.getElementById('carouselSlides');
        
        if (!products || products.length === 0) {
            slides.innerHTML = `
                <div class="carousel-slide">
                    <img src="/static/images/placeholder-carousel.jpg" alt="Sami's Scent">
                    <div class="carousel-content">
                        <h2>Discover Your Signature Scent</h2>
                        <p>Luxury fragrances crafted for the modern soul.</p>
                        <a href="/shop" class="whatsapp-btn" style="background: var(--color-accent, #8c735a);">
                            Shop Now <i class="fas fa-arrow-right"></i>
                        </a>
                    </div>
                </div>
            `;
            return;
        }
        
        slides.innerHTML = products.map(p => `
            <div class="carousel-slide">
                <img src="${p.image_url || '/static/images/placeholder.jpg'}" alt="${p.name}">
                <div class="carousel-content">
                    <h2>${p.name}</h2>
                    <p>${p.description ? p.description.substring(0, 120) + '...' : 'Discover this exquisite fragrance'}</p>
                    <a href="https://api.whatsapp.com/message/ANGMFTZI4R6LH1?text=I'm interested in ${encodeURIComponent(p.name)}" class="whatsapp-btn" target="_blank">
                        <i class="fab fa-whatsapp"></i> Chat on WhatsApp
                    </a>
                </div>
            </div>
        `).join('');
        
        // Auto-slide logic
        let currentSlide = 0;
        setInterval(() => {
            currentSlide = (currentSlide + 1) % products.length;
            slides.style.transform = `translateX(-${currentSlide * 100}%)`;
        }, 5000);
    } catch (error) {
        console.error('Carousel load error:', error);
    }
}

async function loadBrandsVertical() {
    try {
        const brands = await apiRequest('/api/products/brands/list');
        const container = document.getElementById('brandsVertical');
        
        if (!brands || brands.length === 0) return;
        
        container.innerHTML = brands.slice(0, 3).map(b => `
            <div class="brand-card-vertical" onclick="window.location.href='/shop?brand_slug=${b.slug}'">
                <img src="${b.logo_url || '/static/images/brand-placeholder.jpg'}" alt="${b.name}">
                <div class="brand-overlay">
                    <h3>${b.name}</h3>
                    <span class="shop-now-btn">
                        Shop Now <i class="fas fa-arrow-right"></i>
                    </span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Brands load error:', error);
    }
}

async function loadCategoriesHorizontal() {
    try {
        const categories = await apiRequest('/api/products/categories/list');
        const container = document.getElementById('categoriesScroll');
        
        if (!categories || categories.length === 0) return;
        
        container.innerHTML = categories.map(c => `
            <div class="category-circle" onclick="window.location.href='/shop?category_slug=${c.slug}'" title="${c.name}">
                <img src="${c.image_url || '/static/images/category-placeholder.jpg'}" alt="${c.name}">
                <div class="category-circle-name">${c.name}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Categories load error:', error);
    }
}

async function loadHorizontalProducts(endpoint, containerId) {
    try {
        const products = await apiRequest(endpoint);
        const container = document.getElementById(containerId);
        
        if (!products || products.length === 0) {
            container.innerHTML = '<p style="padding: 1rem; color: var(--color-text-muted);">No products available.</p>';
            return;
        }
        
        container.innerHTML = products.map(p => `
            <div class="product-card-horizontal">
                <a href="/product/${p.id}" class="product-image">
                    <img src="${p.image_url || '/static/images/placeholder.jpg'}" alt="${p.name}" loading="lazy">
                </a>
                <div class="product-info">
                    <div class="product-brand">${p.brand?.name || 'Sami\'s Scent'}</div>
                    <h3 class="product-name">${p.name}</h3>
                    <div class="current-price">₦${parseFloat(p.price).toLocaleString()}</div>
                    <button class="add-to-cart-btn-small" onclick="event.stopPropagation(); CartManager.addToCart('${p.id}')">
                        Add to Cart
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error(`Products load error (${endpoint}):`, error);
    }
}

async function loadFeaturedProduct() {
    try {
        // Fetch one featured product
        const products = await apiRequest('/api/products/?limit=1'); 
        if (products && products.length > 0) {
            const p = products[0];
            document.getElementById('featuredProduct').innerHTML = `
                <div style="width: 100%; max-width: 280px;">
                    <div class="product-card" style="border: 1px solid var(--color-border, #e5e5e5); border-radius: 8px; overflow: hidden;">
                        <a href="/product/${p.id}" class="product-image" style="aspect-ratio: 3/4;">
                            <img src="${p.image_url || '/static/images/placeholder.jpg'}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover;">
                        </a>
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
    } catch (error) {
        console.error('Featured product load error:', error);
    }
}

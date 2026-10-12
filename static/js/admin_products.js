let allProducts = [];
let searchTimeout;

document.addEventListener('DOMContentLoaded', async () => {
    await loadProductStats();
    await loadDropdowns(); // Reuse from admin.js or redefine
    await loadProducts();
    
    // Debounced Search
    document.getElementById('productSearch').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            renderProducts(e.target.value.trim().toLowerCase());
        }, 300);
    });
});

async function loadProductStats() {
    try {
        const stats = await adminFetch('/api/admin/products/stats');
        document.getElementById('statTotalProducts').textContent = stats.total_products;
        document.getElementById('statTopProduct').textContent = stats.top_product;
        document.getElementById('statTopBrand').textContent = stats.top_brand;
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadDropdowns() {
    try {
        const brands = await adminFetch('/api/admin/brands/list');
        const categories = await adminFetch('/api/admin/categories/list');
        
        const brandSelect = document.getElementById('prodBrand');
        brandSelect.innerHTML = brands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        
        const catSelect = document.getElementById('prodCategory');
        catSelect.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (error) {
        console.error('Failed to load dropdowns:', error);
    }
}

async function loadProducts() {
    try {
        allProducts = await adminFetch('/api/admin/products');
        renderProducts('');
    } catch (error) {
        document.getElementById('productsTableBody').innerHTML = 
            `<tr><td colspan="7" style="text-align:center; color: #ef4444; padding: 2rem;">Failed to load products</td></tr>`;
    }
}

function renderProducts(searchTerm) {
    const tbody = document.getElementById('productsTableBody');
    const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.brand.toLowerCase().includes(searchTerm)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;">No products found</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td>
                <img src="${p.image_url || '/static/images/placeholder.jpg'}" 
                     alt="${p.name}" 
                     style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid var(--admin-border);">
            </td>
            <td><strong>${p.name}</strong></td>
            <td>${p.brand}</td>
            <td>₦${p.price.toLocaleString()}</td>
            <td>${p.stock_quantity}</td>
            <td>
                <span class="status-badge ${p.is_active ? 'status-verified' : 'status-rejected'}">
                    ${p.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn-secondary btn-sm" onclick="openEditProductModal('${p.id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-secondary btn-sm" style="color:#ef4444; border-color:#ef4444;" onclick="toggleProductStatus('${p.id}', ${!p.is_active})" title="${p.is_active ? 'Deactivate' : 'Activate'}">
                    <i class="fas fa-${p.is_active ? 'ban' : 'check'}"></i>
                </button>
                <button class="btn-secondary btn-sm" style="color:#ef4444; border-color:#ef4444;" onclick="deleteProduct('${p.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Modal Handling
function openAddProductModal() {
    document.getElementById('modalTitle').textContent = 'Add New Product';
    document.getElementById('productForm').reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('currentImageHint').style.display = 'none';
    document.getElementById('prodStatus').value = 'true';
    openModal('productModal');
}

async function openEditProductModal(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('modalTitle').textContent = 'Edit Product';
    document.getElementById('editProductId').value = product.id;
    document.getElementById('prodName').value = product.name;
    document.getElementById('prodPrice').value = product.price;
    document.getElementById('prodStock').value = product.stock_quantity;
    document.getElementById('prodStatus').value = product.is_active.toString();
    document.getElementById('prodDesc').value = ''; // Description might not be in the list view, leave blank or fetch
    
    // Find brand and category IDs (simplified for this example, assumes exact name match or you can store IDs in the list)
    // For robustness, the backend should return brand_id and category_id in the list endpoint. 
    // Assuming we update backend to return them, or we just let admin re-select.
    
    document.getElementById('currentImageHint').textContent = `Current: ${product.image_url ? 'Image set' : 'No image'}`;
    document.getElementById('currentImageHint').style.display = 'block';
    document.getElementById('prodImage').required = false;

    openModal('productModal');
}

// Form Submission (Handles both Add and Edit)
document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('productSubmitBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const formData = new FormData();
    const editId = document.getElementById('editProductId').value;
    const isEdit = !!editId;

    formData.append('name', document.getElementById('prodName').value);
    formData.append('price', parseFloat(document.getElementById('prodPrice').value));
    formData.append('stock_quantity', parseInt(document.getElementById('prodStock').value));
    formData.append('is_active', document.getElementById('prodStatus').value === 'true');
    
    if (document.getElementById('prodDesc').value) {
        formData.append('description', document.getElementById('prodDesc').value);
    }

    // For Add, we need brand_id and category_id. For Edit, ideally we send them too if changed.
    // Assuming the selects have IDs as values:
    if (!isEdit) {
        formData.append('brand_id', document.getElementById('prodBrand').value);
        formData.append('category_id', document.getElementById('prodCategory').value);
    }

    const imageFile = document.getElementById('prodImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    try {
        if (isEdit) {
            await adminFetch(`/api/admin/products/${editId}`, {
                method: 'PATCH',
                body: formData
            });
            alert('Product updated successfully!');
        } else {
            formData.append('brand_id', document.getElementById('prodBrand').value);
            formData.append('category_id', document.getElementById('prodCategory').value);
            await adminFetch('/api/admin/products', {
                method: 'POST',
                body: formData
            });
            alert('Product created successfully!');
        }
        closeModal('productModal');
        await loadProducts();
        await loadProductStats();
    } catch (error) {
        alert('Failed to save product: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});

async function toggleProductStatus(productId, newStatus) {
    if (!confirm(`Are you sure you want to mark this product as ${newStatus ? 'Active' : 'Inactive'}?`)) return;
    
    const formData = new FormData();
    formData.append('is_active', newStatus);

    try {
        await adminFetch(`/api/admin/products/${productId}`, {
            method: 'PATCH',
            body: formData
        });
        await loadProducts();
    } catch (error) {
        alert('Failed to update status: ' + error.message);
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to permanently delete this product? This action cannot be undone.')) return;
    
    try {
        await adminFetch(`/api/admin/products/${productId}`, {
            method: 'DELETE'
        });
        await loadProducts();
        await loadProductStats();
    } catch (error) {
        alert('Failed to delete product: ' + error.message);
    }
}

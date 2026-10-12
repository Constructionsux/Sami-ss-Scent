/* ============================================
   SAMI'S SCENT - ACCOUNT PAGE LOGIC
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
    // Shared UI components are initialized by shop.js
    await loadAccountData();
    
    if (typeof CartManager !== 'undefined') {
        CartManager.updateCartCount();
    }
});

async function loadAccountData() {
    const loadingEl = document.getElementById('accountLoading');
    const authEl = document.getElementById('accountAuthRequired');
    const dashboardEl = document.getElementById('accountDashboard');

    try {
        const user = await apiRequest('/api/auth/me');
        
        // Populate form
        document.getElementById('accountEmail').value = user.email;
        document.getElementById('accountName').value = user.full_name || '';
        document.getElementById('accountPhone').value = user.phone || '';

        // Show dashboard
        loadingEl.style.display = 'none';
        dashboardEl.style.display = 'grid';

    } catch (error) {
        console.error('Failed to load account data:', error);
        loadingEl.style.display = 'none';
        
        if (error.message.includes('401') || error.message.includes('Invalid token')) {
            authEl.style.display = 'block';
        } else {
            // Generic error fallback
            authEl.innerHTML = `
                <i class="fas fa-exclamation-circle" style="color: var(--color-error);"></i>
                <h2>Error Loading Account</h2>
                <p>${error.message}</p>
                <a href="/shop-home" class="btn btn-primary">Return Home</a>
            `;
            authEl.style.display = 'block';
        }
    }
}

// Handle Profile Update
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('accountName').value.trim();
    const phone = document.getElementById('accountPhone').value.trim();
    
    const btn = document.getElementById('saveProfileBtn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    // Loading state
    btn.disabled = true;
    btnText.hidden = true;
    btnLoader.hidden = false;

    try {
        const response = await apiRequest('/api/auth/me', {
            method: 'PATCH',
            body: JSON.stringify({
                full_name: name,
                phone: phone
            })
        });

        if (typeof showToast === 'function') {
            showToast(response.message || 'Profile updated successfully!', 'success');
        } else {
            alert('Profile updated successfully!');
        }
    } catch (error) {
        console.error('Failed to update profile:', error);
        if (typeof showToast === 'function') {
            showToast(error.message || 'Failed to update profile', 'error');
        } else {
            alert('Failed to update profile: ' + error.message);
        }
    } finally {
        // Reset button state
        btn.disabled = false;
        btnText.hidden = false;
        btnLoader.hidden = true;
    }
});

// Logout Function
function logoutAccount() {
    if (confirm('Are you sure you want to log out?')) {
        localStorage.removeItem('access_token');
        if (typeof showToast === 'function') {
            showToast('Logged out successfully', 'success');
        }
        setTimeout(() => {
            window.location.href = '/shop-home';
        }, 1000);
    }
}

const API_BASE = '';

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    const guestToken = localStorage.getItem('guest_token');
    
    const headers = {
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (guestToken) {
        headers['X-Guest-Token'] = guestToken;
    }
    
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Request failed');
        }
        
        return response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? 'var(--color-success)' : 'var(--color-error)'};
        color: white;
        border-radius: var(--radius-md);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Initialize guest token
if (!localStorage.getItem('guest_token')) {
    localStorage.setItem('guest_token', crypto.randomUUID());
}

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
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { detail: response.statusText || 'Request failed' };
            }
            
            // FastAPI returns validation errors as an array in 'detail'
            let errorMessage = 'Request failed';
            if (typeof errorData.detail === 'string') {
                errorMessage = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
                // Join all validation messages into one readable string
                errorMessage = errorData.detail.map(d => d.msg || 'Validation error').join(', ');
            } else if (errorData.detail) {
                errorMessage = String(errorData.detail);
            }
            
            throw new Error(errorMessage);
        }
        
        if (response.status === 204) {
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error.message || error);
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
        background: ${type === 'success' ? 'var(--color-success, #2d6a4f)' : 'var(--color-error, #9b2226)'};
        color: white;
        border-radius: var(--radius-md, 8px);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Initialize guest token if it doesn't exist
if (!localStorage.getItem('guest_token')) {
    localStorage.setItem('guest_token', crypto.randomUUID());
}

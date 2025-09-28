// --- GLOBAL CONFIG & STATE ---
const API_URL = 'https://localhost:5001/api';
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

// --- API HELPER ---
async function apiCall(endpoint, options = {}) {
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    };

    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const responseText = await response.text();

        if (!response.ok) {
            // Try to parse error response, but fall back to text
            try {
                const errorData = JSON.parse(responseText);
                throw new Error(errorData.message || 'Server Error');
            } catch (e) {
                throw new Error(responseText || 'Server Error');
            }
        }

        // Try to parse successful response as JSON
        try {
            return JSON.parse(responseText);
        } catch (jsonError) {
            // Handle cases where the server sends a non-JSON success response
            return { success: true, data: responseText };
        }
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// --- AUTH & HEADER ---
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    authToken = null;
    currentUser = null;
    // Redirect to sign-in page after logout
    window.location.href = 'signin.html';
}

// --- UTILITY & UI FUNCTIONS ---
function calculateTimeLeft(endDate) {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;
    return `${minutes} minute${minutes > 1 ? 's' : ''} left`;
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

// --- PAGE REDIRECTION ---
function showViewer() {
    window.location.href = 'viewer.html';
}
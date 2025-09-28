// Recommendation widget for your frontend
async function loadRecommendations() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser || !currentUser.token) {
            displayNoRecommendations();
            return;
        }

        const response = await fetch('/api/recommendations', {
            headers: {
                'Authorization': `Bearer ${currentUser.token}`
            }
        });
        
        const data = await response.json();
        if (data.success && data.recommendations.length > 0) {
            displayRecommendations(data.recommendations);
        } else {
            displayNoRecommendations();
        }
    } catch (error) {
        console.error('Error loading recommendations:', error);
        displayNoRecommendations();
    }
}

function displayRecommendations(products) {
    const container = document.getElementById('recommendationsContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="recommendations-section">
            <h3>Recommended For You</h3>
            <div class="recommendations-grid">
                ${products.map(product => `
                    <div class="recommendation-card">
                        <img src="${product.images[0] || 'placeholder.jpg'}" alt="${product.name}"
                             onerror="this.src='placeholder.jpg'">
                        <div class="recommendation-content">
                            <h4>${product.name}</h4>
                            <p class="price">€${product.currentPrice.toFixed(2)}</p>
                            <div class="recommendation-meta">
                                <span class="time-left">
                                    <i class="fas fa-clock"></i>
                                    ${getTimeLeft(product.endDate)}
                                </span>
                                <span class="bid-count">
                                    <i class="fas fa-gavel"></i>
                                    ${product.bids ? product.bids.length : 0} bids
                                </span>
                            </div>
                            <button onclick="viewProduct('${product._id}')">
                                View Auction
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
}

function displayNoRecommendations() {
    const container = document.getElementById('recommendationsContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="recommendations-section">
            <h3>Discover Auctions</h3>
            <div class="no-recommendations">
                <i class="fas fa-compass"></i>
                <p>Explore more auctions to get personalized recommendations</p>
            </div>
        </div>`;
}

function getTimeLeft(endDate) {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
        return `${days}d ${hours}h left`;
    } else if (hours > 0) {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m left`;
    } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${minutes}m left`;
    }
}

function viewProduct(productId) {
    // Track the interaction
    trackInteraction(productId, 'view');
    // Navigate to product
    window.location.href = `viewer.html?id=${productId}`;
}

// Track user interactions for better recommendations
function trackInteraction(productId, interactionType) {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser || !currentUser.token) return;

        fetch('/api/interactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({
                productId,
                type: interactionType,
                timestamp: new Date().toISOString()
            })
        });
    } catch (error) {
        console.error('Error tracking interaction:', error);
    }
}

// Load recommendations when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('recommendationsContainer')) {
        loadRecommendations();
    }
});

// Export functions for use in other files
window.trackInteraction = trackInteraction;
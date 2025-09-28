// Recommendation widget for your frontend
async function loadRecommendations() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch('/api/recommendations', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (data.success && data.recommendations.length > 0) {
            displayRecommendations(data.recommendations);
        }
    } catch (error) {
        console.error('Error loading recommendations:', error);
    }
}

function displayRecommendations(products) {
    const container = document.getElementById('recommendationsContainer');
    if (!container) return;

    let html = `
        <div class="recommendations-section">
            <h3>Recommended For You</h3>
            <div class="recommendations-grid">
    `;

    products.forEach(product => {
        html += `
            <div class="recommendation-card">
                <img src="${product.images?.[0] || '/images/placeholder.jpg'}" alt="${product.name}">
                <h4>${product.name}</h4>
                <p class="price">$${product.currentPrice || product.startingPrice}</p>
                <button onclick="viewProduct('${product._id}')">View</button>
            </div>
        `;
    });

    html += '</div></div>';
    container.innerHTML = html;
}

function viewProduct(productId) {
    // Track the view
    fetch('/api/track-interaction', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
            productId: productId,
            type: 'view'
        })
    });

    // Navigate to product
    window.location.href = `/viewer.html?id=${productId}`;
}

// Load recommendations when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) {
        loadRecommendations();
    }
});
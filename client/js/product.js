document.addEventListener('DOMContentLoaded', () => {
    // Get the product ID from the URL query parameter (e.g., ?id=12345)
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        document.getElementById('product-details-content').innerHTML = '<p>Product not found. Please go back and select a product.</p>';
        return;
    }

    loadProductDetails(productId);
});

async function loadProductDetails(productId) {
    const contentDiv = document.getElementById('product-details-content');
    try {
        const response = await apiCall(`/products/${productId}`);
        if (!response.success) {
            throw new Error(response.message || 'Could not fetch product details.');
        }

        const product = response.product;
        renderProduct(product);
        loadBidHistory(productId);

    } catch (error) {
        contentDiv.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
    }
}

function renderProduct(product) {
    const contentDiv = document.getElementById('product-details-content');
    const timeLeft = calculateTimeLeft(product.endDate);
    const isEnded = timeLeft === 'Ended';

    let bidSectionHTML = `
        <form id="bidForm">
            <label for="bidAmount">Your Bid:</label>
            <input type="number" id="bidAmount" name="bidAmount" step="0.01" min="${(product.currentPrice + 0.01).toFixed(2)}" placeholder="> $${product.currentPrice.toFixed(2)}" required>
            <button type="submit" class="btn-primary">Place Bid</button>
        </form>
    `;

    if (isEnded) {
        bidSectionHTML = `<div class="auction-ended">Auction has ended.</div>`;
    } else if (!currentUser) {
        bidSectionHTML = `<div class="login-prompt">Please <a href="signin.html">sign in</a> to place a bid.</div>`;
    }

    contentDiv.innerHTML = `
        <div class="product-gallery">
            <img src="${product.images?.[0] || '/css/placeholder.png'}" alt="${product.name}" id="main-product-image">
            <!-- Thumbnails can be added here if multiple images exist -->
        </div>
        <div class="product-main-info">
            <h1>${product.name}</h1>
            <div class="price-timer">
                <span class="current-price">Current Price: $${product.currentPrice.toFixed(2)}</span>
                <span class="time-left"><i class="fas fa-clock"></i> ${timeLeft}</span>
            </div>
            <div class="seller-info">
                <span>Sold by: <strong>${product.seller?.username || 'N/A'}</strong></span>
            </div>
            <div class="product-description">
                <h3>Description</h3>
                <p>${product.description || 'No description provided.'}</p>
            </div>
            <div class="bidding-area">
                ${bidSectionHTML}
            </div>
            <div class="bid-history">
                <h3>Bid History</h3>
                <div id="bid-history-list">Loading history...</div>
            </div>
        </div>
    `;

    // Add event listener only if the form exists
    const bidForm = document.getElementById('bidForm');
    if (bidForm) {
        bidForm.addEventListener('submit', (event) => handleBidSubmit(event, product._id));
    }
}

async function loadBidHistory(productId) {
    const historyContainer = document.getElementById('bid-history-list');
    try {
        const data = await apiCall(`/bids/product/${productId}`);
        if (data.success && data.bids.length > 0) {
            historyContainer.innerHTML = data.bids
                .map(bid => `
                    <div class="bid-entry">
                        <span class="bid-user">${bid.user.username}</span>
                        <span class="bid-amount">$${bid.amount.toFixed(2)}</span>
                        <span class="bid-time">${getTimeAgo(bid.timestamp)}</span>
                    </div>
                `)
                .join('');
        } else {
            historyContainer.innerHTML = 'No bids have been placed yet.';
        }
    } catch (error) {
        historyContainer.innerHTML = 'Could not load bid history.';
    }
}

async function handleBidSubmit(event, productId) {
    event.preventDefault();
    const amount = parseFloat(document.getElementById('bidAmount').value);
    if (!amount || isNaN(amount)) {
        alert('Please enter a valid bid amount.');
        return;
    }

    try {
        const response = await apiCall('/bids', {
            method: 'POST',
            body: JSON.stringify({ productId, amount }),
        });

        if (response.success) {
            // Reload the whole page to show the new price and bid history
            window.location.reload();
        }
    } catch (error) {
        alert(`Bid failed: ${error.message}`);
    }
}
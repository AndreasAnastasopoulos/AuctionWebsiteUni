// --- STATE & CONFIG ---
let currentProductId = null;
let productsMap = null;
let productMarkers = [];
let mapVisible = false;
let currentPage = 1;
const productsPerPage = 9;
let filteredProducts = [];
let allProductsDisplay = [];
window.allProducts = [];

// --- PRODUCT & BIDDING LOGIC ---
async function loadProducts() {
    try {
        const response = await apiCall('/products');
        if (response.success) {
            window.allProducts = response.products;
            allProductsDisplay = [...window.allProducts];
            filteredProducts = [...allProductsDisplay];
            initializeProductsDisplay(); // This line was missing
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function displayProducts(products) {
    const productsGrid = document.querySelector('.products-grid');
    if (!productsGrid) return;
    productsGrid.innerHTML = '';

    if (!products || products.length === 0) {
        productsGrid.innerHTML = '<p class="no-products">No active auctions match your criteria.</p>';
        return;
    }

    products.forEach(product => {
        const timeLeft = calculateTimeLeft(product.endDate);
        const isEnded = timeLeft === 'Ended';
        const productCard = document.createElement('div');
        productCard.className = 'product-card';

        let actionSection = '';
        if (isEnded) {
            actionSection = '<div class="guest-info">Auction Ended</div>';
        } else if (!currentUser) {
            actionSection = `<div class="guest-info"><i class="fas fa-lock"></i> <a href="signin.html">Sign in</a> to bid</div>`;
        } else if (currentUser.status === 'pending') {
            actionSection = `<div class="pending-user-info"><i class="fas fa-clock"></i> Account Pending</div>`;
        } else if (currentUser.status === 'active') {
            actionSection = `<div class="product-bid-section"><button class="bid-button" onclick="showBidModal('${product._id}', ${product.currentPrice})"><i class="fas fa-gavel"></i> Place Bid</button></div>`;
        }

        productCard.innerHTML = `
            <div class="product-image">${product.images && product.images[0] ? `<img src="${product.images[0]}" alt="${product.title}">` : ''}</div>
            <div class="product-info">
                <div class="product-category">${product.category}</div>
                <h3 class="product-title">${product.title}</h3>
                <div class="current-bid">$${product.currentPrice.toFixed(2)}</div>
                <div class="bid-info">${product.bidCount} bid${product.bidCount !== 1 ? 's' : ''} • ${timeLeft}</div>
                ${actionSection}
            </div>`;
        productsGrid.appendChild(productCard);
    });
}

function showBidModal(productId, currentPrice) {
    if (!currentUser || currentUser.status !== 'active') {
        alert(currentUser && currentUser.status === 'pending' ? 'Your account is pending approval.' : 'Please sign in to place bids.');
        return;
    }
    currentProductId = productId;
    document.getElementById('currentPrice').textContent = currentPrice.toFixed(2);
    const bidAmountElement = document.getElementById('bidAmount');
    bidAmountElement.value = '';
    bidAmountElement.min = (currentPrice + 0.01).toFixed(2);
    bidAmountElement.placeholder = `Min: $${(currentPrice + 0.01).toFixed(2)}`;
    loadBidHistory(productId);
    document.getElementById('bidModal').style.display = 'block';
    setTimeout(() => bidAmountElement.focus(), 100);
}

function closeBidModal() {
    document.getElementById('bidModal').style.display = 'none';
    currentProductId = null;
}

async function submitBid() {
    const bidAmount = parseFloat(document.getElementById('bidAmount').value);
    const currentPrice = parseFloat(document.getElementById('currentPrice').textContent);

    if (!bidAmount || isNaN(bidAmount) || bidAmount <= currentPrice) {
        alert(`Your bid must be a valid number higher than the current bid of $${currentPrice.toFixed(2)}`);
        return;
    }

    const submitBtn = document.querySelector('.bid-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Bid...';

    try {
        const response = await apiCall('/bids', {
            method: 'POST',
            body: JSON.stringify({ productId: currentProductId, amount: bidAmount })
        });
        if (response.success) {
            closeBidModal();
            loadProducts(); // Refresh products to show new price
        }
    } catch (error) {
        alert(error.message || 'Failed to place bid.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Bid';
    }
}

async function loadBidHistory(productId) {
    const bidHistoryContainer = document.getElementById('bidHistory');
    try {
        const response = await apiCall(`/bids/product/${productId}`);
        if (response.success && response.bids && response.bids.length > 0) {
            bidHistoryContainer.innerHTML = response.bids.slice(0, 5).map(bid => `
                <div class="bid-history-item">
                    <div>
                        <div class="bid-user">${bid.user.username}</div>
                        <div class="bid-time">${getTimeAgo(new Date(bid.timestamp))}</div>
                    </div>
                    <div class="bid-amount">$${bid.amount.toFixed(2)}</div>
                </div>`).join('');
        } else {
            bidHistoryContainer.innerHTML = '<div class="no-bids">No bids yet. Be the first!</div>';
        }
    } catch (error) {
        bidHistoryContainer.innerHTML = '<div class="no-bids">Could not load bid history.</div>';
    }
}

// --- PAGINATION, FILTERING, SORTING ---
function initializeProductsDisplay() {
    displayProductsWithPagination();
}

function displayProductsWithPagination() {
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    displayProducts(filteredProducts.slice(startIndex, endIndex));
    updatePagination();
    updateResultsInfo();
}

function updatePagination() {
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    const pageNumbers = document.getElementById('pageNumbers');
    if (!pageNumbers) return;
    pageNumbers.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.className = `page-number ${i === currentPage ? 'active' : ''}`;
        button.textContent = i;
        button.onclick = () => goToPage(i);
        pageNumbers.appendChild(button);
    }
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages || totalPages === 0;
}

function goToPage(page) {
    currentPage = page;
    displayProductsWithPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function previousPage() { if (currentPage > 1) goToPage(currentPage - 1); }
function nextPage() {
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    if (currentPage < totalPages) goToPage(currentPage + 1);
}

function updateResultsInfo() {
    const startIndex = (currentPage - 1) * productsPerPage + 1;
    const endIndex = Math.min(currentPage * productsPerPage, filteredProducts.length);
    document.getElementById('showingCount').textContent = filteredProducts.length > 0 ? `${startIndex}-${endIndex}` : '0';
    document.getElementById('totalCount').textContent = filteredProducts.length;
}

function applyFilters() {
    const searchTerm = (document.getElementById('productSearch')?.value || '').toLowerCase();
    const category = document.getElementById('categoryFilter')?.value || '';
    const sortOption = document.getElementById('priceSort')?.value || '';

    filteredProducts = allProductsDisplay.filter(p => 
        (p.title.toLowerCase().includes(searchTerm) || p.category.toLowerCase().includes(searchTerm)) &&
        (category === '' || p.category === category)
    );

    switch (sortOption) {
        case 'low-high': filteredProducts.sort((a, b) => a.currentPrice - b.currentPrice); break;
        case 'high-low': filteredProducts.sort((a, b) => b.currentPrice - a.currentPrice); break;
        case 'ending-soon': filteredProducts.sort((a, b) => new Date(a.endDate) - new Date(b.endDate)); break;
    }
    
    currentPage = 1;
    displayProductsWithPagination();
}

// --- MAP LOGIC ---
function toggleMapView() {
    const mapSection = document.getElementById('mapSection');
    mapVisible = !mapVisible;
    mapSection.style.display = mapVisible ? 'block' : 'none';
    document.getElementById('mapToggleText').textContent = mapVisible ? 'Hide Map' : 'Show Map';
    if (mapVisible && !productsMap) {
        setTimeout(() => {
            initProductsMap();
            addProductMarkersToMap(window.allProducts);
        }, 100);
    } else if (mapVisible) {
        productsMap.invalidateSize();
    }
}

function initProductsMap() {
    if (productsMap) return;
    productsMap = L.map('products-map').setView([37.9838, 23.7275], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(productsMap);
}

function addProductMarkersToMap(products) {
    if (!productsMap) return;
    productMarkers.forEach(marker => productsMap.removeLayer(marker));
    productMarkers = [];
    products.forEach(product => {
        if (product.seller?.location?.coordinates) {
            const [lng, lat] = product.seller.location.coordinates;
            const marker = L.marker([lat, lng]).bindPopup(`<h4>${product.title}</h4><p>$${product.currentPrice.toFixed(2)}</p>`);
            marker.addTo(productsMap);
            productMarkers.push(marker);
        }
    });
    if (productMarkers.length > 0) {
        productsMap.fitBounds(L.featureGroup(productMarkers).getBounds().pad(0.1));
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // This check was too strict and blocked guest viewers.
    // The page will now load for everyone, and other functions will handle
    // showing/hiding content based on whether a user is logged in.
    
    // updateAuthenticatedHeader(); // This function is not defined, so it's commented out.
    loadProducts();

    // Event listeners for filters
    // The search input in the header has a different ID.
    document.getElementById('headerProductSearch')?.addEventListener('input', applyFilters);
    // These filters do not exist in the provided HTML.
    // document.getElementById('categoryFilter')?.addEventListener('change', applyFilters);
    // document.getElementById('priceSort')?.addEventListener('change', applyFilters);
});
document.addEventListener('DOMContentLoaded', () => {
    // Redirect if not logged in or account is not active
    if (!currentUser || currentUser.status !== 'active') {
        // Allow pending users to see a message, but not interact
        if (!currentUser || currentUser.status !== 'pending') {
            window.location.href = 'signin.html';
            return;
        }
    }
    
    loadProducts();
    setupEventListeners();
});

// --- STATE & CONFIG ---
let currentProductId = null;
let productsMap = null;
let productMarkers = [];
let mapVisible = false;
let currentPage = 1;
const productsPerPage = 9;
let allProducts = [];
let filteredProducts = [];

function setupEventListeners() {
    document.getElementById('productSearch')?.addEventListener('input', applyFiltersAndSort);
    document.getElementById('categoryFilter')?.addEventListener('change', applyFiltersAndSort);
    document.getElementById('priceSort')?.addEventListener('change', applyFiltersAndSort);
    document.getElementById('mapToggleButton')?.addEventListener('click', toggleMapView);
    document.querySelector('.modal-close')?.addEventListener('click', closeBidModal);
    document.getElementById('bidForm')?.addEventListener('submit', submitBid);
    document.getElementById('prevBtn')?.addEventListener('click', previousPage);
    document.getElementById('nextBtn')?.addEventListener('click', nextPage);
}

// --- PRODUCT & BIDDING LOGIC ---
async function loadProducts() {
    try {
        const data = await apiCall('/products');
        if (data.success) {
            allProducts = data.products;
            applyFiltersAndSort();
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function displayProducts() {
    const productsGrid = document.querySelector('.products-grid');
    productsGrid.innerHTML = '';

    const paginatedProducts = filteredProducts.slice((currentPage - 1) * productsPerPage, currentPage * productsPerPage);

    if (paginatedProducts.length === 0) {
        productsGrid.innerHTML = '<p>No products found.</p>';
        return;
    }

    paginatedProducts.forEach(product => {
        const timeLeft = calculateTimeLeft(product.endDate);
        const isEnded = timeLeft === 'Ended';
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        
        let bidSection = `<button class="bid-button" onclick="showBidModal('${product._id}', ${product.currentPrice})">Place Bid</button>`;
        if (isEnded) {
            bidSection = `<div class="auction-ended">Auction Ended</div>`;
        } else if (currentUser.status === 'pending') {
            bidSection = `<div class="account-pending">Account Pending</div>`;
        }

        productCard.innerHTML = `
            <div class="product-image">
                <img src="${product.images?.[0] || 'css/placeholder.png'}" alt="${product.title}">
            </div>
            <div class="product-info">
                <h3>${product.title}</h3>
                <p class="price">Current Bid: $${product.currentPrice.toFixed(2)}</p>
                <p class="time-left">${timeLeft}</p>
                ${bidSection}
            </div>
        `;
        productsGrid.appendChild(productCard);
    });

    updatePagination();
}

function showBidModal(productId, currentPrice) {
    currentProductId = productId;
    document.getElementById('currentPrice').textContent = currentPrice.toFixed(2);
    const bidAmountInput = document.getElementById('bidAmount');
    bidAmountInput.min = (currentPrice + 0.01).toFixed(2);
    bidAmountInput.placeholder = `Enter > $${currentPrice.toFixed(2)}`;
    bidAmountInput.value = '';
    loadBidHistory(productId);
    document.getElementById('bidModal').style.display = 'block';
}

function closeBidModal() {
    document.getElementById('bidModal').style.display = 'none';
}

async function submitBid(event) {
    event.preventDefault();
    const amount = parseFloat(document.getElementById('bidAmount').value);
    if (!amount || isNaN(amount)) {
        alert('Please enter a valid bid amount.');
        return;
    }

    try {
        await apiCall('/bids', {
            method: 'POST',
            body: JSON.stringify({ productId: currentProductId, amount }),
        });
        closeBidModal();
        loadProducts(); // Refresh products list
    } catch (error) {
        alert(`Bid failed: ${error.message}`);
    }
}

async function loadBidHistory(productId) {
    const historyContainer = document.getElementById('bidHistory');
    historyContainer.innerHTML = 'Loading...';
    try {
        const data = await apiCall(`/bids/product/${productId}`);
        if (data.success && data.bids.length > 0) {
            historyContainer.innerHTML = data.bids
                .map(bid => `<div>${bid.user.username}: $${bid.amount.toFixed(2)} (${getTimeAgo(bid.timestamp)})</div>`)
                .join('');
        } else {
            historyContainer.innerHTML = 'No bids yet.';
        }
    } catch (error) {
        historyContainer.innerHTML = 'Could not load bid history.';
    }
}

// --- FILTER, SORT, & PAGINATION ---
function applyFiltersAndSort() {
    const searchTerm = document.getElementById('productSearch').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const sortOption = document.getElementById('priceSort').value;

    filteredProducts = allProducts.filter(p =>
        (p.title.toLowerCase().includes(searchTerm) || p.description.toLowerCase().includes(searchTerm)) &&
        (category === '' || p.category === category)
    );

    switch (sortOption) {
        case 'low-high': filteredProducts.sort((a, b) => a.currentPrice - b.currentPrice); break;
        case 'high-low': filteredProducts.sort((a, b) => b.currentPrice - a.currentPrice); break;
        case 'ending-soon': filteredProducts.sort((a, b) => new Date(a.endDate) - new Date(b.endDate)); break;
    }

    currentPage = 1;
    displayProducts();
}

function updatePagination() {
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    document.getElementById('pageNumbers').textContent = `Page ${currentPage} of ${totalPages || 1}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages || totalPages === 0;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    displayProducts();
}

function previousPage() { goToPage(currentPage - 1); }
function nextPage() { goToPage(currentPage + 1); }

// --- MAP LOGIC ---
function toggleMapView() {
    const mapSection = document.getElementById('mapSection');
    mapVisible = !mapVisible;
    mapSection.style.display = mapVisible ? 'block' : 'none';
    if (mapVisible) {
        if (!productsMap) initProductsMap();
        productsMap.invalidateSize(); // Important for rendering correctly
    }
}

function initProductsMap() {
    productsMap = L.map('products-map').setView([37.9838, 23.7275], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(productsMap);
    addProductMarkers();
}

function addProductMarkers() {
    productMarkers.forEach(marker => marker.remove());
    productMarkers = [];
    allProducts.forEach(product => {
        if (product.seller?.location?.coordinates) {
            const [lng, lat] = product.seller.location.coordinates;
            if (lat && lng) {
                const marker = L.marker([lat, lng])
                    .addTo(productsMap)
                    .bindPopup(`<b>${product.title}</b><br>$${product.currentPrice.toFixed(2)}`);
                productMarkers.push(marker);
            }
        }
    });
}
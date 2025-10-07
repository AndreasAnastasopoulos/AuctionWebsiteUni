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
let userLocationMarker = null;

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
    productsGrid.innerHTML = '';

    if (!products || products.length === 0) {
        productsGrid.innerHTML = '<p>No products found matching your criteria.</p>';
        return;
    }

    products.forEach(product => {
        const timeLeft = calculateTimeLeft(product.endDate);
        
        // Create an anchor tag that wraps the card
        const productLink = document.createElement('a');
        productLink.href = `product.html?id=${product._id}`;
        productLink.className = 'product-card-link';

        const productCardHTML = `
            <div class="product-card">
                <div class="product-image">
                    <img src="${product.images?.[0] || 'css/placeholder.png'}" alt="${product.name}">
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    <p class="price">Current Bid: $${product.currentPrice.toFixed(2)}</p>
                    <p class="time-left">${timeLeft}</p>
                    <div class="bid-button-placeholder">View Details</div>
                </div>
            </div>
        `;
        
        productLink.innerHTML = productCardHTML;
        productsGrid.appendChild(productLink);
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

// Toggle advanced filters
function toggleAdvancedFilters() {
    const advancedFilters = document.getElementById('advancedFilters');
    if (advancedFilters) {
        advancedFilters.style.display = advancedFilters.style.display === 'none' ? 'flex' : 'none';
    }
}

// Clear all filters
function clearFilters() {
    const categoryEl = document.getElementById('categoryFilter');
    const sortEl = document.getElementById('priceSort');
    const searchEl = document.getElementById('productSearch');
    const minPriceEl = document.getElementById('minPrice');
    const maxPriceEl = document.getElementById('maxPrice');
    const timeFilterEl = document.getElementById('timeFilter');
    const advancedEl = document.getElementById('advancedFilters');

    if (categoryEl) categoryEl.value = '';
    if (sortEl) sortEl.value = '';
    if (searchEl) searchEl.value = '';
    if (minPriceEl) minPriceEl.value = '';
    if (maxPriceEl) maxPriceEl.value = '';
    if (timeFilterEl) timeFilterEl.value = '';

    filteredProducts = [...allProductsDisplay];
    currentPage = 1;
    displayProductsWithPagination();

    // Hide advanced filters
    if (advancedEl) advancedEl.style.display = 'none';
}

// Search products
function searchProducts() {
    // Sync all search inputs
    const headerSearchInput = document.getElementById('headerProductSearch');
    const productSearchInput = document.getElementById('productSearch');
    const mobileSearchInput = document.querySelector('.mobile-search-input');

    // Get search term from any of the inputs
    const searchTerm = (productSearchInput?.value ||
        headerSearchInput?.value ||
        mobileSearchInput?.value || '').toLowerCase();

    // Sync all inputs
    if (headerSearchInput) headerSearchInput.value = searchTerm;
    if (productSearchInput) productSearchInput.value = searchTerm;
    if (mobileSearchInput) mobileSearchInput.value = searchTerm;

    // Perform the search
    if (searchTerm === '') {
        filteredProducts = [...allProductsDisplay];
    } else {
        filteredProducts = allProductsDisplay.filter(product =>
            product.title.toLowerCase().includes(searchTerm) ||
            product.category.toLowerCase().includes(searchTerm)
        );
    }

    currentPage = 1;
    displayProductsWithPagination();
}

// Filter products by category
function filterProducts() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;

    const category = categoryFilter.value;

    if (category === '') {
        filteredProducts = [...allProductsDisplay];
    } else {
        filteredProducts = allProductsDisplay.filter(product =>
            product.category === category
        );
    }

    // Apply any existing search
    const searchInput = document.getElementById('productSearch');
    if (searchInput) {
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm !== '') {
            filteredProducts = filteredProducts.filter(product =>
                product.title.toLowerCase().includes(searchTerm)
            );
        }
    }

    currentPage = 1;
    displayProductsWithPagination();
}

// Sort products
function sortProducts() {
    const priceSort = document.getElementById('priceSort');
    if (!priceSort) return;

    const sortOption = priceSort.value;

    switch (sortOption) {
        case 'low-high':
            filteredProducts.sort((a, b) => a.currentPrice - b.currentPrice);
            break;
        case 'high-low':
            filteredProducts.sort((a, b) => b.currentPrice - a.currentPrice);
            break;
        case 'ending-soon':
            filteredProducts.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
            break;
        case 'most-bids':
            filteredProducts.sort((a, b) => b.bidCount - a.bidCount);
            break;
        default:
            // Reset to original order
            filteredProducts = [...allProductsDisplay];
            filterProducts(); // Reapply filters
            return;
    }

    currentPage = 1;
    displayProductsWithPagination();
}

// Filter by category from navigation
function filterByCategory(category) {
    // Update active category button
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(btn => {
        btn.classList.remove('active');
        const btnCategory = btn.querySelector('span')?.textContent || '';
        if ((category === '' && btnCategory === 'All') ||
            btnCategory === category) {
            btn.classList.add('active');
        }
    });

    // Update the category filter dropdown to match
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.value = category;
    }

    // Apply the filter
    if (category === '') {
        filteredProducts = [...allProductsDisplay];
    } else {
        filteredProducts = allProductsDisplay.filter(product =>
            product.category === category
        );
    }

    // Reset to first page and display
    currentPage = 1;
    displayProductsWithPagination();

    // Close mobile menu if open
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu && mobileMenu.style.display === 'block') {
        mobileMenu.style.display = 'none';
    }
}

// Search location by text
async function searchLocation() {
    const searchText = document.getElementById('locationSearch');
    if (!searchText) return;

    if (!searchText.value) {
        alert('Please enter a location to search');
        return;
    }

    try {
        // Use Nominatim API for geocoding
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `format=json&q=${encodeURIComponent(searchText.value)}&limit=1`
        );

        const data = await response.json();

        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);

            // Center map on location
            productsMap.setView([lat, lon], 10);

            // Add user location marker
            addUserLocationMarker(lat, lon);

            // Store current location
            currentUserLocation = { lat, lon };
        } else {
            alert('Location not found. Please try a different search.');
        }
    } catch (error) {
        console.error('Search error:', error);
        alert('Error searching location. Please try again.');
    }
}

// Search near user's current location
function searchNearMe() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // Center map on user location
            productsMap.setView([lat, lon], 11);

            // Add user location marker
            addUserLocationMarker(lat, lon);

            // Store current location
            currentUserLocation = { lat, lon };
        },
        (error) => {
            console.error('Geolocation error:', error);
            alert('Could not get your location. Please enable location services and try again.');
        }
    );
}

// Add user location marker
function addUserLocationMarker(lat, lon) {
    // Remove existing user location marker
    if (userLocationMarker) {
        productsMap.removeLayer(userLocationMarker);
    }

    // Custom icon for user location
    const userIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZTc0YzNjIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI4Ii8+PC9zdmc+',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    userLocationMarker = L.marker([lat, lon], { icon: userIcon })
        .bindPopup('<b>Your Location</b>')
        .addTo(productsMap);
}

// Toggle mobile menu
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileUserSection = document.getElementById('mobileUserSection');

    if (mobileMenu.style.display === 'none' || !mobileMenu.style.display) {
        mobileMenu.style.display = 'block';

        // Update mobile user section based on auth status
        if (currentUser && currentUser.status === 'active') {
            mobileUserSection.innerHTML = `
                <div class="mobile-user-info">
                    <div class="user-avatar" style="margin: 0 auto 1rem;">
                        <i class="fas fa-user"></i>
                    </div>
                    <p style="text-align: center; margin-bottom: 1rem;">
                        <strong>${currentUser.fullName}</strong><br>
                         <span style="color: #27ae60; font-size: 0.9rem;">
                            <i class="fas fa-check-circle"></i> Active
                        </span>
                    </p>
                    <button class="btn btn-outline" style="width: 100%; margin-top: 0.5rem;" onclick="logout()">
                        Logout
                    </button>
                </div>
            `;
        } else if (currentUser && currentUser.status === 'pending') {
            mobileUserSection.innerHTML = `
                <div class="pending-user-info">
                    <i class="fas fa-clock"></i> Account Pending Approval
                </div>
                <button class="btn btn-outline" style="width: 100%;" onclick="logout()">
                    Logout
                </button>
            `;
        } else {
            mobileUserSection.innerHTML = `
                <a href="signin.html" class="btn btn-primary" style="width: 100%; margin-bottom: 0.5rem;">
                    Sign In
                </a>
                <a href="signup.html" class="btn btn-secondary" style="width: 100%;">
                    Sign Up
                </a>
            `;
        }
    } else {
        mobileMenu.style.display = 'none';
    }
}

// Toggle user dropdown menu
function toggleUserMenu() {
    const dropdownMenu = document.getElementById('userDropdownMenu');

    if (dropdownMenu.style.display === 'none' || !dropdownMenu.style.display) {
        dropdownMenu.style.display = 'block';

        // Close dropdown when clicking outside
        setTimeout(() => {
            document.addEventListener('click', closeUserMenuOnClickOutside);
        }, 100);
    } else {
        dropdownMenu.style.display = 'none';
        document.removeEventListener('click', closeUserMenuOnClickOutside);
    }
}

// Close user menu when clicking outside
function closeUserMenuOnClickOutside(event) {
    const dropdown = document.querySelector('.user-dropdown');
    if (!dropdown.contains(event.target)) {
        document.getElementById('userDropdownMenu').style.display = 'none';
        document.removeEventListener('click', closeUserMenuOnClickOutside);
    }
}

// Show chat history modal (placeholder for now)
function showChatHistory() {
    const chatModal = document.getElementById('chatHistoryModal');
    if (chatModal) {
        chatModal.style.display = 'flex';
    }
}

// Close chat history modal
function closeChatHistory() {
    const chatModal = document.getElementById('chatHistoryModal');
    if (chatModal) {
        chatModal.style.display = 'none';
    }
}

// Placeholder functions for user menu items
function showMyBids() {
    alert(`My Bids Dashboard

 📊 Active Bids: 5
 🏆 Won Auctions: 2
 ⏰ Ending Soon: 3

 This feature is coming soon!
 You'll be able to:
 • Track all your active bids
 • See outbid notifications
 • View bidding history
 • Manage auto-bidding settings`);
}

function showWatchlist() {
    alert(`My Watchlist

 ❤️ Watched Items: 12
 🔔 Price Alerts: 3
 📈 Trending in Watchlist: Electronics

 This feature is coming soon!
 You'll be able to:
 • Save items to watch
 • Get notifications when bidding starts
 • Set price alerts
 • Organize items into collections`);
}

function showSettings() {
    alert(`Account Settings

 🔔 Notifications: Email & Push
 🌍 Language: English
 💳 Payment Methods: 2 saved
 🔒 Privacy: Standard

 This feature is coming soon!
 You'll be able to:
 • Manage notification preferences
 • Update payment methods
 • Change privacy settings
 • Configure bidding preferences`);
}

// Back to Top Button
function initializeBackToTop() {
    const backToTopButton = document.querySelector('.back-to-top');

    if (backToTopButton) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTopButton.classList.add('active');
            } else {
                backToTopButton.classList.remove('active');
            }
        });

        backToTopButton.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}
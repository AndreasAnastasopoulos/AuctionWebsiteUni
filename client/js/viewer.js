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
            // Map the products to ensure consistent structure
            window.allProducts = response.products.map(product => ({
                _id: product._id,
                name: product.name || product.title || 'Unnamed Item',
                title: product.name || product.title || 'Unnamed Item', // Ensure title exists
                description: product.description || '',
                category: Array.isArray(product.category) ? product.category[0] : (product.category || 'Other'),
                currentPrice: product.currentPrice || product.startingPrice || 0,
                startingPrice: product.startingPrice || 0,
                images: product.images || [],
                endDate: product.endDate || product.auctionEndDate,
                seller: product.seller || {},
                bids: product.bids || [],
                bidCount: product.bids?.length || 0,
                location: product.location
            }));

            allProductsDisplay = [...window.allProducts];
            filteredProducts = [...allProductsDisplay];
            initializeProductsDisplay();
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products. Please refresh the page.');
    }
}

function displayProducts(products) {
    const productsGrid = document.querySelector('.products-grid');
    if (!productsGrid) return;

    productsGrid.innerHTML = '';

    if (!products || products.length === 0) {
        productsGrid.innerHTML = `
            <div class="no-products-message">
                <i class="fas fa-box-open" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <p>No products found matching your criteria.</p>
            </div>`;
        return;
    }

    products.forEach(product => {
        const timeLeft = calculateTimeLeft(product.endDate);
        const isEnded = timeLeft === 'Ended';

        // Create product card element
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.onclick = () => window.location.href = `product.html?id=${product._id}`;
        productCard.style.cursor = 'pointer';

        // Determine image source
        let imageSrc = 'css/placeholder.png';
        if (product.images && product.images.length > 0) {
            // Handle both base64 and URL images
            const firstImage = product.images[0];
            if (firstImage.startsWith('data:') || firstImage.startsWith('http') || firstImage.startsWith('/')) {
                imageSrc = firstImage;
            } else {
                // If it's a relative path, ensure it's properly formatted
                imageSrc = firstImage.startsWith('/') ? firstImage : `/${firstImage}`;
            }
        }

        productCard.innerHTML = `
            <div class="product-image">
                <img src="${imageSrc}" 
                     alt="${product.name || product.title}" 
                     onerror="this.onerror=null; this.src='css/placeholder.png';"
                     style="width: 100%; height: 200px; object-fit: cover;">
                ${isEnded ? '<div class="auction-ended-badge">Ended</div>' : ''}
            </div>
            <div class="product-info">
                <h3 class="product-title">${product.name || product.title}</h3>
                <div class="product-meta">
                    <span class="product-category">
                        <i class="fas fa-tag"></i> ${product.category}
                    </span>
                </div>
                <div class="product-pricing">
                    <p class="current-bid">
                        <span class="label">Current Bid:</span>
                        <span class="price">€${(product.currentPrice || 0).toFixed(2)}</span>
                    </p>
                    ${product.bidCount > 0 ? `
                        <p class="bid-count">
                            <i class="fas fa-gavel"></i> ${product.bidCount} bid${product.bidCount !== 1 ? 's' : ''}
                        </p>
                    ` : ''}
                </div>
                <div class="product-footer">
                    <p class="time-left ${isEnded ? 'ended' : ''}">
                        <i class="fas fa-clock"></i> ${timeLeft}
                    </p>
                    <button class="view-details-btn" onclick="event.stopPropagation(); window.location.href='product.html?id=${product._id}'">
                        View Details <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;

        productsGrid.appendChild(productCard);
    });
}

function calculateTimeLeft(endDate) {
    if (!endDate) return 'No end date';

    const end = new Date(endDate);
    const now = new Date();
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return interval + " years ago";

    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return interval + " months ago";

    interval = Math.floor(seconds / 86400);
    if (interval > 1) return interval + " days ago";

    interval = Math.floor(seconds / 3600);
    if (interval > 1) return interval + " hours ago";

    interval = Math.floor(seconds / 60);
    if (interval > 1) return interval + " minutes ago";

    return "Just now";
}

function showBidModal(productId, currentPrice) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    if (!currentUser) {
        alert('Please sign in to place bids.');
        window.location.href = 'signin.html';
        return;
    }

    if (currentUser.status === 'pending') {
        alert('Your account is pending approval. You cannot place bids yet.');
        return;
    }

    currentProductId = productId;
    document.getElementById('currentPrice').textContent = currentPrice.toFixed(2);
    const bidAmountElement = document.getElementById('bidAmount');
    bidAmountElement.value = '';
    bidAmountElement.min = (currentPrice + 0.01).toFixed(2);
    bidAmountElement.placeholder = `Min: €${(currentPrice + 0.01).toFixed(2)}`;
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
        alert(`Your bid must be a valid number higher than the current bid of €${currentPrice.toFixed(2)}`);
        return;
    }

    const submitBtn = document.querySelector('.bid-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Bid...';

    try {
        const response = await apiCall('/api/bids', {
            method: 'POST',
            body: JSON.stringify({ productId: currentProductId, amount: bidAmount })
        });
        if (response.success) {
            closeBidModal();
            showSuccess('Bid placed successfully!');
            await loadProducts(); // Refresh products to show new price
        }
    } catch (error) {
        showError(error.message || 'Failed to place bid.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Bid';
    }
}

async function loadBidHistory(productId) {
    const bidHistoryContainer = document.getElementById('bidHistory');
    try {
        const response = await apiCall(`/api/bids/product/${productId}`);
        if (response.success && response.bids && response.bids.length > 0) {
            bidHistoryContainer.innerHTML = response.bids.slice(0, 5).map(bid => `
                <div class="bid-history-item">
                    <div>
                        <div class="bid-user">${bid.user?.username || 'Anonymous'}</div>
                        <div class="bid-time">${getTimeAgo(new Date(bid.timestamp))}</div>
                    </div>
                    <div class="bid-amount">€${bid.amount.toFixed(2)}</div>
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

    // Show max 5 page numbers at a time
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    // Add first page and ellipsis if needed
    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.className = 'page-number';
        firstBtn.textContent = '1';
        firstBtn.onclick = () => goToPage(1);
        pageNumbers.appendChild(firstBtn);

        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            pageNumbers.appendChild(ellipsis);
        }
    }

    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
        const button = document.createElement('button');
        button.className = `page-number ${i === currentPage ? 'active' : ''}`;
        button.textContent = i;
        button.onclick = () => goToPage(i);
        pageNumbers.appendChild(button);
    }

    // Add last page and ellipsis if needed
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            pageNumbers.appendChild(ellipsis);
        }

        const lastBtn = document.createElement('button');
        lastBtn.className = 'page-number';
        lastBtn.textContent = totalPages;
        lastBtn.onclick = () => goToPage(totalPages);
        pageNumbers.appendChild(lastBtn);
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
    const minPriceEl = document.getElementById('minPrice');
    const maxPriceEl = document.getElementById('maxPrice');
    const timeFilterEl = document.getElementById('timeFilter');

    let filtered = [...allProductsDisplay];

    // Apply price range filter
    if (minPriceEl && minPriceEl.value) {
        const minPrice = parseFloat(minPriceEl.value);
        filtered = filtered.filter(p => (p.currentPrice || 0) >= minPrice);
    }

    if (maxPriceEl && maxPriceEl.value) {
        const maxPrice = parseFloat(maxPriceEl.value);
        filtered = filtered.filter(p => (p.currentPrice || 0) <= maxPrice);
    }

    // Apply time filter
    if (timeFilterEl && timeFilterEl.value) {
        const days = parseInt(timeFilterEl.value);
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + days);

        filtered = filtered.filter(p => {
            const endDate = new Date(p.endDate);
            return endDate <= maxDate && endDate > new Date();
        });
    }

    filteredProducts = filtered;
    currentPage = 1;
    displayProductsWithPagination();

    // Apply any existing sort
    const priceSort = document.getElementById('priceSort');
    if (priceSort && priceSort.value) {
        sortProducts();
    }
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
    } else if (mapVisible && productsMap) {
        productsMap.invalidateSize();
    }
}

function initProductsMap() {
    if (productsMap) return;
    productsMap = L.map('products-map').setView([37.9838, 23.7275], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(productsMap);
}

function addProductMarkersToMap(products) {
    if (!productsMap) return;

    // Clear existing markers
    productMarkers.forEach(marker => productsMap.removeLayer(marker));
    productMarkers = [];

    products.forEach(product => {
        if (product.location) {
            let lat, lng;

            // Handle different location formats
            if (product.seller?.location?.coordinates) {
                [lng, lat] = product.seller.location.coordinates;
            } else if (typeof product.location === 'string' && product.location.includes(',')) {
                [lat, lng] = product.location.split(',').map(coord => parseFloat(coord.trim()));
            }

            if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                const marker = L.marker([lat, lng])
                    .bindPopup(`
                        <div style="text-align: center;">
                            <h4>${product.name || product.title}</h4>
                            <p>€${(product.currentPrice || 0).toFixed(2)}</p>
                            <a href="product.html?id=${product._id}" style="color: #3498db;">View Details</a>
                        </div>
                    `);
                marker.addTo(productsMap);
                productMarkers.push(marker);
            }
        }
    });

    if (productMarkers.length > 0) {
        const group = L.featureGroup(productMarkers);
        productsMap.fitBounds(group.getBounds().pad(0.1));
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();

    // Initialize back to top button
    const backToTopButton = document.querySelector('.back-to-top');
    if (backToTopButton) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTopButton.style.display = 'block';
            } else {
                backToTopButton.style.display = 'none';
            }
        });

        backToTopButton.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Set up enter key for search
    const searchInput = document.getElementById('headerProductSearch');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchProducts();
            }
        });
    }
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
    const minPriceEl = document.getElementById('minPrice');
    const maxPriceEl = document.getElementById('maxPrice');
    const timeFilterEl = document.getElementById('timeFilter');
    const priceSortEl = document.getElementById('priceSort');
    const searchEl = document.getElementById('headerProductSearch');
    const advancedEl = document.getElementById('advancedFilters');

    if (minPriceEl) minPriceEl.value = '';
    if (maxPriceEl) maxPriceEl.value = '';
    if (timeFilterEl) timeFilterEl.value = '';
    if (priceSortEl) priceSortEl.value = '';
    if (searchEl) searchEl.value = '';

    filteredProducts = [...allProductsDisplay];
    currentPage = 1;
    displayProductsWithPagination();

    // Hide advanced filters
    if (advancedEl) advancedEl.style.display = 'none';
}

// Search products
function searchProducts() {
    const headerSearchInput = document.getElementById('headerProductSearch');
    const searchTerm = (headerSearchInput?.value || '').toLowerCase();

    if (searchTerm === '') {
        filteredProducts = [...allProductsDisplay];
    } else {
        filteredProducts = allProductsDisplay.filter(product => {
            const name = (product.name || product.title || '').toLowerCase();
            const description = (product.description || '').toLowerCase();
            const category = (product.category || '').toLowerCase();

            return name.includes(searchTerm) ||
                description.includes(searchTerm) ||
                category.includes(searchTerm);
        });
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
// Sort products
function sortProducts() {
    const priceSort = document.getElementById('priceSort');
    if (!priceSort) return;

    const sortOption = priceSort.value;

    switch (sortOption) {
        case 'low-high':
            filteredProducts.sort((a, b) => (a.currentPrice || 0) - (b.currentPrice || 0));
            break;
        case 'high-low':
            filteredProducts.sort((a, b) => (b.currentPrice || 0) - (a.currentPrice || 0));
            break;
        case 'ending-soon':
            filteredProducts.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
            break;
        case 'most-bids':
            filteredProducts.sort((a, b) => (b.bidCount || 0) - (a.bidCount || 0));
            break;
        default:
            // Reset to original order
            filteredProducts = [...allProductsDisplay];
            searchProducts(); // Reapply search if any
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
        const btnText = btn.querySelector('span')?.textContent || '';
        if ((category === '' && btnText === 'All') || btnText === category) {
            btn.classList.add('active');
        }
    });

    // Apply the filter
    if (category === '') {
        filteredProducts = [...allProductsDisplay];
    } else {
        filteredProducts = allProductsDisplay.filter(product => {
            const productCategory = Array.isArray(product.category) ?
                product.category[0] : product.category;
            return productCategory === category;
        });
    }

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
    alert('My Bids feature coming soon!');
}

function showWatchlist() {
    alert('Watchlist feature coming soon!');
}

function showSettings() {
    alert('Settings feature coming soon!');
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

// Helper functions
function showSuccess(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-success';
    alert.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 3000);
}

function showError(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-error';
    alert.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    document.body.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 5000);
}
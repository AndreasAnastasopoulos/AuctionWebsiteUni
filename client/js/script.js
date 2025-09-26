// Complete script.js for PAREDŌSE Auction Site

// API Configuration
const API_URL = 'http://localhost:5001/api';
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let currentProductId = null;

// Map variables
let signupMap = null;
let signupMarker = null;
let productsMap = null;
let productMarkers = [];
let mapVisible = false;
let userLocationMarker = null;
let searchRadius = 50;
let currentUserLocation = null;
let radiusCircle = null;

// Navigation Functions for Multi-page Structure
function showWelcome() {
    window.location.href = 'index.html';
}

function showWaiting() {
    window.location.href = 'waiting.html';
}

function showViewer() {
    window.location.href = 'viewer.html';
}

function showSignIn() {
    window.location.href = 'signin.html';
}

function showSignUp() {
    window.location.href = 'signup.html';
}

// API Helper Functions
const apiCall = async (endpoint, options = {}) => {
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    // Add auth token if available
    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// Authentication Functions
async function handleSignUp(event) {
    event.preventDefault();

    // Get form values
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const fullName = document.getElementById('signup-fullname').value;
    const email = document.getElementById('signup-email').value;
    const phone = document.getElementById('signup-phone').value;

    // Get address components
    const streetName = document.getElementById('signup-address').value;
    const streetNumber = document.getElementById('signup-address-number').value;
    const cityCountry = document.getElementById('signup-city-country').value;
    const address = `${streetName}, ${streetNumber}, ${cityCountry}`;

    const ssn = document.getElementById('signup-ssn').value;

    // Get coordinates if map is present
    const latitude = document.getElementById('signup-latitude')?.value;
    const longitude = document.getElementById('signup-longitude')?.value;

    // Validate passwords match
    if (password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
    }

    // Prepare request body
    const requestBody = {
        username,
        password,
        fullName,
        email,
        phone,
        address,
        ssn
    };

    // Add location if coordinates are available
    if (latitude && longitude) {
        requestBody.location = {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
            address: address
        };
    }

    console.log('Signup request body:', requestBody);

    try {
        const response = await apiCall('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        console.log('Signup response:', response);

        if (response.success) {
            // Redirect to waiting page
            showWaiting();
        }
    } catch (error) {
        console.error('Signup error details:', error);
        // Show error message
        const usernameError = document.getElementById('usernameError');
        if (error.message.includes('already exists')) {
            if (usernameError) usernameError.style.display = 'block';
        } else {
            alert(error.message);
        }
    }
}

async function handleSignIn(event) {
    event.preventDefault();

    const username = document.getElementById('signin-username').value;
    const password = document.getElementById('signin-password').value;

    try {
        const response = await apiCall('/auth/signin', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (response.success) {
            // Store token and user info
            authToken = response.token;
            currentUser = response.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            // Check user status
            if (currentUser.status === 'pending') {
                alert('Your account is pending approval. Please wait for admin verification.');
                showViewer();
            } else if (currentUser.status === 'active') {
                // Redirect based on role
                if (currentUser.role === 'admin') {
                    window.location.href = '../admin-dashboard.html';
                } else {
                    showViewer(); // Redirect to viewer page which will show authenticated content
                }
            }
        }
    } catch (error) {
        alert('Invalid username or password');
    }
}

// Product Functions
async function loadProducts(isViewer = false) {
    try {
        const response = await apiCall('/products');

        if (response.success) {
            displayProducts(response.products, isViewer);
            // Store products globally for map functions
            window.allProducts = response.products;
        }
    } catch (error) {
        console.error('Error loading products:', error);
        // Display message if no products or error
        const productsGrid = document.querySelector('.products-grid');
        if (productsGrid) {
            productsGrid.innerHTML = '<p class="no-products">No active auctions at the moment.</p>';
        }
    }
}

function displayProducts(products, isViewer = false) {
    const productsGrid = document.querySelector('.products-grid');
    if (!productsGrid) return; // Exit if element doesn't exist

    productsGrid.innerHTML = '';

    if (!products || products.length === 0) {
        productsGrid.innerHTML = '<p class="no-products">No active auctions at the moment.</p>';
        return;
    }

    products.forEach(product => {
        const timeLeft = calculateTimeLeft(product.endDate);
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-image">${product.images && product.images[0] ?
                `<img src="${product.images[0]}" alt="${product.title}">` :
                'Product Image'}</div>
            <div class="product-info">
                <h3 class="product-title">${product.title}</h3>
                <div class="product-category">${product.category}</div>
                <div class="current-bid">$${product.currentPrice.toFixed(2)}</div>
                <div class="bid-info">
                    Current bid • ${product.bidCount} bid${product.bidCount !== 1 ? 's' : ''} • ${timeLeft}
                </div>
                ${!isViewer && currentUser?.status === 'active' ?
                `<button class="btn btn-primary btn-sm" onclick="showBidModal('${product._id}', ${product.currentPrice})">
                        Place Bid
                    </button>` : ''
            }
            </div>
        `;
        productsGrid.appendChild(productCard);
    });
}

// Bid Modal Functions
function showBidModal(productId, currentPrice) {
    currentProductId = productId;
    const currentPriceElement = document.getElementById('currentPrice');
    const bidAmountElement = document.getElementById('bidAmount');
    const bidModal = document.getElementById('bidModal');

    if (currentPriceElement) currentPriceElement.textContent = currentPrice.toFixed(2);
    if (bidAmountElement) {
        bidAmountElement.value = '';
        bidAmountElement.min = (currentPrice + 0.01).toFixed(2);
    }
    if (bidModal) bidModal.style.display = 'block';
}

function closeBidModal() {
    const bidModal = document.getElementById('bidModal');
    if (bidModal) bidModal.style.display = 'none';
    currentProductId = null;
}

async function submitBid() {
    const bidAmountElement = document.getElementById('bidAmount');
    if (!bidAmountElement) return;

    const bidAmount = parseFloat(bidAmountElement.value);

    if (!bidAmount || isNaN(bidAmount)) {
        alert('Please enter a valid bid amount');
        return;
    }

    try {
        const response = await apiCall('/bids', {
            method: 'POST',
            body: JSON.stringify({
                productId: currentProductId,
                amount: bidAmount
            })
        });

        if (response.success) {
            alert('Bid placed successfully!');
            closeBidModal();
            loadProducts(); // Reload products to show updated price
        }
    } catch (error) {
        alert(error.message || 'Failed to place bid');
    }
}

// Utility Functions
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

// Update header for authenticated users
function updateAuthenticatedHeader() {
    const headerRight = document.getElementById('headerRight');

    if (headerRight && currentUser && currentUser.status === 'active') {
        headerRight.innerHTML = `
            <div class="user-menu">
                <span>Welcome, ${currentUser.fullName}</span>
                <button class="btn btn-sm" onclick="showMyAccount()">My Account</button>
                <button class="btn btn-sm" onclick="logout()">Logout</button>
            </div>
        `;
    }
}

// Logout function
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    authToken = null;
    currentUser = null;
    showWelcome();
}

// My Account function (placeholder)
function showMyAccount() {
    alert('My Account page coming soon! Here you will be able to:\n- View your active bids\n- See won auctions\n- Update your profile\n- View purchase history');
}

// MAP FUNCTIONS SECTION

// Initialize signup map when showing signup page
function initSignupMap() {
    // Check if map container exists
    const mapContainer = document.getElementById('signup-map');
    if (!mapContainer) return;

    // Initialize map centered on Greece if not already initialized
    if (!signupMap) {
        signupMap = L.map('signup-map').setView([37.9838, 23.7275], 6);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(signupMap);

        // Add click event to map
        signupMap.on('click', function (e) {
            setUserLocation(e.latlng.lat, e.latlng.lng);
        });
    }

    // Fix map display issues
    setTimeout(() => {
        signupMap.invalidateSize();
    }, 100);
}

// Set user location on map
function setUserLocation(lat, lng) {
    // Remove existing marker
    if (signupMarker) {
        signupMap.removeLayer(signupMarker);
    }

    // Add new marker
    signupMarker = L.marker([lat, lng], {
        draggable: true
    }).addTo(signupMap);

    // Update marker position on drag
    signupMarker.on('dragend', function (e) {
        const position = e.target.getLatLng();
        updateLocationDisplay(position.lat, position.lng);
    });

    // Update display
    updateLocationDisplay(lat, lng);

    // Center map on marker
    signupMap.setView([lat, lng], 13);
}

// Update location display
function updateLocationDisplay(lat, lng) {
    const coordsElement = document.getElementById('selected-coords');
    const latInput = document.getElementById('signup-latitude');
    const lngInput = document.getElementById('signup-longitude');

    if (coordsElement) coordsElement.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    if (latInput) latInput.value = lat;
    if (lngInput) lngInput.value = lng;
}

// Geocode address using Nominatim (OpenStreetMap)
async function geocodeAddress() {
    const streetName = document.getElementById('signup-address').value;
    const streetNumber = document.getElementById('signup-address-number').value;
    const cityCountry = document.getElementById('signup-city-country').value;

    if (!streetName || !cityCountry) {
        alert('Please enter address and city/country first');
        return;
    }

    const fullAddress = `${streetNumber} ${streetName}, ${cityCountry}`;

    try {
        // Use Nominatim API for geocoding
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `format=json&q=${encodeURIComponent(fullAddress)}&limit=1`
        );

        const data = await response.json();

        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            setUserLocation(lat, lon);
        } else {
            alert('Could not find this address. Please click on the map to set your location manually.');
        }
    } catch (error) {
        console.error('Geocoding error:', error);
        alert('Error finding address. Please set your location manually on the map.');
    }
}

// Get current location using browser geolocation
function getCurrentLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            setUserLocation(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
            console.error('Geolocation error:', error);
            alert('Could not get your location. Please set it manually on the map.');
        }
    );
}

// Pagination and filtering variables
let currentPage = 1;
const productsPerPage = 9;
let filteredProducts = [];
let allProductsDisplay = [];

// Sample products data (for testing without backend)
const sampleProducts = [
    {
        _id: '1',
        title: 'Vintage Leica Camera',
        category: 'Electronics',
        currentPrice: 850,
        startingPrice: 500,
        bidCount: 15,
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        seller: { username: 'john_collector' }
    },
    {
        _id: '2',
        title: 'Abstract Oil Painting',
        category: 'Art',
        currentPrice: 1200,
        startingPrice: 800,
        bidCount: 8,
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        seller: { username: 'art_dealer' }
    },
    {
        _id: '3',
        title: 'Antique Gold Watch',
        category: 'Jewelry',
        currentPrice: 2500,
        startingPrice: 1500,
        bidCount: 23,
        endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        seller: { username: 'luxury_items' }
    },
    {
        _id: '4',
        title: 'First Edition Hemingway',
        category: 'Books',
        currentPrice: 450,
        startingPrice: 200,
        bidCount: 12,
        endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        seller: { username: 'rare_books' }
    },
    {
        _id: '5',
        title: 'Vintage Baseball Cards',
        category: 'Collectibles',
        currentPrice: 780,
        startingPrice: 300,
        bidCount: 19,
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        seller: { username: 'sports_memorabilia' }
    },
    {
        _id: '6',
        title: 'Designer Handbag',
        category: 'Fashion',
        currentPrice: 1800,
        startingPrice: 1200,
        bidCount: 6,
        endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        seller: { username: 'fashion_house' }
    },
    {
        _id: '7',
        title: 'Gaming Console Bundle',
        category: 'Electronics',
        currentPrice: 520,
        startingPrice: 400,
        bidCount: 14,
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        seller: { username: 'tech_store' }
    },
    {
        _id: '8',
        title: 'Antique Tea Set',
        category: 'Home',
        currentPrice: 340,
        startingPrice: 150,
        bidCount: 9,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        seller: { username: 'antique_shop' }
    },
    {
        _id: '9',
        title: 'Signed Basketball',
        category: 'Sports',
        currentPrice: 950,
        startingPrice: 500,
        bidCount: 11,
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        seller: { username: 'sports_memorabilia' }
    },
    {
        _id: '10',
        title: 'Vintage Vinyl Records',
        category: 'Collectibles',
        currentPrice: 280,
        startingPrice: 100,
        bidCount: 7,
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        seller: { username: 'music_collector' }
    },
    {
        _id: '11',
        title: 'Diamond Necklace',
        category: 'Jewelry',
        currentPrice: 4500,
        startingPrice: 3000,
        bidCount: 17,
        endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        seller: { username: 'luxury_items' }
    },
    {
        _id: '12',
        title: 'Rare Comic Book',
        category: 'Books',
        currentPrice: 1100,
        startingPrice: 600,
        bidCount: 21,
        endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        seller: { username: 'comic_store' }
    }
];

// Initialize products display
function initializeProductsDisplay() {
    // Use sample products if no products from backend
    if (!window.allProducts || window.allProducts.length === 0) {
        window.allProducts = sampleProducts;
    }

    allProductsDisplay = [...window.allProducts];
    filteredProducts = [...allProductsDisplay];
    displayProductsWithPagination();
}

// Display products with pagination
function displayProductsWithPagination() {
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const productsToShow = filteredProducts.slice(startIndex, endIndex);

    displayProducts(productsToShow, false);
    updatePagination();
    updateResultsInfo();
}

// Update pagination controls
function updatePagination() {
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    const pageNumbers = document.getElementById('pageNumbers');

    if (!pageNumbers) return; // Exit if element doesn't exist

    // Clear existing page numbers
    pageNumbers.innerHTML = '';

    // Calculate page range to show
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    // Add first page and ellipsis if needed
    if (startPage > 1) {
        addPageNumber(1);
        if (startPage > 2) {
            pageNumbers.innerHTML += '<span class="page-ellipsis">...</span>';
        }
    }

    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
        addPageNumber(i);
    }

    // Add last page and ellipsis if needed
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pageNumbers.innerHTML += '<span class="page-ellipsis">...</span>';
        }
        addPageNumber(totalPages);
    }

    // Update prev/next buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// Add page number button
function addPageNumber(pageNum) {
    const pageNumbers = document.getElementById('pageNumbers');
    if (!pageNumbers) return;

    const button = document.createElement('button');
    button.className = `page-number ${pageNum === currentPage ? 'active' : ''}`;
    button.textContent = pageNum;
    button.onclick = () => goToPage(pageNum);
    pageNumbers.appendChild(button);
}

// Navigate to specific page
function goToPage(page) {
    currentPage = page;
    displayProductsWithPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Previous page
function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        displayProductsWithPagination();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Next page
function nextPage() {
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayProductsWithPagination();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Update results info
function updateResultsInfo() {
    const startIndex = (currentPage - 1) * productsPerPage + 1;
    const endIndex = Math.min(currentPage * productsPerPage, filteredProducts.length);

    const showingCount = document.getElementById('showingCount');
    const totalCount = document.getElementById('totalCount');

    if (showingCount) {
        showingCount.textContent = filteredProducts.length > 0 ? `${startIndex}-${endIndex}` : '0';
    }
    if (totalCount) {
        totalCount.textContent = filteredProducts.length;
    }
}

// Search products
function searchProducts() {
    const searchInput = document.getElementById('productSearch');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase();

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

// Toggle advanced filters
function toggleAdvancedFilters() {
    const advancedFilters = document.getElementById('advancedFilters');
    if (advancedFilters) {
        advancedFilters.style.display = advancedFilters.style.display === 'none' ? 'flex' : 'none';
    }
}

// Apply advanced filters
function applyFilters() {
    const minPriceEl = document.getElementById('minPrice');
    const maxPriceEl = document.getElementById('maxPrice');
    const timeFilterEl = document.getElementById('timeFilter');
    const categoryEl = document.getElementById('categoryFilter');
    const searchEl = document.getElementById('productSearch');

    const minPrice = minPriceEl ? parseFloat(minPriceEl.value) || 0 : 0;
    const maxPrice = maxPriceEl ? parseFloat(maxPriceEl.value) || Infinity : Infinity;
    const timeFilter = timeFilterEl ? timeFilterEl.value : '';
    const category = categoryEl ? categoryEl.value : '';
    const searchTerm = searchEl ? searchEl.value.toLowerCase() : '';

    // Start with all products
    filteredProducts = allProductsDisplay.filter(product => {
        // Price filter
        if (product.currentPrice < minPrice || product.currentPrice > maxPrice) {
            return false;
        }

        // Time filter
        if (timeFilter) {
            const daysLeft = Math.ceil((new Date(product.endDate) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysLeft > parseInt(timeFilter)) {
                return false;
            }
        }

        // Category filter
        if (category && product.category !== category) {
            return false;
        }

        // Search filter
        if (searchTerm && !product.title.toLowerCase().includes(searchTerm) &&
            !product.category.toLowerCase().includes(searchTerm)) {
            return false;
        }

        return true;
    });

    // Apply current sort
    const sortEl = document.getElementById('priceSort');
    if (sortEl && sortEl.value) {
        sortProducts();
    } else {
        currentPage = 1;
        displayProductsWithPagination();
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

// Update the existing loadProducts function
const originalLoadProducts = loadProducts;
async function loadProducts(isViewer = false) {
    try {
        await originalLoadProducts(isViewer);
        initializeProductsDisplay();
    } catch (error) {
        console.error('Error loading products:', error);
        // Use sample products as fallback
        window.allProducts = sampleProducts;
        initializeProductsDisplay();
    }
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

// PRODUCTS MAP FUNCTIONS
function toggleMapView() {
    const mapSection = document.getElementById('mapSection');
    const toggleText = document.getElementById('mapToggleText');

    if (mapVisible) {
        if (mapSection) mapSection.style.display = 'none';
        if (toggleText) toggleText.textContent = 'Show Map';
        mapVisible = false;
    } else {
        if (mapSection) mapSection.style.display = 'block';
        if (toggleText) toggleText.textContent = 'Hide Map';
        mapVisible = true;

        // Initialize map if not already done
        if (!productsMap) {
            setTimeout(() => {
                initProductsMap();
                if (window.allProducts) {
                    addProductMarkersToMap(window.allProducts);
                }
            }, 100);
        } else {
            // Refresh map size
            productsMap.invalidateSize();
        }
    }
}

// Initialize products map
function initProductsMap() {
    const mapContainer = document.getElementById('products-map');
    if (!mapContainer) return;

    // Initialize map centered on Greece
    productsMap = L.map('products-map').setView([37.9838, 23.7275], 6);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(productsMap);
}

// Add product markers to map
function addProductMarkersToMap(products) {
    if (!productsMap) return;

    // Clear existing product markers
    productMarkers.forEach(marker => productsMap.removeLayer(marker));
    productMarkers = [];

    // Custom icon for products
    const productIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMzQ5OGRiIj48cGF0aCBkPSJNMTIgMkM4LjEzIDIgNSA1LjEzIDUgOWMwIDUuMjUgNyAxMyA3IDEzczctNy43NSA3LTEzYzAtMy44Ny0zLjEzLTctNy03em0wIDkuNWMtMS4zOCAwLTIuNS0xLjEyLTIuNS0yLjVzMS4xMi0yLjUgMi41LTIuNSAyLjUgMS4xMiAyLjUgMi41LTEuMTIgMi41LTIuNSAyLjV6Ii8+PC9zdmc+',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

    // Add marker for each product with location
    products.forEach(product => {
        if (product.seller?.location?.coordinates) {
            const [lng, lat] = product.seller.location.coordinates;

            // Create popup content
            const popupContent = `
                <div class="map-popup-product">
                    <h4>${product.title}</h4>
                    <div class="price">${product.currentPrice.toFixed(2)}</div>
                    <div class="category">${product.category}</div>
                    <div class="seller">Seller: ${product.seller.username || 'Unknown'}</div>
                    ${currentUser && currentUser.status === 'active' ?
                    `<button class="btn btn-primary btn-sm" onclick="showBidModal('${product._id}', ${product.currentPrice})">
                            Place Bid
                        </button>` :
                    '<p style="font-size: 0.8rem; margin-top: 0.5rem; text-align: center; color: #666;">Sign in to bid</p>'
                }
                </div>
            `;

            const marker = L.marker([lat, lng], { icon: productIcon })
                .bindPopup(popupContent, { maxWidth: 250 });

            marker.addTo(productsMap);
            productMarkers.push(marker);

            // Store product ID with marker for filtering
            marker.productId = product._id;
        }
    });

    // Fit map to show all markers if there are any
    if (productMarkers.length > 0) {
        const group = L.featureGroup(productMarkers);
        productsMap.fitBounds(group.getBounds().pad(0.1));
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

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Page-specific initialization
document.addEventListener('DOMContentLoaded', () => {
    // Get current page
    const currentPath = window.location.pathname;
    const pageName = currentPath.substring(currentPath.lastIndexOf('/') + 1);

    // Initialize common features
    initializeBackToTop();

    // Page-specific initialization
    switch (pageName) {
        case 'viewer.html':
            // Initialize viewer page
            if (authToken && currentUser) {
                updateAuthenticatedHeader();
            }
            // Load products with sample data
            window.allProducts = sampleProducts;
            initializeProductsDisplay();

            // Add enter key support for search
            const searchInput = document.getElementById('productSearch');
            if (searchInput) {
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        searchProducts();
                    }
                });
            }
            break;

        case 'signup.html':
            // Initialize signup map
            initSignupMap();
            break;

        case 'signin.html':
            // Check if user is already logged in
            if (authToken && currentUser) {
                if (currentUser.status === 'active') {
                    showViewer();
                }
            }
            break;

        case 'waiting.html':
            // Nothing specific to initialize
            break;

        case 'index.html':
        case '':
            // Welcome page - check authentication
            if (authToken && currentUser) {
                // Check if user is pending
                if (currentUser.status === 'pending') {
                    showViewer();
                } else if (currentUser.status === 'active') {
                    // Verify token for active users
                    apiCall('/users/profile')
                        .then(response => {
                            if (response.success) {
                                if (response.user && response.user.status === 'active') {
                                    showViewer();
                                }
                            }
                        })
                        .catch(() => {
                            // Token invalid, clear storage
                            logout();
                        });
                }
            }
            break;
    }
});

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('bidModal');
    if (modal && event.target === modal) {
        closeBidModal();
    }
}
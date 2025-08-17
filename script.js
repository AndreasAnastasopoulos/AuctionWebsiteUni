// Complete script.js for PAREDÓSE Auction Site

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

// Page navigation functions
function showWelcome() {
    hideAllPages();
    document.getElementById('welcomePage').style.display = 'flex';
}

function showSignIn() {
    hideAllPages();
    document.getElementById('signInPage').style.display = 'flex';
}

function showSignUp() {
    hideAllPages();
    document.getElementById('signUpPage').style.display = 'flex';
    document.getElementById('usernameError').style.display = 'none';
    // Initialize map after showing signup page
    setTimeout(() => {
        initSignupMap();
    }, 100);
}

function showViewer() {
    hideAllPages();
    document.getElementById('viewerPage').style.display = 'block';

    // Reset header for guest viewers
    const headerRight = document.getElementById('headerRight');
    if (headerRight) {
        headerRight.innerHTML = '<div class="viewer-notice">Viewing as Guest</div>';
    }

    // Show CTA for guests
    const viewerCta = document.querySelector('.viewer-cta');
    if (viewerCta) {
        viewerCta.style.display = 'block';
    }

    // Clear existing products
    const productsGrid = document.querySelector('.products-grid');
    if (productsGrid) {
        productsGrid.innerHTML = '<p class="no-products">Loading auctions...</p>';
    }

    // Load products for viewer after a short delay
    setTimeout(() => {
        loadProducts(true); // Load products for viewer
    }, 100);
}

function showWaiting() {
    hideAllPages();
    document.getElementById('waitingPage').style.display = 'flex';
}

function hideAllPages() {
    document.getElementById('welcomePage').style.display = 'none';
    document.getElementById('signInPage').style.display = 'none';
    document.getElementById('signUpPage').style.display = 'none';
    document.getElementById('waitingPage').style.display = 'none';
    document.getElementById('viewerPage').style.display = 'none';
}

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

    console.log('Signup request body:', requestBody); // Add this line

    try {
        const response = await apiCall('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        console.log('Signup response:', response); // Add this line

        if (response.success) {
            // Show waiting page
            showWaiting();
        }
    } catch (error) {
        console.error('Signup error details:', error); // Add this line
        // Show error message
        if (error.message.includes('already exists')) {
            document.getElementById('usernameError').style.display = 'block';
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
                showWelcome();
            } else if (currentUser.status === 'active') {
                // Redirect based on role
                if (currentUser.role === 'admin') {
                    window.location.href = 'client/admin-dashboard.html';
                } else {
                    showAuctionPage();
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
        productsGrid.innerHTML = '<p class="no-products">No active auctions at the moment.</p>';
    }
}

function displayProducts(products, isViewer = false) {
    const productsGrid = document.querySelector('.products-grid');
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
    document.getElementById('currentPrice').textContent = currentPrice.toFixed(2);
    document.getElementById('bidAmount').value = '';
    document.getElementById('bidAmount').min = (currentPrice + 0.01).toFixed(2);
    document.getElementById('bidModal').style.display = 'block';
}

function closeBidModal() {
    document.getElementById('bidModal').style.display = 'none';
    currentProductId = null;
}

async function submitBid() {
    const bidAmount = parseFloat(document.getElementById('bidAmount').value);

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

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('bidModal');
    if (event.target === modal) {
        closeBidModal();
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

// Show auction page for authenticated users
function showAuctionPage() {
    console.log('showAuctionPage called, currentUser:', currentUser);

    hideAllPages();
    document.getElementById('viewerPage').style.display = 'block';

    // Try to update immediately
    const headerRight = document.getElementById('headerRight');
    console.log('headerRight element:', headerRight);

    if (headerRight) {
        headerRight.innerHTML = `
            <div class="user-menu">
                <span>Welcome, ${currentUser.fullName}</span>
                <button class="btn btn-sm" onclick="showMyAccount()">My Account</button>
                <button class="btn btn-sm" onclick="logout()">Logout</button>
            </div>
        `;
        console.log('Header updated successfully');
    } else {
        console.error('headerRight not found!');
    }

    // Hide CTA for signed-in users
    const viewerCta = document.querySelector('.viewer-cta');
    if (viewerCta) {
        viewerCta.style.display = 'none';
    }

    // Load products
    loadProducts(false);
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

// Back to Top Button
document.addEventListener('DOMContentLoaded', () => {
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

    // Check authentication on page load
    if (authToken && currentUser) {
        // Check if user is pending
        if (currentUser.status === 'pending') {
            // Pending users stay on viewer page
            showViewer();
            return;
        }

        // Only verify token for active users
        apiCall('/users/profile')
            .then(response => {
                if (response.success) {
                    if (response.user && response.user.status === 'active') {
                        showAuctionPage();
                    } else if (response.user && response.user.status === 'pending') {
                        // User is still pending, show viewer page
                        showViewer();
                    }
                }
            })
            .catch(() => {
                // Token invalid, clear storage
                logout();
            });
    }
});

// PRODUCTS MAP FUNCTIONS

// Toggle map visibility
function toggleMapView() {
    const mapSection = document.getElementById('mapSection');
    const toggleText = document.getElementById('mapToggleText');

    if (mapVisible) {
        mapSection.style.display = 'none';
        toggleText.textContent = 'Show Map';
        mapVisible = false;
    } else {
        mapSection.style.display = 'block';
        toggleText.textContent = 'Hide Map';
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
    const searchText = document.getElementById('locationSearch').value;

    if (!searchText) {
        alert('Please enter a location to search');
        return;
    }

    try {
        // Use Nominatim API for geocoding
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `format=json&q=${encodeURIComponent(searchText)}&limit=1`
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
// API Configuration
const API_URL = 'https://localhost:5001/api';
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

// Pagination and filtering variables
let currentPage = 1;
const productsPerPage = 9;
let filteredProducts = [];
let allProductsDisplay = [];

// API Helper Functions
async function apiCall(endpoint, options = {}) {
    const baseURL = 'http://localhost:5001/api';

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        }
    };

    // Add auth token if available
    if (authToken) {
        defaultOptions.headers.Authorization = `Bearer ${authToken}`;
    }

    const finalOptions = { ...defaultOptions, ...options };

    console.log('Making API call to:', `${baseURL}${endpoint}`);
    console.log('Request options:', finalOptions);

    try {
        const response = await fetch(`${baseURL}${endpoint}`, finalOptions);

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        // Get response text first to see raw response
        const responseText = await response.text();
        console.log('Raw response:', responseText);

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            let errorData = null;

            try {
                // Try to parse as JSON
                errorData = JSON.parse(responseText);
                console.log('Parsed error data:', errorData);
                errorMessage = errorData.message || errorData.error || errorData.details || errorMessage;
            } catch (jsonError) {
                console.log('Response is not valid JSON');
                errorMessage = responseText || errorMessage;
            }

            throw new Error(errorMessage);
        }

        // Try to parse successful response as JSON
        try {
            return JSON.parse(responseText);
        } catch (jsonError) {
            console.log('Successful response is not JSON:', responseText);
            return { success: true, data: responseText };
        }

    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Authentication Functions
async function handleSignUp(event) {
    event.preventDefault();

    try {
        // Get form values
        const username = document.getElementById('signup-username').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        const fullName = document.getElementById('signup-fullname').value.trim();
        const email = document.getElementById('signup-email').value.trim().toLowerCase();
        const phone = document.getElementById('signup-phone').value.trim();

        // Get address components
        const streetName = document.getElementById('signup-address').value.trim();
        const streetNumber = document.getElementById('signup-address-number').value.trim();
        const cityCountry = document.getElementById('signup-city-country').value.trim();
        const address = `${streetName}, ${streetNumber}, ${cityCountry}`;

        const ssn = document.getElementById('signup-ssn').value.trim();

        // Get coordinates if map is present
        const latitude = document.getElementById('signup-latitude')?.value;
        const longitude = document.getElementById('signup-longitude')?.value;

        // Validate required fields
        if (!username || !password || !fullName || !email || !phone || !streetName || !streetNumber || !cityCountry || !ssn) {
            alert('Please fill in all required fields');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address');
            return;
        }

        // Validate password length
        if (password.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
        }

        // Validate passwords match
        if (password !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }

        // Split full name into first and last name
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        if (!firstName) {
            alert('Please enter your full name (first and last name)');
            return;
        }

        // Extract country from cityCountry (assume format: "City, Country")
        const countryPart = cityCountry.split(',').pop().trim();
        if (!countryPart) {
            alert('Please enter city and country in format: "City, Country"');
            return;
        }

        // Prepare request body
        const requestBody = {
            username,
            email,
            password,
            firstName,
            lastName,
            phone,
            address,
            country: countryPart,
            ssn
        };

        // Add location if coordinates are available
        if (latitude && longitude && latitude !== '' && longitude !== '') {
            requestBody.location = {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)],
                address: address
            };
        }

        console.log('Signup request body:', requestBody);

        // Clear any previous error messages
        const usernameError = document.getElementById('usernameError');
        if (usernameError) usernameError.style.display = 'none';

        const response = await apiCall('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        console.log('Signup response:', response);

        if (response.success) {
            alert('Account created successfully! Please wait for admin approval.');
            // Redirect to sign in page or waiting page
            window.location.href = 'index.html';
        }

    } catch (error) {
        console.error('Signup error details:', error);

        // Show specific error messages
        const usernameError = document.getElementById('usernameError');
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('username') && errorMessage.includes('exists')) {
            if (usernameError) usernameError.style.display = 'block';
        } else if (errorMessage.includes('email') && errorMessage.includes('exists')) {
            alert('Email address is already registered. Please use a different email.');
        } else if (errorMessage.includes('ssn') && errorMessage.includes('exists')) {
            alert('Social Security Number is already registered.');
        } else {
            alert(`Signup failed: ${error.message}`);
        }
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const signInForm = document.getElementById('signInForm');
    if (signInForm) {
        signInForm.addEventListener('submit', handleSignIn);
    }
});

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

// NEW NAVIGATION FUNCTIONS
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
                    <button class="btn btn-secondary" style="width: 100%;" onclick="showMyAccount()">
                        My Account
                    </button>
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

// Filter by category from navigation
function filterByCategory(category) {
    // Update active category button
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(btn => {
        btn.classList.remove('active');
        if ((category === '' && btn.textContent.includes('All')) ||
            btn.textContent.includes(category)) {
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

// Enhanced Bidding Modal Functions
function showBidModal(productId, currentPrice) {
    // Check if user is authenticated and approved
    if (!currentUser || currentUser.status !== 'active') {
        showAuthRequiredMessage();
        return;
    }

    currentProductId = productId;
    const currentPriceElement = document.getElementById('currentPrice');
    const bidAmountElement = document.getElementById('bidAmount');
    const bidModal = document.getElementById('bidModal');

    if (currentPriceElement) currentPriceElement.textContent = currentPrice.toFixed(2);
    if (bidAmountElement) {
        bidAmountElement.value = '';
        bidAmountElement.min = (currentPrice + 0.01).toFixed(2);
        bidAmountElement.placeholder = `Min: $${(currentPrice + 0.01).toFixed(2)}`;
    }

    // Load bid history
    loadBidHistory(productId);

    if (bidModal) bidModal.style.display = 'block';

    // Focus on bid input
    setTimeout(() => {
        if (bidAmountElement) bidAmountElement.focus();
    }, 100);
}

function closeBidModal() {
    const bidModal = document.getElementById('bidModal');
    if (bidModal) bidModal.style.display = 'none';
    currentProductId = null;
}

function closeBidSuccessModal() {
    const bidSuccessModal = document.getElementById('bidSuccessModal');
    if (bidSuccessModal) bidSuccessModal.style.display = 'none';
}

function showAuthRequiredMessage() {
    const message = currentUser && currentUser.status === 'pending'
        ? 'Your account is pending admin approval. You\'ll be able to bid once approved!'
        : 'Please sign in to place bids on auction items.';

    alert(message);
}

// Load bid history for a product
async function loadBidHistory(productId) {
    const bidHistoryContainer = document.getElementById('bidHistory');
    if (!bidHistoryContainer) return;

    try {
        // Try to fetch real bid history from API
        const response = await apiCall(`/bids/product/${productId}`);

        if (response.success && response.bids && response.bids.length > 0) {
            displayBidHistory(response.bids);
        } else {
            displayNoBids();
        }
    } catch (error) {
        console.log('Using sample bid data');
        // Use sample bid data if API fails
        const sampleBids = generateSampleBidHistory(productId);
        displayBidHistory(sampleBids);
    }
}

// Generate sample bid history
function generateSampleBidHistory(productId) {
    const product = window.allProducts?.find(p => p._id === productId);
    if (!product) return [];

    const bidCount = product.bidCount || 0;
    if (bidCount === 0) return [];

    const bids = [];
    const currentPrice = product.currentPrice;
    const startingPrice = product.startingPrice || currentPrice * 0.6;

    // Generate realistic bid progression
    const priceIncrement = (currentPrice - startingPrice) / bidCount;
    const sampleUsers = ['john_doe', 'bidder123', 'collector_pro', 'auction_fan', 'vintage_lover'];

    for (let i = bidCount - 1; i >= 0; i--) {
        const bidAmount = startingPrice + (priceIncrement * (bidCount - i));
        const hoursAgo = Math.random() * 24 * (i + 1);
        const bidTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

        bids.push({
            user: { username: sampleUsers[Math.floor(Math.random() * sampleUsers.length)] },
            amount: bidAmount,
            timestamp: bidTime
        });
    }

    return bids.reverse(); // Most recent first
}

// Display bid history
function displayBidHistory(bids) {
    const bidHistoryContainer = document.getElementById('bidHistory');
    if (!bidHistoryContainer) return;

    if (!bids || bids.length === 0) {
        displayNoBids();
        return;
    }

    bidHistoryContainer.innerHTML = bids.slice(0, 5).map(bid => {
        const timeAgo = getTimeAgo(new Date(bid.timestamp));
        return `
            <div class="bid-history-item">
                <div>
                    <div class="bid-user">${bid.user.username}</div>
                    <div class="bid-time">${timeAgo}</div>
                </div>
                <div class="bid-amount">$${bid.amount.toFixed(2)}</div>
            </div>
        `;
    }).join('');
}

function displayNoBids() {
    const bidHistoryContainer = document.getElementById('bidHistory');
    if (bidHistoryContainer) {
        bidHistoryContainer.innerHTML = '<div class="no-bids">No bids yet. Be the first to bid!</div>';
    }
}

// Get time ago string
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

// Enhanced submit bid function
async function submitBid() {
    const bidAmountElement = document.getElementById('bidAmount');
    if (!bidAmountElement) return;

    const bidAmount = parseFloat(bidAmountElement.value);
    const currentPrice = parseFloat(document.getElementById('currentPrice').textContent);

    // Validation
    if (!bidAmount || isNaN(bidAmount)) {
        alert('Please enter a valid bid amount');
        bidAmountElement.focus();
        return;
    }

    if (bidAmount <= currentPrice) {
        alert(`Your bid must be higher than the current bid of $${currentPrice.toFixed(2)}`);
        bidAmountElement.focus();
        return;
    }

    // Disable submit button during request
    const submitBtn = document.querySelector('.bid-submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Bid...';

    try {
        const response = await apiCall('/bids', {
            method: 'POST',
            body: JSON.stringify({
                productId: currentProductId,
                amount: bidAmount
            })
        });

        if (response.success) {
            // Show success modal
            showBidSuccessModal(bidAmount);
            closeBidModal();

            // Refresh product display to show updated price
            setTimeout(() => {
                loadProducts();
            }, 1000);
        }
    } catch (error) {
        alert(error.message || 'Failed to place bid. Please try again.');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Show bid success modal
function showBidSuccessModal(bidAmount) {
    const successModal = document.getElementById('bidSuccessModal');
    const successBidAmount = document.getElementById('successBidAmount');

    if (successBidAmount) {
        successBidAmount.textContent = `$${bidAmount.toFixed(2)}`;
    }

    if (successModal) {
        successModal.style.display = 'block';

        // Auto-close after 5 seconds
        setTimeout(() => {
            closeBidSuccessModal();
        }, 5000);
    }
}

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

// Product Functions
async function loadProducts(isViewer = false) {
    try {
        const response = await apiCall('/products');

        if (response.success) {
            displayProducts(response.products, isViewer);
            // Store products globally for map functions
            window.allProducts = response.products;
            allProductsDisplay = [...window.allProducts];
            filteredProducts = [...allProductsDisplay];
            initializeProductsDisplay();
        }
    } catch (error) {
        console.error('Error loading products:', error);
        // Use sample products as fallback
        window.allProducts = sampleProducts;
        allProductsDisplay = [...window.allProducts];
        filteredProducts = [...allProductsDisplay];
        initializeProductsDisplay();
    }
}

// Enhanced display products function with bidding support
function displayProducts(products, isViewer = false) {
    const productsGrid = document.querySelector('.products-grid');
    if (!productsGrid) return;

    productsGrid.innerHTML = '';

    if (!products || products.length === 0) {
        productsGrid.innerHTML = '<p class="no-products">No active auctions at the moment.</p>';
        return;
    }

    products.forEach(product => {
        const timeLeft = calculateTimeLeft(product.endDate);
        const isEnded = timeLeft === 'Ended';
        const productCard = document.createElement('div');
        productCard.className = 'product-card';

        // Determine user status and what to show
        let actionSection = '';

        if (isEnded) {
            actionSection = '<div class="guest-info">Auction Ended</div>';
        } else if (!currentUser) {
            // Guest user
            actionSection = `
                <div class="guest-info">
                    <i class="fas fa-lock"></i>
                    <a href="signin.html">Sign in</a> or <a href="signup.html">sign up</a> to place bids
                </div>
            `;
        } else if (currentUser.status === 'pending') {
            // Pending user
            actionSection = `
                <div class="pending-user-info">
                    <i class="fas fa-clock"></i>
                    Your account is pending admin approval
                </div>
            `;
        } else if (currentUser.status === 'active') {
            // Active user - can bid
            actionSection = `
                <div class="product-bid-section">
                    <button class="bid-button" onclick="showBidModal('${product._id}', ${product.currentPrice})">
                        <i class="fas fa-gavel"></i> Place Bid
                    </button>
                </div>
            `;
        }

        productCard.innerHTML = `
            <div class="product-image">
                ${product.images && product.images[0] ?
                `<img src="${product.images[0]}" alt="${product.title}" style="width: 100%; height: 100%; object-fit: cover;">` :
                'Product Image'
            }
            </div>
            <div class="product-info">
                <div class="product-category">${product.category}</div>
                <h3 class="product-title">${product.title}</h3>
                <div class="current-bid">$${product.currentPrice.toFixed(2)}</div>
                <div class="bid-info">
                    ${product.bidCount} bid${product.bidCount !== 1 ? 's' : ''} • ${timeLeft}
                </div>
                ${actionSection}
            </div>
        `;
        productsGrid.appendChild(productCard);
    });
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

// Enhanced header update function
function updateAuthenticatedHeader() {
    const headerRight = document.getElementById('headerRight');
    const guestControls = headerRight?.querySelector('.guest-controls');
    const userControls = headerRight?.querySelector('.user-controls');
    const viewerCta = document.querySelector('.viewer-cta');

    if (currentUser && currentUser.status === 'active') {
        // Hide guest controls, show user controls
        if (guestControls) guestControls.style.display = 'none';
        if (userControls) userControls.style.display = 'flex';
        if (viewerCta) viewerCta.style.display = 'none';

        // Update user info in dropdown
        const dropdownUserName = document.getElementById('dropdownUserName');
        const dropdownUserStatus = document.getElementById('dropdownUserStatus');

        if (dropdownUserName) {
            dropdownUserName.textContent = currentUser.fullName || currentUser.username;
        }

        if (dropdownUserStatus) {
            dropdownUserStatus.innerHTML = `<i class="fas fa-check-circle"></i> Active`;
            dropdownUserStatus.style.color = '#27ae60';
        }

        // Show notification badge if there are messages (placeholder)
        const notificationBadge = document.querySelector('.notification-badge');
        if (notificationBadge && Math.random() > 0.7) { // Random for demo
            notificationBadge.style.display = 'flex';
            notificationBadge.textContent = Math.floor(Math.random() * 5) + 1;
        }

    } else if (currentUser && currentUser.status === 'pending') {
        // Show pending state
        if (guestControls) guestControls.style.display = 'none';
        if (userControls) userControls.style.display = 'flex';
        if (viewerCta) viewerCta.style.display = 'block';

        const dropdownUserName = document.getElementById('dropdownUserName');
        const dropdownUserStatus = document.getElementById('dropdownUserStatus');

        if (dropdownUserName) {
            dropdownUserName.textContent = currentUser.fullName || currentUser.username;
        }

        if (dropdownUserStatus) {
            dropdownUserStatus.innerHTML = `<i class="fas fa-clock"></i> Pending`;
            dropdownUserStatus.style.color = '#f39c12';
        }
    } else {
        // Show guest controls
        if (guestControls) guestControls.style.display = 'flex';
        if (userControls) userControls.style.display = 'none';
        if (viewerCta) viewerCta.style.display = 'block';
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

// Enhanced My Account function with bidding info
function showMyAccount() {
    const accountInfo = `
My Account Dashboard

👤 User Information:
• Name: ${currentUser.fullName}
• Status: ${currentUser.status.charAt(0).toUpperCase() + currentUser.status.slice(1)}
• Email: ${currentUser.email}

${currentUser.status === 'active' ? `
🔨 Bidding Features Available:
• View your active bids
• See won auctions
• Track bidding history
• Manage watchlist

💡 Coming Soon:
• Bid notifications
• Auto-bidding
• Seller dashboard
• Purchase history
` : `
⏳ Account Status: Pending
Your account is awaiting admin approval.
Once approved, you'll be able to:
• Place bids on auctions
• Create your own listings
• Access full platform features
`}
    `;

    alert(accountInfo);
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

// Real-time bid updates (simulated)
function startBidUpdates() {
    setInterval(() => {
        // Simulate occasional bid updates
        if (Math.random() < 0.1 && window.allProducts) { // 10% chance every interval
            const randomProduct = window.allProducts[Math.floor(Math.random() * window.allProducts.length)];
            if (randomProduct && Math.random() < 0.3) { // 30% chance for this product
                randomProduct.currentPrice += Math.random() * 50 + 10; // Increase by $10-60
                randomProduct.bidCount += 1;

                // Refresh display if on viewer page
                if (document.getElementById('productsGrid')) {
                    displayProductsWithPagination();
                }
            }
        }
    }, 30000); // Check every 30 seconds
}

// Auto-refresh product data
function startProductRefresh() {
    setInterval(async () => {
        try {
            const response = await apiCall('/products');
            if (response.success && response.products) {
                window.allProducts = response.products;
                allProductsDisplay = [...window.allProducts];

                // Reapply current filters
                applyFilters();
            }
        } catch (error) {
            console.log('Auto-refresh failed, using existing data');
        }
    }, 60000); // Refresh every minute
}

// Add keyboard support for bid modal
document.addEventListener('keydown', (e) => {
    const bidModal = document.getElementById('bidModal');
    const successModal = document.getElementById('bidSuccessModal');

    if (e.key === 'Escape') {
        if (bidModal && bidModal.style.display === 'block') {
            closeBidModal();
        }
        if (successModal && successModal.style.display === 'block') {
            closeBidSuccessModal();
        }
    }

    if (e.key === 'Enter' && bidModal && bidModal.style.display === 'block') {
        const bidAmountInput = document.getElementById('bidAmount');
        if (document.activeElement === bidAmountInput) {
            submitBid();
        }
    }
});

// Close modal when clicking outside
window.onclick = function (event) {
    const bidModal = document.getElementById('bidModal');
    const successModal = document.getElementById('bidSuccessModal');
    const chatModal = document.getElementById('chatHistoryModal');

    if (bidModal && event.target === bidModal) {
        closeBidModal();
    }
    if (successModal && event.target === successModal) {
        closeBidSuccessModal();
    }
    if (chatModal && event.target === chatModal) {
        closeChatHistory();
    }
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
            // Load products
            loadProducts();

            // Sync header search with main search functionality
            const headerSearchInput = document.getElementById('headerProductSearch');
            const productSearchInput = document.getElementById('productSearch');

            if (headerSearchInput) {
                headerSearchInput.addEventListener('input', (e) => {
                    if (productSearchInput) {
                        productSearchInput.value = e.target.value;
                    }
                    searchProducts();
                });

                headerSearchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        searchProducts();
                        // Scroll to products
                        const productsSection = document.querySelector('.products-section');
                        if (productsSection) {
                            productsSection.scrollIntoView({ behavior: 'smooth' });
                        }
                    }
                });
            }

            // Sync mobile search
            const mobileSearchInput = document.querySelector('.mobile-search-input');
            if (mobileSearchInput) {
                mobileSearchInput.addEventListener('input', (e) => {
                    if (productSearchInput) {
                        productSearchInput.value = e.target.value;
                    }
                    if (headerSearchInput) {
                        headerSearchInput.value = e.target.value;
                    }
                    searchProducts();
                });

                const mobileSearchBtn = document.querySelector('.mobile-search-btn');
                if (mobileSearchBtn) {
                    mobileSearchBtn.addEventListener('click', () => {
                        searchProducts();
                        toggleMobileMenu(); // Close mobile menu
                        // Scroll to products
                        const productsSection = document.querySelector('.products-section');
                        if (productsSection) {
                            productsSection.scrollIntoView({ behavior: 'smooth' });
                        }
                    });
                }
            }

            // Add enter key support for search
            const searchInput = document.getElementById('productSearch');
            if (searchInput) {
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        searchProducts();
                    }
                });
            }

            // Start real-time updates
            startBidUpdates();
            startProductRefresh();

            // Show pending user notification if needed
            if (currentUser && currentUser.status === 'pending') {
                setTimeout(() => {
                    const notification = document.createElement('div');
                    notification.className = 'pending-user-info';
                    notification.style.position = 'fixed';
                    notification.style.top = '20px';
                    notification.style.right = '20px';
                    notification.style.zIndex = '1000';
                    notification.style.maxWidth = '300px';
                    notification.innerHTML = `
                        <i class="fas fa-info-circle"></i>
                        Your account is pending approval. You'll receive an email once you can start bidding!
                        <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; color: #856404; font-size: 1.2rem;">&times;</button>
                    `;
                    document.body.appendChild(notification);

                    // Auto-remove after 10 seconds
                    setTimeout(() => {
                        if (notification.parentElement) {
                            notification.remove();
                        }
                    }, 10000);
                }, 2000);
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
// Global state
const globals = {
    bidTimer: null,
    currentProduct: null,
    map: null,
    marker: null
};

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    updateUserInterface(currentUser);

    // Get the product ID from the URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        document.getElementById('product-details-content').innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <h2>Auction Not Found</h2>
                <p>Please return to the auctions page and select an auction.</p>
                <a href="viewer.html" class="btn btn-primary">Browse Auctions</a>
            </div>`;
        return;
    }

    loadProductDetails(productId);
    initializeEventListeners();

    // Set up scroll to top button
    const backToTopButton = document.querySelector('.back-to-top');
    if (backToTopButton) {
        window.onscroll = function () {
            if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
                backToTopButton.style.display = "block";
            } else {
                backToTopButton.style.display = "none";
            }
        };

        backToTopButton.addEventListener('click', () => {
            document.body.scrollTop = 0; // For Safari
            document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
        });
    }
});

async function loadProductDetails(productId) {
    const contentDiv = document.querySelector('#product-details-content');
    if (!contentDiv) return;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.textContent = 'Loading product details...';
    contentDiv.appendChild(loadingDiv);

    try {
        // Track view for recommendations (if function exists)
        if (typeof trackInteraction === 'function') {
            await trackInteraction(productId, 'view');
        }

        const response = await apiCall(`/api/products/${productId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getCurrentUserToken()}`
            }
        });

        if (!response.success || !response.product) {
            throw new Error('Could not fetch product details');
        }

        // Remove loading state
        loadingDiv.remove();

        // Update global state
        globals.currentProduct = response.product;

        // Initialize UI components
        renderProduct(globals.currentProduct);

        // Load additional components
        await Promise.all([
            loadBidHistory(productId),
            loadSimilarItems(globals.currentProduct.category?.[0]),
            loadSellerInfo(globals.currentProduct.sellerId)
        ]);

        // Start auction timer if auction is still active
        if (new Date(globals.currentProduct.endDate) > new Date()) {
            startBidTimer(globals.currentProduct.endDate);
        }

        // Initialize map if location exists
        if (globals.currentProduct.location) {
            initializeMap(globals.currentProduct.location);
        }

        // Initialize image gallery
        if (globals.currentProduct.images?.length > 0) {
            initializeGallery(globals.currentProduct.images);
        }

        // Update bid UI based on auction state
        updateBidUI();

        // Initialize chat
        initializeChat();

    } catch (error) {
        contentDiv.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <h2>Error Loading Auction</h2>
                <p>${error.message}</p>
                <a href="viewer.html" class="btn btn-primary">Return to Auctions</a>
            </div>`;
    }
}

function updateBidUI() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const isSeller = currentUser?._id === globals.currentProduct?.sellerId;
    const isEnded = new Date(globals.currentProduct?.endDate) < new Date();

    const bidFormElement = document.querySelector('#bidForm');
    const bidStatusElement = document.querySelector('#bidStatus');

    if (!bidFormElement || !bidStatusElement) return;

    if (isSeller) {
        bidFormElement.style.display = 'none';
        bidStatusElement.innerHTML = '<p class="notice">You cannot bid on your own item</p>';
    } else if (isEnded) {
        bidFormElement.style.display = 'none';
        bidStatusElement.innerHTML = '<p class="notice">This auction has ended</p>';

        // Show winner info if available
        if (globals.currentProduct.winner) {
            const winnerInfo = globals.currentProduct.winner === currentUser?._id ?
                '<p class="success">You won this auction!</p>' :
                '<p class="notice">This auction has been won by another user</p>';
            bidStatusElement.innerHTML += winnerInfo;
        }
    } else {
        bidFormElement.style.display = 'block';
        bidStatusElement.innerHTML = '';
    }
}

function initializeChat() {
    const chatModal = document.querySelector('#chatModal');
    const openChatBtn = document.querySelector('#openChatBtn');
    const closeChatBtn = document.querySelector('#closeChatBtn');
    const chatMessages = document.querySelector('#chatMessages');
    const messageForm = document.querySelector('#messageForm');
    const messageInput = document.querySelector('#messageInput');

    if (!chatModal || !openChatBtn || !closeChatBtn || !chatMessages || !messageForm || !messageInput) {
        console.error('Chat elements not found');
        return;
    }

    openChatBtn.addEventListener('click', () => {
        chatModal.style.display = 'block';
        loadChatHistory();
    });

    closeChatBtn.addEventListener('click', () => {
        chatModal.style.display = 'none';
    });

    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();
        if (!message) return;

        try {
            const response = await apiCall('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getCurrentUserToken()}`
                },
                body: JSON.stringify({
                    productId: globals.currentProduct._id,
                    recipientId: globals.currentProduct.sellerId,
                    content: message
                })
            });

            if (response.success) {
                messageInput.value = '';
                await loadChatHistory();
            }
        } catch (error) {
            showError('Failed to send message');
        }
    });
}

async function loadChatHistory() {
    const chatMessages = document.querySelector('#chatMessages');
    if (!chatMessages) return;

    try {
        const response = await apiCall(`/api/messages/${globals.currentProduct._id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getCurrentUserToken()}`
            }
        });

        if (!response.success || !response.messages) {
            throw new Error('Could not load chat history');
        }

        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const messagesHTML = response.messages
            .map(msg => {
                const isOwnMessage = msg.senderId === currentUser._id;
                return `
                    <div class="message ${isOwnMessage ? 'own-message' : 'other-message'}">
                        <div class="message-content">
                            <p class="message-text">${msg.content}</p>
                            <span class="message-time">${formatTimeAgo(msg.timestamp)}</span>
                        </div>
                    </div>
                `;
            })
            .join('');

        chatMessages.innerHTML = messagesHTML || '<p class="no-messages">No messages yet</p>';
        chatMessages.scrollTop = chatMessages.scrollHeight;

    } catch (error) {
        console.error('Error loading chat history:', error);
        chatMessages.innerHTML = '<p class="error">Error loading chat history</p>';
    }
}

async function loadBidHistory(productId) {
    const bidHistoryContainer = document.querySelector('#bidHistory');
    if (!bidHistoryContainer) {
        // Try alternative container
        const alternativeContainer = document.querySelector('#bid-history-list');
        if (alternativeContainer) {
            return loadBidHistoryToContainer(productId, alternativeContainer);
        }
        return;
    }
    return loadBidHistoryToContainer(productId, bidHistoryContainer);
}

async function loadBidHistoryToContainer(productId, container) {
    try {
        const response = await apiCall(`/api/bids/${productId}/history`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getCurrentUserToken()}`
            }
        });

        if (!response.success || !response.bids) {
            throw new Error('Could not fetch bid history');
        }

        if (response.bids.length === 0) {
            container.innerHTML = '<p class="no-bids">No bids yet. Be the first to bid!</p>';
            return;
        }

        const bidHistoryHTML = response.bids
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .map(bid => `
                <div class="bid-item">
                    <div class="bid-info">
                        <span class="bid-amount">€${bid.amount.toFixed(2)}</span>
                        <span class="bid-user">${bid.username}</span>
                        <span class="bid-time">${formatTimeAgo(bid.timestamp)}</span>
                    </div>
                </div>
            `)
            .join('');

        container.innerHTML = bidHistoryHTML;

    } catch (error) {
        console.error('Error loading bid history:', error);
        container.innerHTML = '<p class="error">Error loading bid history</p>';
    }
}

async function loadSimilarItems(category) {
    if (!category) return;

    const similarContainer = document.querySelector('#similarItems');
    if (!similarContainer) return;

    try {
        const response = await apiCall(`/api/products/similar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCurrentUserToken()}`
            },
            body: JSON.stringify({
                category,
                currentProductId: globals.currentProduct._id,
                limit: 4
            })
        });

        if (!response.success || !response.products) {
            throw new Error('Could not fetch similar items');
        }

        const similarItemsHTML = response.products
            .map(product => `
                <div class="similar-item">
                    <a href="/product.html?id=${product._id}">
                        <img src="${product.images[0] || '/images/placeholder.png'}" alt="${product.name}">
                        <div class="similar-item-info">
                            <h4>${product.name}</h4>
                            <p class="price">€${product.currentPrice.toFixed(2)}</p>
                            <p class="time-left">${calculateTimeLeft(product.endDate)}</p>
                        </div>
                    </a>
                </div>
            `)
            .join('');

        similarContainer.innerHTML = similarItemsHTML || '<p>No similar items found</p>';

    } catch (error) {
        console.error('Error loading similar items:', error);
        similarContainer.innerHTML = '<p class="error">Error loading similar items</p>';
    }
}

async function loadSellerInfo(sellerId) {
    if (!sellerId) return;

    const sellerContainer = document.querySelector('#sellerInfo');
    if (!sellerContainer) return;

    try {
        const response = await apiCall(`/api/users/${sellerId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getCurrentUserToken()}`
            }
        });

        if (!response.success || !response.user) {
            throw new Error('Could not fetch seller information');
        }

        const { username, rating, totalSales } = response.user;
        const ratingStars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));

        sellerContainer.innerHTML = `
            <div class="seller-info">
                <h3>Seller Information</h3>
                <p class="seller-name">${username}</p>
                <p class="seller-rating">${ratingStars} (${rating.toFixed(1)})</p>
                <p class="seller-sales">Total Sales: ${totalSales}</p>
                <button id="contactSeller" class="btn btn-secondary">
                    <i class="fas fa-envelope"></i> Contact Seller
                </button>
            </div>
        `;

        // Add contact seller functionality
        const contactButton = document.querySelector('#contactSeller');
        if (contactButton) {
            contactButton.addEventListener('click', () => {
                const chatModal = document.querySelector('#chatModal');
                if (chatModal) {
                    chatModal.style.display = 'block';
                    loadChatHistory();
                }
            });
        }

    } catch (error) {
        console.error('Error loading seller info:', error);
        sellerContainer.innerHTML = '<p class="error">Error loading seller information</p>';
    }
}

function renderProduct(product) {
    const contentDiv = document.getElementById('product-details-content');
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const timeLeft = calculateTimeLeft(product.endDate);
    const isEnded = timeLeft === 'Ended';
    const isOwner = currentUser && product.seller && currentUser._id === product.seller._id;

    let bidSectionHTML = '';
    if (isEnded) {
        bidSectionHTML = `
            <div class="auction-ended">
                <i class="fas fa-gavel"></i>
                <h3>Auction has ended</h3>
                ${product.winner ?
                `<p>Won by: ${product.winner.username}</p>
                     <p>Final price: €${product.currentPrice.toFixed(2)}</p>` :
                `<p>No winner</p>`}
            </div>`;
    } else if (!currentUser) {
        bidSectionHTML = `
            <div class="login-prompt">
                <i class="fas fa-user-circle"></i>
                <p>Please sign in to place a bid</p>
                <a href="signin.html" class="btn btn-primary">Sign In</a>
            </div>`;
    } else if (isOwner) {
        bidSectionHTML = `
            <div class="owner-notice">
                <i class="fas fa-info-circle"></i>
                <p>This is your auction</p>
            </div>`;
    } else {
        const minBid = (product.currentPrice + 0.01).toFixed(2);
        bidSectionHTML = `
            <form id="bidForm" class="bid-form">
                <div class="bid-input-group">
                    <label for="bidAmount">Your Bid (€):</label>
                    <div class="bid-input-wrapper">
                        <span class="currency-symbol">€</span>
                        <input type="number" 
                               id="bidAmount" 
                               name="bidAmount" 
                               step="0.01" 
                               min="${minBid}" 
                               placeholder="${minBid}"
                               required>
                    </div>
                </div>
                <div class="min-bid-notice">
                    <i class="fas fa-info-circle"></i>
                    Minimum bid: €${minBid}
                </div>
                <button type="submit" class="btn btn-primary btn-bid">
                    <i class="fas fa-gavel"></i> Place Bid
                </button>
            </form>
            <div id="bidStatus"></div>`;
    }

    contentDiv.innerHTML = `
        <div class="product-details-grid">
            <!-- Left Column: Images and Gallery -->
            <div class="product-gallery">
                <div class="main-image">
                    <img src="${product.images?.[0] || 'placeholder.jpg'}" 
                         alt="${product.name}" 
                         id="mainProductImage"
                         onerror="this.src='placeholder.jpg'">
                </div>
                ${product.images?.length > 1 ? `
                    <div class="image-thumbnails">
                        ${product.images.map((img, index) => `
                            <div class="thumbnail ${index === 0 ? 'active' : ''}" onclick="changeMainImage(${index})">
                                <img src="${img}" alt="Thumbnail ${index + 1}" onerror="this.src='placeholder.jpg'">
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <!-- Right Column: Product Info -->
            <div class="product-info">
                <div class="product-header">
                    <div class="category-badges">
                        ${product.category ? product.category.map(cat => `
                            <span class="category-badge">
                                <i class="fas fa-tag"></i> ${cat}
                            </span>
                        `).join('') : ''}
                    </div>
                    <h1 class="product-title">${product.name}</h1>
                </div>

                <div class="auction-status">
                    <div class="current-price">
                        <span class="label">Current Bid:</span>
                        <span class="value" id="currentPrice">€${product.currentPrice.toFixed(2)}</span>
                    </div>
                    <div class="time-remaining">
                        <span class="label">Time Left:</span>
                        <span class="value" id="timeLeft">
                            <i class="fas fa-clock"></i> ${timeLeft}
                        </span>
                    </div>
                    <div class="bid-count">
                        <span class="label">Total Bids:</span>
                        <span class="value">
                            <i class="fas fa-gavel"></i> ${product.bids?.length || 0}
                        </span>
                    </div>
                </div>

                <div class="bidding-section">
                    ${bidSectionHTML}
                </div>

                <div class="product-details">
                    <div class="details-section">
                        <h3><i class="fas fa-info-circle"></i> Description</h3>
                        <p>${product.description || 'No description provided.'}</p>
                    </div>

                    <div class="seller-section" id="sellerInfo">
                        <h3><i class="fas fa-user"></i> Seller Information</h3>
                        <div class="seller-info">
                            <div class="seller-name">
                                <strong>${product.seller?.username || 'N/A'}</strong>
                            </div>
                            <div class="seller-location">
                                <i class="fas fa-map-marker-alt"></i>
                                ${product.location || 'Location not specified'}
                            </div>
                        </div>
                    </div>

                    <div class="map-section">
                        <h3><i class="fas fa-map"></i> Location</h3>
                        <div id="productMap" class="product-map"></div>
                    </div>
                </div>

                <div class="bid-history-section">
                    <h3><i class="fas fa-history"></i> Bid History</h3>
                    <div id="bidHistory" class="bid-history-list">
                        <div class="loading-spinner"></div>
                    </div>
                </div>

                <div class="similar-items-section">
                    <h3><i class="fas fa-th"></i> Similar Items</h3>
                    <div id="similarItems" class="similar-items-grid">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Chat Modal -->
        <div id="chatModal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close" id="closeChatBtn">&times;</span>
                <h2>Contact Seller</h2>
                <div id="chatMessages" class="chat-messages"></div>
                <form id="messageForm" class="message-form">
                    <input type="text" id="messageInput" placeholder="Type your message..." required>
                    <button type="submit" class="btn btn-primary">Send</button>
                </form>
            </div>
        </div>

        <!-- Bid Confirmation Modal -->
        <div id="bidConfirmModal" class="modal" style="display: none;">
            <div class="modal-content">
                <h2>Confirm Your Bid</h2>
                <p>You are about to bid <strong id="confirmBidAmount"></strong></p>
                <div class="bid-details">
                    <p>Current highest bid: <span id="currentHighestBid"></span></p>
                    <p>Your bid: <span id="yourBidAmount"></span></p>
                </div>
                <div class="modal-buttons">
                    <button id="confirmBidBtn" class="btn btn-primary">Confirm Bid</button>
                    <button id="cancelBidBtn" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        </div>
    `;

    // Initialize map if coordinates are available
    if (product.location) {
        initializeMap(product.location);
    }

    // Set up image gallery if multiple images
    if (product.images?.length > 0) {
        initializeGallery(product.images);
    }

    // Set up bid form event listener
    const bidForm = document.getElementById('bidForm');
    if (bidForm) {
        bidForm.addEventListener('submit', (e) => handleBidSubmit(e, product._id));
    }
}

// Helper functions
function formatTimeAgo(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
}

function getCurrentUserToken() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    return currentUser?.token || '';
}

function calculateTimeLeft(endDate) {
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

function startBidTimer(endDate) {
    if (globals.bidTimer) clearInterval(globals.bidTimer);

    const timerElement = document.querySelector('#timeLeft');
    if (!timerElement) return;

    globals.bidTimer = setInterval(() => {
        const timeLeft = calculateTimeLeft(endDate);
        timerElement.innerHTML = `<i class="fas fa-clock"></i> ${timeLeft}`;

        if (timeLeft === 'Ended') {
            clearInterval(globals.bidTimer);
            window.location.reload(); // Refresh to show ended state
        }
    }, 1000);
}

function initializeMap(location) {
    if (!location || typeof L === 'undefined') return;

    const coords = location.split(',').map(coord => parseFloat(coord.trim()));
    if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) return;

    const [lat, lng] = coords;
    const mapDiv = document.querySelector('#productMap');
    if (!mapDiv) return;

    try {
        globals.map = L.map('productMap').setView([lat, lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(globals.map);

        globals.marker = L.marker([lat, lng]).addTo(globals.map);
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

function initializeGallery(images) {
    const thumbnails = document.querySelectorAll('.thumbnail');
    thumbnails.forEach(thumb => {
        thumb.addEventListener('click', () => {
            thumbnails.forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
        });
    });
}

function showSuccess(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success';
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

function showError(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-error';
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function changeMainImage(index) {
    if (!globals.currentProduct?.images?.[index]) return;

    const mainImage = document.querySelector('#mainProductImage');
    if (mainImage) {
        mainImage.src = globals.currentProduct.images[index];
        mainImage.alt = `Product image ${index + 1}`;
    }

    const thumbnails = document.querySelectorAll('.thumbnail');
    thumbnails.forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

// Initialize all event listeners
function initializeEventListeners() {
    // Bid form events
    const bidForm = document.querySelector('#bidForm');
    const bidAmount = document.querySelector('#bidAmount');
    const confirmBidBtn = document.querySelector('#confirmBidBtn');
    const cancelBidBtn = document.querySelector('#cancelBidBtn');

    if (bidForm) {
        bidForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleBidSubmit(e, globals.currentProduct._id);
        });
    }

    if (confirmBidBtn) {
        confirmBidBtn.addEventListener('click', (e) => confirmBid(e));
    }

    if (cancelBidBtn) {
        cancelBidBtn.addEventListener('click', () => closeModal('bidConfirmModal'));
    }

    if (bidAmount) {
        bidAmount.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            const minBid = globals.currentProduct.currentPrice + 0.01;
            if (value < minBid) {
                e.target.setCustomValidity(`Minimum bid is €${minBid.toFixed(2)}`);
            } else {
                e.target.setCustomValidity('');
            }
        });
    }

    // Window click event for modals
    window.addEventListener('click', (e) => {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // Report item button
    const reportBtn = document.querySelector('#reportItemBtn');
    if (reportBtn) {
        reportBtn.addEventListener('click', () => {
            const reportModal = document.querySelector('#reportModal');
            if (reportModal) {
                reportModal.style.display = 'block';
            }
        });
    }

    // Share button
    const shareBtn = document.querySelector('#shareItemBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                showSuccess('Link copied to clipboard!');
            } catch {
                showError('Failed to copy link');
            }
        });
    }

    // Open chat button
    const openChatBtn = document.querySelector('#openChatBtn');
    if (openChatBtn) {
        openChatBtn.addEventListener('click', () => {
            const chatModal = document.querySelector('#chatModal');
            if (chatModal) {
                chatModal.style.display = 'block';
                loadChatHistory();
            }
        });
    }
}

async function handleBidSubmit(event, productId) {
    event.preventDefault();
    const bidAmount = parseFloat(document.getElementById('bidAmount').value);

    if (!bidAmount || isNaN(bidAmount)) {
        showError('Please enter a valid bid amount');
        return;
    }

    // Show confirmation modal
    const confirmModal = document.getElementById('bidConfirmModal');
    if (!confirmModal) {
        // If modal doesn't exist, submit directly
        await submitBid(productId, bidAmount);
        return;
    }

    const confirmBidAmountEl = document.getElementById('confirmBidAmount');
    const currentHighestBidEl = document.getElementById('currentHighestBid');
    const yourBidAmountEl = document.getElementById('yourBidAmount');

    if (confirmBidAmountEl) confirmBidAmountEl.textContent = `€${bidAmount.toFixed(2)}`;
    if (currentHighestBidEl) currentHighestBidEl.textContent = `€${globals.currentProduct.currentPrice.toFixed(2)}`;
    if (yourBidAmountEl) yourBidAmountEl.textContent = `€${bidAmount.toFixed(2)}`;

    confirmModal.style.display = 'block';

    // Store bid details for confirmation
    confirmModal.dataset.bidAmount = bidAmount;
    confirmModal.dataset.productId = productId;
}

async function confirmBid(event) {
    event.preventDefault();
    const confirmModal = document.getElementById('bidConfirmModal');
    const bidAmount = parseFloat(confirmModal.dataset.bidAmount);
    const productId = confirmModal.dataset.productId;

    if (!bidAmount || !productId) {
        showError('Invalid bid details');
        return;
    }

    await submitBid(productId, bidAmount);
    closeModal('bidConfirmModal');
}

async function submitBid(productId, bidAmount) {
    try {
        // Show loading state
        const confirmBtn = document.getElementById('confirmBidBtn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Processing...';
        }

        const response = await apiCall('/api/bids', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCurrentUserToken()}`
            },
            body: JSON.stringify({
                productId,
                amount: bidAmount
            })
        });

        if (response.success) {
            // Update UI immediately
            const highestBidElement = document.getElementById('currentPrice');
            if (highestBidElement) {
                highestBidElement.textContent = `€${bidAmount.toFixed(2)}`;
            }

            // Update current product price
            if (globals.currentProduct) {
                globals.currentProduct.currentPrice = bidAmount;
            }

            // Update bid history
            const bidHistoryContainer = document.getElementById('bidHistory');
            if (bidHistoryContainer) {
                const currentUser = JSON.parse(localStorage.getItem('currentUser'));
                const newBidHtml = `
                    <div class="bid-item">
                        <div class="bid-info">
                            <span class="bid-amount">€${bidAmount.toFixed(2)}</span>
                            <span class="bid-user">${currentUser.username}</span>
                            <span class="bid-time">Just now</span>
                        </div>
                    </div>
                `;
                bidHistoryContainer.insertAdjacentHTML('afterbegin', newBidHtml);
            }

            // Clear bid input
            const bidInput = document.getElementById('bidAmount');
            if (bidInput) {
                bidInput.value = '';
                bidInput.min = (bidAmount + 0.01).toFixed(2);
                bidInput.placeholder = (bidAmount + 0.01).toFixed(2);
            }

            // Show success message
            showSuccess('Bid placed successfully!');

            // Refresh bid history
            await loadBidHistory(productId);
        }
    } catch (error) {
        showError(error.message || 'Failed to place bid. Please try again.');
    } finally {
        // Reset button state
        const confirmBtn = document.getElementById('confirmBidBtn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Bid';
        }
    }
}

// API call wrapper function
async function apiCall(url, options = {}) {
    try {
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

// Update user interface function
function updateUserInterface(currentUser) {
    const userNavElement = document.querySelector('.user-nav');
    const loginBtnElement = document.querySelector('.login-btn');

    if (currentUser) {
        if (userNavElement) {
            userNavElement.style.display = 'flex';
            const usernameElement = userNavElement.querySelector('.username');
            if (usernameElement) {
                usernameElement.textContent = currentUser.username;
            }
        }
        if (loginBtnElement) {
            loginBtnElement.style.display = 'none';
        }
    } else {
        if (userNavElement) {
            userNavElement.style.display = 'none';
        }
        if (loginBtnElement) {
            loginBtnElement.style.display = 'block';
        }
    }
}

// Track interaction function (placeholder if not defined elsewhere)
async function trackInteraction(productId, action) {
    try {
        await apiCall('/api/interactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCurrentUserToken()}`
            },
            body: JSON.stringify({
                productId,
                action,
                timestamp: new Date().toISOString()
            })
        });
    } catch (error) {
        console.log('Interaction tracking failed:', error);
        // Don't throw - this is not critical functionality
    }
}
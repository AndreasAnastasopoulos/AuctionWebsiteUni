
let selectedLocation = { lat: 37.9838, lng: 23.7275 };
let marker = null;
let map = null;

document.addEventListener('DOMContentLoaded', function () {
    // Check authentication
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || currentUser.status !== 'active') {
        window.location.href = 'signin.html';
    }

    // Set minimum end date to tomorrow and maximum to 30 days from now
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    
    const tomorrowStr = tomorrow.toISOString().slice(0, 16);
    const maxDateStr = maxDate.toISOString().slice(0, 16);
    
    const endDateInput = document.getElementById('endDate');
    endDateInput.min = tomorrowStr;
    endDateInput.max = maxDateStr;

    // Initialize map
    map = L.map('locationMap').setView([selectedLocation.lat, selectedLocation.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add marker on click
    map.on('click', function(e) {
        selectedLocation = e.latlng;
        if (marker) {
            marker.setLatLng(selectedLocation);
        } else {
            marker = L.marker(selectedLocation).addTo(map);
        }
        document.getElementById('location').value = `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`;
    });

    // Handle image preview
    document.getElementById('images').addEventListener('change', function (e) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = '';

        for (const file of this.files) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    preview.appendChild(img);
                }
                reader.readAsDataURL(file);
            }
        }
    });
});

async function createAuction(event) {
    event.preventDefault();
    
    try {
        // Get form data
        const title = document.getElementById('title').value;
        const category = document.getElementById('category').value;
        const description = document.getElementById('description').value;
        const startingPrice = parseFloat(document.getElementById('startingPrice').value);
        const reservePrice = parseFloat(document.getElementById('reservePrice').value) || startingPrice;
        const endDate = new Date(document.getElementById('endDate').value);
        const location = document.getElementById('location').value;
        const imageFiles = document.getElementById('images').value;
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        
        // Validate form

        if (!title || !category || !description || !startingPrice || !endDate || !location ) {
            throw new Error('Please fill in all required fields');
        }

        // Create FormData for images
        const formData = new FormData();
        Array.from(imageFiles).forEach((file, index) => {
            formData.append('images', file);
        });

        // // Upload images first
        // const imageUploadResponse = await fetch('/api/upload', {
        //     method: 'POST',
        //     body: formData,
        //     headers: {
        //         'Authorization': `Bearer ${currentUser.token}`
        //     }
        // });

        // if (!imageUploadResponse.ok) {
        //     throw new Error('Failed to upload images');
        // }

        // const { imageUrls } = await imageUploadResponse.json();

        // Create the auction
        const auctionData = {
            name: title,
            category: [category],
            description,
            startingPrice,
            currentPrice: startingPrice,
            endDate: endDate.toISOString(),
            images: imageFiles,
            location: location,
            seller: currentUser.id,
            status: 'active',
            itemID: generateUUID()
        };

        const response = await apiCall('/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify(auctionData)
        });

        if (!response.success == true) {
            console.error('Response not ok:', response);
            throw new Error('Failed to create auction');
        }

        const { product } = await response.json();

        // Show success message
        showSuccessMessage('Auction created successfully!');

        // Redirect to the new auction page after 2 seconds
        setTimeout(() => {
            window.location.href = `viewer.html?product=${product._id}`;
        }, 2000);

    } catch (error) {
        showErrorMessage(error.message);
    }
}

// Helper functions
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function showSuccessMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success';
    alertDiv.textContent = message;
    document.querySelector('.create-auction-form').prepend(alertDiv);
    setTimeout(() => alertDiv.remove(), 3000);
}

function showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-error';
    alertDiv.textContent = message;
    document.querySelector('.create-auction-form').prepend(alertDiv);
    setTimeout(() => alertDiv.remove(), 3000);
}

// User dropdown functionality
function toggleUserMenu() {
    const menu = document.getElementById('userDropdownMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// Close dropdown when clicking outside
window.addEventListener('click', function (e) {
    if (!e.target.closest('.user-dropdown')) {
        document.getElementById('userDropdownMenu').style.display = 'none';
    }
});

// Navigation functions
function showMyBids() {
    window.location.href = 'user.html#bids';
}

function showWatchlist() {
    window.location.href = 'user.html#watchlist';
}

function showSettings() {
    window.location.href = 'user.html#settings';
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'signin.html';
}
let signupMap = null;
let signupMarker = null;

async function handleSignUp(event) {
    event.preventDefault();

    // Get form values
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const fullName = document.getElementById('signup-fullname').value;
    const email = document.getElementById('signup-email').value;
    const phone = document.getElementById('signup-phone').value;
    const streetName = document.getElementById('signup-address').value;
    const streetNumber = document.getElementById('signup-address-number').value;
    const cityCountry = document.getElementById('signup-city-country').value;
    const address = `${streetName}, ${streetNumber}, ${cityCountry}`;
    const ssn = document.getElementById('signup-ssn').value;
    const latitude = document.getElementById('signup-latitude')?.value;
    const longitude = document.getElementById('signup-longitude')?.value;

    if (password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
    }

    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const requestBody = {
        username, email, password, firstName, lastName, phone, address,
        country: cityCountry.split(',').pop().trim(),
        ssn
    };

    if (latitude && longitude) {
        requestBody.location = {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
            address: address
        };
    }

    try {
        const response = await apiCall('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        if (response.success) {
            window.location.href = 'waiting.html';
        }
    } catch (error) {
        const usernameError = document.getElementById('usernameError');
        if (error.message.includes('already exists')) {
            if (usernameError) {
                 usernameError.textContent = 'Username or email already exists.';
                 usernameError.style.display = 'block';
            }
        } else {
            alert(error.message);
        }
    }
}

function initSignupMap() {
    const mapContainer = document.getElementById('signup-map');
    if (!mapContainer || signupMap) return;

    signupMap = L.map('signup-map').setView([37.9838, 23.7275], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(signupMap);

    signupMap.on('click', (e) => setUserLocation(e.latlng.lat, e.latlng.lng));
    setTimeout(() => signupMap.invalidateSize(), 100);
}

function setUserLocation(lat, lng) {
    if (signupMarker) signupMap.removeLayer(signupMarker);
    signupMarker = L.marker([lat, lng], { draggable: true }).addTo(signupMap);
    signupMarker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        updateLocationDisplay(pos.lat, pos.lng);
    });
    updateLocationDisplay(lat, lng);
    signupMap.setView([lat, lng], 13);
}

function updateLocationDisplay(lat, lng) {
    document.getElementById('selected-coords').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    document.getElementById('signup-latitude').value = lat;
    document.getElementById('signup-longitude').value = lng;
}

async function geocodeAddress() {
    const streetName = document.getElementById('signup-address').value;
    const streetNumber = document.getElementById('signup-address-number').value;
    const cityCountry = document.getElementById('signup-city-country').value;
    if (!streetName || !cityCountry) return alert('Please enter address and city/country first');

    const fullAddress = `${streetNumber} ${streetName}, ${cityCountry}`;
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
            setUserLocation(parseFloat(data[0].lat), parseFloat(data[0].lon));
        } else {
            alert('Could not find this address. Please click on the map to set your location manually.');
        }
    } catch (error) {
        alert('Error finding address. Please set your location manually on the map.');
    }
}

function getCurrentLocation() {
    if (!navigator.geolocation) return alert('Geolocation is not supported by your browser');
    navigator.geolocation.getCurrentPosition(
        (position) => setUserLocation(position.coords.latitude, position.coords.longitude),
        () => alert('Could not get your location. Please set it manually on the map.')
    );
}

document.addEventListener('DOMContentLoaded', initSignupMap);
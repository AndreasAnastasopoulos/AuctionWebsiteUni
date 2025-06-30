
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
}

function showViewer() {
    hideAllPages();
    document.getElementById('viewerPage').style.display = 'block';
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

// Back to Top Button
const backToTopButton = document.querySelector('.back-to-top');

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

// Form handlers
function handleSignIn(event) {
    event.preventDefault();
    // In a real application, this would validate credentials
    alert('Sign in functionality would be implemented here');
}

function handleSignUp(event) {
    event.preventDefault();

    // Check if passwords match
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
    }

    // Simulate username check (in real app, this would check against database)
    const username = document.getElementById('signup-username').value;
    const existingUsernames = ['admin', 'user1', 'testuser']; // Example existing usernames

    if (existingUsernames.includes(username.toLowerCase())) {
        document.getElementById('usernameError').style.display = 'block';
        return;
    }

    // If all validations pass, show waiting page
    showWaiting();
}
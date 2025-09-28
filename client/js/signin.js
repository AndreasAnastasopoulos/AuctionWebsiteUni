document.addEventListener('DOMContentLoaded', () => {
    const signInForm = document.querySelector('form');
    if (signInForm) {
        signInForm.addEventListener('submit', handleSignIn);
    }

    // If user is already logged in, redirect them
    if (authToken && currentUser) {
        if (currentUser.role === 'admin') {
            window.location.href = 'admin-dashboard.html';
        } else {
            showViewer();
        }
    }
});

async function handleSignIn(event) {
    event.preventDefault();
    const username = document.getElementById('signin-username').value;
    const password = document.getElementById('signin-password').value;
    const errorDiv = document.getElementById('signInError');

    try {
        const response = await apiCall('/auth/signin', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });

        if (response.success) {
            localStorage.setItem('authToken', response.token);
            localStorage.setItem('currentUser', JSON.stringify(response.user));
            
            if (response.user.role === 'admin') {
                window.location.href = 'admin-dashboard.html';
            } else if (response.user.status === 'active') {
                showViewer();
            } else {
                window.location.href = 'waiting.html';
            }
        }
    } catch (error) {
        if (errorDiv) {
            errorDiv.textContent = error.message || 'Invalid username or password.';
            errorDiv.style.display = 'block';
        }
    }
}
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
            localStorage.setItem('authToken', response.token);
            localStorage.setItem('currentUser', JSON.stringify(response.user));
            
            if (response.user.role === 'admin') {
                window.location.href = 'admin-dashboard.html';
            } else {
                showViewer();
            }
        }
    } catch (error) {
        alert('Invalid username or password');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const signInForm = document.getElementById('signInForm');
    if (signInForm) {
        signInForm.addEventListener('submit', handleSignIn);
    }

    // Redirect if already logged in
    if (authToken && currentUser) {
        showViewer();
    }
});
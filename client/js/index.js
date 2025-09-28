document.addEventListener('DOMContentLoaded', () => {
    // Welcome page - check authentication
    if (authToken && currentUser) {
        // If user is active or pending, redirect to the main viewer page
        if (currentUser.status === 'active' || currentUser.status === 'pending') {
            // Verify token for active users to ensure it's not expired
            apiCall('/users/profile')
                .then(response => {
                    if (response.success && response.user) {
                        showViewer();
                    } else {
                        // Token might be invalid/expired
                        logout();
                    }
                })
                .catch(() => {
                    // Token invalid, clear storage
                    logout();
                });
        }
    }
});
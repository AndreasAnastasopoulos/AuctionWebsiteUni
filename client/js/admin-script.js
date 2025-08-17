// Admin Dashboard Script
const API_URL = 'http://localhost:5001/api';
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

// Check if user is admin
if (!authToken || !currentUser || currentUser.role !== 'admin') {
    window.location.href = '/';
}

// Set admin name
document.getElementById('adminName').textContent = currentUser.fullName;

// Global data storage
let allUsers = [];
let allProducts = [];

// API Helper
const apiCall = async (endpoint, options = {}) => {
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            ...options.headers
        }
    };

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

// Navigation
function showSection(section) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Show selected section
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`${section}Section`).classList.add('active');

    // Load data for section
    if (section === 'users') loadUsers();
    else if (section === 'products') loadProducts();
    else if (section === 'stats') loadStats();
}

// Users Management
async function loadUsers() {
    try {
        const response = await apiCall('/users');
        allUsers = response.users;
        displayUsers(allUsers);
        
        // Update pending count
        const pendingCount = allUsers.filter(u => u.status === 'pending').length;
        if (pendingCount > 0) {
            document.getElementById('pendingAlert').style.display = 'flex';
            document.getElementById('pendingCount').textContent = pendingCount;
        } else {
            document.getElementById('pendingAlert').style.display = 'none';
        }
    } catch (error) {
        document.getElementById('usersTableBody').innerHTML = 
            '<tr><td colspan="7" class="loading">Error loading users</td></tr>';
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username}</td>
            <td>${user.fullName}</td>
            <td>${user.email}</td>
            <td><span class="status-badge status-${user.status}">${user.status}</span></td>
            <td><span class="role-badge role-${user.role}">${user.role}</span></td>
            <td>${new Date(user.createdAt).toLocaleDateString()}</td>
            <td class="action-buttons">
                ${user.status === 'pending' ? 
                    `<button class="btn-action btn-approve" onclick="approveUser('${user._id}')">
                        <i class="fas fa-check"></i> Approve
                    </button>` : ''
                }
                <button class="btn-action btn-edit" onclick="editUser('${user._id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                ${user.status === 'active' && user.role !== 'admin' ? 
                    `<button class="btn-action btn-suspend" onclick="suspendUser('${user._id}')">
                        <i class="fas fa-ban"></i> Suspend
                    </button>` : ''
                }
            </td>
        </tr>
    `).join('');
}

async function approveUser(userId) {
    if (confirm('Approve this user?')) {
        try {
            await apiCall(`/users/${userId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'active' })
            });
            alert('User approved successfully!');
            loadUsers();
        } catch (error) {
            alert('Error approving user: ' + error.message);
        }
    }
}

async function suspendUser(userId) {
    if (confirm('Suspend this user?')) {
        try {
            await apiCall(`/users/${userId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'suspended' })
            });
            alert('User suspended successfully!');
            loadUsers();
        } catch (error) {
            alert('Error suspending user: ' + error.message);
        }
    }
}

function editUser(userId) {
    const user = allUsers.find(u => u._id === userId);
    if (!user) return;

    document.getElementById('editUserId').value = user._id;
    document.getElementById('editUsername').value = user.username;
    document.getElementById('editStatus').value = user.status;
    document.getElementById('editRole').value = user.role;
    
    document.getElementById('userModal').style.display = 'block';
}

async function saveUserChanges(event) {
    event.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const status = document.getElementById('editStatus').value;
    const role = document.getElementById('editRole').value;

    try {
        // Update status
        await apiCall(`/users/${userId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });

        // Update role
        await apiCall(`/users/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role })
        });

        alert('User updated successfully!');
        closeUserModal();
        loadUsers();
    } catch (error) {
        alert('Error updating user: ' + error.message);
    }
}

function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

// User Filters
function filterUsers() {
    const statusFilter = document.getElementById('userStatusFilter').value;
    const roleFilter = document.getElementById('userRoleFilter').value;
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();

    let filtered = allUsers;

    if (statusFilter) {
        filtered = filtered.filter(u => u.status === statusFilter);
    }

    if (roleFilter) {
        filtered = filtered.filter(u => u.role === roleFilter);
    }

    if (searchTerm) {
        filtered = filtered.filter(u => 
            u.username.toLowerCase().includes(searchTerm) ||
            u.fullName.toLowerCase().includes(searchTerm) ||
            u.email.toLowerCase().includes(searchTerm)
        );
    }

    displayUsers(filtered);
}

// Products Management
async function loadProducts() {
    try {
        const response = await apiCall('/products');
        allProducts = response.products;
        displayProducts(allProducts);
    } catch (error) {
        document.getElementById('productsTableBody').innerHTML = 
            '<tr><td colspan="8" class="loading">Error loading products</td></tr>';
    }
}

function displayProducts(products) {
    const tbody = document.getElementById('productsTableBody');
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No products found</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.title}</td>
            <td>${product.seller?.username || 'Unknown'}</td>
            <td>${product.category}</td>
            <td>$${product.currentPrice.toFixed(2)}</td>
            <td>${product.bidCount}</td>
            <td><span class="status-badge status-${product.status}">${product.status}</span></td>
            <td>${new Date(product.endDate).toLocaleDateString()}</td>
            <td class="action-buttons">
                <button class="btn-action btn-view" onclick="viewProduct('${product._id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                ${product.status === 'active' ? 
                    `<button class="btn-action btn-suspend" onclick="cancelProduct('${product._id}')">
                        <i class="fas fa-times"></i> Cancel
                    </button>` : ''
                }
            </td>
        </tr>
    `).join('');
}

function viewProduct(productId) {
    // In a real app, this would open a product detail modal
    alert('Product details view coming soon!');
}

async function cancelProduct(productId) {
    if (confirm('Cancel this auction?')) {
        // In a real app, this would update the product status
        alert('Product cancellation coming soon!');
    }
}

function showCreateProduct() {
    document.getElementById('productModal').style.display = 'block';
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
    document.getElementById('productCreateForm').reset();
}

async function createProduct(event) {
    event.preventDefault();
    
    const title = document.getElementById('productTitle').value;
    const description = document.getElementById('productDescription').value;
    const category = document.getElementById('productCategory').value;
    const startingPrice = parseFloat(document.getElementById('productPrice').value);
    const duration = parseInt(document.getElementById('productDuration').value);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    try {
        // First, we need to ensure the admin has seller privileges or use a test seller
        // For now, we'll show an alert
        alert('To create products, you need a user with seller role. This feature will be implemented with proper seller functionality.');
        closeProductModal();
        
        // In a real implementation:
        // await apiCall('/products', {
        //     method: 'POST',
        //     body: JSON.stringify({
        //         title,
        //         description,
        //         category,
        //         startingPrice,
        //         endDate: endDate.toISOString()
        //     })
        // });
        // loadProducts();
    } catch (error) {
        alert('Error creating product: ' + error.message);
    }
}

function filterProducts() {
    const statusFilter = document.getElementById('productStatusFilter').value;
    const searchTerm = document.getElementById('productSearch').value.toLowerCase();

    let filtered = allProducts;

    if (statusFilter) {
        filtered = filtered.filter(p => p.status === statusFilter);
    }

    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.title.toLowerCase().includes(searchTerm) ||
            p.description.toLowerCase().includes(searchTerm) ||
            p.category.toLowerCase().includes(searchTerm)
        );
    }

    displayProducts(filtered);
}

// Statistics
async function loadStats() {
    try {
        // Load users for stats
        const usersResponse = await apiCall('/users');
        const users = usersResponse.users;
        
        // Load products for stats
        const productsResponse = await apiCall('/products');
        const products = productsResponse.products;
        
        // Calculate stats
        document.getElementById('totalUsers').textContent = users.length;
        document.getElementById('activeAuctions').textContent = 
            products.filter(p => p.status === 'active').length;
        document.getElementById('pendingApprovals').textContent = 
            users.filter(u => u.status === 'pending').length;
        
        // For total bids, we'd need a bids endpoint
        // For now, sum up bid counts from products
        const totalBids = products.reduce((sum, p) => sum + p.bidCount, 0);
        document.getElementById('totalBids').textContent = totalBids;
        
        // Activity log would require a separate activity tracking system
        // For now, show recent users
        const recentUsers = users
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);
            
        const activityLog = document.getElementById('activityLog');
        if (recentUsers.length > 0) {
            activityLog.innerHTML = recentUsers.map(user => `
                <div class="activity-item">
                    <i class="fas fa-user-plus"></i>
                    New user registration: <strong>${user.username}</strong> 
                    (${new Date(user.createdAt).toLocaleString()})
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Logout
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = '/';
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Load initial data
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
});
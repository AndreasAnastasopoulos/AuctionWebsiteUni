// create-admin.js
// Run this script to create an admin user
// Usage: node create-admin.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./models/User');

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '.env') });

async function createAdmin() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ username: 'admin' });

        if (existingAdmin) {
            console.log('Admin user already exists!');
            console.log('Username: admin');
            console.log('Password: admin123');
            process.exit(0);
        }

        // Create admin user
        const admin = await User.create({
            username: 'admin',
            email: 'admin@paredose.com',
            password: 'admin123',
            firstName: 'Admin', // Added firstName
            lastName: 'User', // Added lastName
            phone: '0000000000',
            address: 'Admin Office',
            country: 'SomeCountry', // Added country
            ssn: '000-00-0000',
            location: {
                type: 'Point',
                coordinates: [0, 0], // Default coordinates
                address: 'Admin Location' // Added address
            },
            role: 'admin',
            status: 'active',
            bidderRating: 0,
            sellerRating: 0
        });

        console.log('Admin user created successfully!');
        console.log('----------------------------');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('----------------------------');
        console.log('You can now login to the admin dashboard!');

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error);
        process.exit(1);
    }
}

// Run the script
createAdmin();
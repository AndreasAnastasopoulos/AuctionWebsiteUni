// Script to reset admin password
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

async function resetAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('Connected to MongoDB');

        // Delete existing admin if exists
        await User.deleteOne({ username: 'admin' });
        console.log('Deleted old admin user');

        // Create new admin user
        const admin = await User.create({
            username: 'admin',
            email: 'admin@paredose.com',
            password: 'admin123',
            firstName: 'Admin',
            lastName: 'User',
            phone: '0000000000',
            address: 'Admin Office',
            country: 'Greece',
            ssn: '000-00-0000',
            location: {
                type: 'Point',
                coordinates: [23.7275, 37.9838]
            },
            role: 'admin',
            status: 'active',
            bidderRating: 0,
            sellerRating: 0
        });

        console.log('✅ Admin user created successfully!');
        console.log('----------------------------');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('----------------------------');

        mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

resetAdmin();

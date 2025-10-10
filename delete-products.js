// Simple script to delete products from the database
const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

async function deleteProducts() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('Connected to MongoDB');
        
        // Option 1: Delete ALL products
        const result = await Product.deleteMany({});
        console.log(`Deleted ${result.deletedCount} products`);
        
        // Option 2: Delete products by specific criteria
        // For example, delete products with broken images (no image or empty array)
        // const result = await Product.deleteMany({
        //     $or: [
        //         { images: { $exists: false } },
        //         { images: { $size: 0 } },
        //         { images: null }
        //     ]
        // });
        // console.log(`Deleted ${result.deletedCount} products with missing images`);
        
        // Option 3: List all products first, then delete specific ones
        // const products = await Product.find({});
        // console.log('Current products:');
        // products.forEach(p => {
        //     console.log(`ID: ${p._id}, Name: ${p.name}, Images: ${p.images?.length || 0}`);
        // });
        
        // Uncomment to delete a specific product by ID
        // const productId = 'YOUR_PRODUCT_ID_HERE';
        // await Product.findByIdAndDelete(productId);
        // console.log(`Deleted product ${productId}`);
        
        mongoose.connection.close();
        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

deleteProducts();

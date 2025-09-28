const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, requireAdmin } = require('../middleware/auth'); // Assuming you have a requireAdmin middleware
const { v4: uuidv4 } = require('uuid');
const js2xmlparser = require("js2xmlparser"); // Import the XML parser

// @route   GET /api/products
// @desc    Get all active products with location data
// @access  Public
router.get('/', async (req, res) => {
    try {
        const { category, search, sort, lat, lng, radius } = req.query;
        
        // Build query
        const query = { status: 'active' };
        
        if (category) {
            query.category = category;
        }
        
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort
        let sortOption = {};
        switch (sort) {
            case 'price_asc':
                sortOption = { currentPrice: 1 };
                break;
            case 'price_desc':
                sortOption = { currentPrice: -1 };
                break;
            case 'ending_soon':
                sortOption = { endDate: 1 };
                break;
            default:
                sortOption = { createdAt: -1 };
        }

        // Get products with seller location data
        let products = await Product.find(query)
            .populate({
                path: 'seller',
                select: 'username fullName location'
            })
            .sort(sortOption)
            .limit(50);

        // Filter by location if provided
        if (lat && lng && radius) {
            const centerLat = parseFloat(lat);
            const centerLng = parseFloat(lng);
            const radiusKm = parseFloat(radius);

            products = products.filter(product => {
                if (!product.seller?.location?.coordinates) return false;
                
                const [sellerLng, sellerLat] = product.seller.location.coordinates;
                const distance = calculateDistance(centerLat, centerLng, sellerLat, sellerLng);
                
                return distance <= radiusKm;
            });
        }

        res.json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching products',
            error: error.message
        });
    }
});

// @route   GET /api/products/nearby
// @desc    Get products near a location
// @access  Public
router.get('/nearby', async (req, res) => {
    try {
        const { lat, lng, maxDistance = 50 } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        // First get all active products
        const products = await Product.find({ status: 'active' })
            .populate({
                path: 'seller',
                select: 'username fullName location address'
            });

        // Filter by distance
        const nearbyProducts = products.filter(product => {
            if (!product.seller?.location?.coordinates) return false;
            
            const [sellerLng, sellerLat] = product.seller.location.coordinates;
            const distance = calculateDistance(
                parseFloat(lat), 
                parseFloat(lng), 
                sellerLat, 
                sellerLng
            );
            
            // Add distance to product object for sorting
            product._doc.distance = distance;
            return distance <= parseFloat(maxDistance);
        });

        // Sort by distance
        nearbyProducts.sort((a, b) => a._doc.distance - b._doc.distance);

        res.json({
            success: true,
            count: nearbyProducts.length,
            products: nearbyProducts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching nearby products',
            error: error.message
        });
    }
});

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// @route   GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('seller', 'username email location address');

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching product',
            error: error.message
        });
    }
});

// @route   POST /api/products , protect, requireActive
router.post('/', async (req, res) => {
    try {
        const { itemID, name, title, description, category, startingPrice, endDate, images, seller } = req.body;

        const product = await Product.create({
            itemID,
            name,
            title,
            description,
            category,
            startingPrice,
            endDate,
            images,
            seller
            // seller: req.user._id
        });

        res.status(201).json({
            success: true,
            product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating product',
            error: error.message
        });
    }
});

// @route   delete /api/products/all
router.delete('/all', async (req, res) => {
    try {
        await Product.deleteMany();
        res.json({
            success: true,
            message: 'All products deleted'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting products',
            error: error.message
        });
    }
});

// @route   GET /api/products/export/json
// @desc    Export all products as JSON (Admin only)
// @access  Private/Admin
router.get('/export/json', protect, requireAdmin, async (req, res) => {
    try {
        const products = await Product.find({}).populate('seller', 'username').lean();
        const filename = `products-export-${new Date().toISOString().slice(0,10)}.json`;
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// @route   GET /api/products/export/xml
// @desc    Export all products as XML (Admin only)
// @access  Private/Admin
router.get('/export/xml', protect, requireAdmin, async (req, res) => {
    try {
        const products = await Product.find({}).populate('seller', 'username').lean();
        const xmlData = js2xmlparser.parse("products", { product: products });
        const filename = `products-export-${new Date().toISOString().slice(0,10)}.xml`;

        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        res.status(200).send(xmlData);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;
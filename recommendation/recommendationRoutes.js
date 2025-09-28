const express = require('express');
const router = express.Router();
const MatrixFactorizationRecommender = require('./MatrixFactorizationRecommender');
const User = require('../models/User');
const Product = require('../models/Product');
const Bid = require('../models/Bid');
const { protect, requireActive } = require('../middleware/auth'); // Correct import

// Initialize recommender
const recommender = new MatrixFactorizationRecommender({
    k: 15,
    learningRate: 0.01,
    regularization: 0.01,
    iterations: 100
});

// Get recommendations for current user
router.get('/recommendations', protect, requireActive, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id; // From JWT decoded id

        // Load model if not in memory
        if (!recommender.userFactors) {
            const modelLoaded = await recommender.loadModel(req.app.locals.db);
            if (!modelLoaded) {
                // Return empty recommendations if no model exists yet
                return res.json({
                    success: true,
                    recommendations: [],
                    message: 'Model not trained yet'
                });
            }
        }

        // Get user's bid history to exclude
        const userBids = await Bid.find({ user: userId });
        const excludeProducts = userBids.map(bid => bid.product.toString());

        // Get active products
        const activeProducts = await Product.find({
            status: 'active',
            endDate: { $gt: new Date() }
        });

        const availableProductIds = activeProducts.map(p => p._id.toString());

        // Get recommendations
        const recommendations = recommender.getRecommendations(
            userId.toString(),
            10,
            excludeProducts,
            availableProductIds
        );

        // Fetch product details
        const productIds = recommendations.map(r => r.itemId);
        const products = await Product.find({
            _id: { $in: productIds }
        }).populate('seller', 'username');

        res.json({
            success: true,
            recommendations: products
        });
    } catch (error) {
        console.error('Recommendation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Track user interactions
router.post('/track-interaction', protect, async (req, res) => {
    try {
        const { productId, type } = req.body;
        const userId = req.user._id || req.user.id;

        // Validate interaction type
        const validTypes = ['view', 'bid', 'purchase', 'watchlist'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid interaction type'
            });
        }

        await req.app.locals.db.collection('user_interactions').insertOne({
            userId: userId.toString(),
            productId: productId,
            type: type,
            timestamp: new Date()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Track interaction error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Train model (admin only)
router.post('/train', protect, requireActive, async (req, res) => {
    try {
        // Check if user is admin
        const userId = req.user._id || req.user.id;
        const user = await User.findById(userId);

        if (!user || !user.isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        // Get all bids as interactions
        const bids = await Bid.find({}).populate('user product');

        if (!bids || bids.length === 0) {
            return res.json({
                success: false,
                message: 'No bids found to train on'
            });
        }

        const interactions = bids
            .filter(bid => bid.user && bid.product) // Filter out invalid bids
            .map(bid => ({
                userId: bid.user._id.toString(),
                itemId: bid.product._id.toString(),
                type: 'bid',
                timestamp: bid.createdAt || new Date()
            }));

        // Also get view interactions if they exist
        const viewInteractions = await req.app.locals.db
            .collection('user_interactions')
            .find({ type: 'view' })
            .toArray();

        if (viewInteractions && viewInteractions.length > 0) {
            viewInteractions.forEach(view => {
                interactions.push({
                    userId: view.userId,
                    itemId: view.productId,
                    type: 'view',
                    timestamp: view.timestamp
                });
            });
        }

        // Get all products
        const products = await Product.find({});
        const items = products.map(p => ({
            itemId: p._id.toString(),
            categories: p.category ? [p.category] : []
        }));

        // Only train if we have data
        if (interactions.length === 0) {
            return res.json({
                success: false,
                message: 'No interactions to train on'
            });
        }

        console.log(`Training model with ${interactions.length} interactions and ${items.length} products...`);

        // Train model
        const sparseMatrix = recommender.prepareData(interactions, items);
        recommender.train(sparseMatrix);

        // Save model
        await recommender.saveModel(req.app.locals.db);

        res.json({
            success: true,
            message: 'Model trained successfully',
            stats: {
                interactions: interactions.length,
                products: products.length,
                users: recommender.userIdToIndex.size,
                items: recommender.itemIdToIndex.size
            }
        });
    } catch (error) {
        console.error('Training error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Public route to get similar items (no auth required)
router.get('/similar-items/:itemId', async (req, res) => {
    try {
        const itemId = req.params.itemId;

        // Load model if not in memory
        if (!recommender.itemFactors) {
            const modelLoaded = await recommender.loadModel(req.app.locals.db);
            if (!modelLoaded) {
                return res.json({
                    success: true,
                    similarItems: []
                });
            }
        }

        const similarItems = recommender.getSimilarItems(itemId, 5);

        // Fetch item details
        const itemIds = similarItems.map(s => s.itemId);
        const items = await Product.find({
            _id: { $in: itemIds },
            status: 'active'
        }).populate('seller', 'username');

        res.json({
            success: true,
            similarItems: items
        });
    } catch (error) {
        console.error('Similar items error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
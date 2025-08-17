// bidRoutes.js
const express = require('express');
const router = express.Router();
const Bid = require('../../models/Bid');
const Product = require('../../models/Product');
const { protect, requireActive } = require('../middleware/auth');

// @route   POST /api/bids
// @desc    Place a bid on a product
// @access  Private (Active users only)
router.post('/', protect, requireActive, async (req, res) => {
    try {
        const { productId, amount } = req.body;
        
        // Validate input
        if (!productId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Product ID and bid amount are required'
            });
        }
        
        // Get the product
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        // Check if auction is still active
        if (product.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'This auction has ended'
            });
        }
        
        // Check if auction has ended based on time
        if (new Date() > new Date(product.endDate)) {
            product.status = 'ended';
            await product.save();
            return res.status(400).json({
                success: false,
                message: 'This auction has ended'
            });
        }
        
        // Check if bid is higher than current price
        if (amount <= product.currentPrice) {
            return res.status(400).json({
                success: false,
                message: `Bid must be higher than current price of $${product.currentPrice}`
            });
        }
        
        // Check if user is the seller
        if (product.seller.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot bid on your own product'
            });
        }
        
        // Create the bid
        const bid = await Bid.create({
            product: productId,
            bidder: req.user._id,
            amount
        });
        
        // Update product with new current price and bid count
        product.currentPrice = amount;
        product.bidCount += 1;
        await product.save();
        
        res.status(201).json({
            success: true,
            message: 'Bid placed successfully',
            bid,
            newPrice: amount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error placing bid',
            error: error.message
        });
    }
});

// @route   GET /api/bids/my-bids
// @desc    Get current user's bids
// @access  Private
router.get('/my-bids', protect, async (req, res) => {
    try {
        const bids = await Bid.find({ bidder: req.user._id })
            .populate('product', 'title currentPrice endDate status')
            .sort('-createdAt');
        
        res.json({
            success: true,
            count: bids.length,
            bids
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching bids',
            error: error.message
        });
    }
});

// @route   GET /api/bids/product/:productId
// @desc    Get all bids for a product
// @access  Public
router.get('/product/:productId', async (req, res) => {
    try {
        const bids = await Bid.find({ product: req.params.productId })
            .populate('bidder', 'username')
            .sort('-amount');
        
        res.json({
            success: true,
            count: bids.length,
            bids
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching product bids',
            error: error.message
        });
    }
});

// @route   GET /api/bids/winning
// @desc    Get user's winning bids (auctions they've won)
// @access  Private
router.get('/winning', protect, async (req, res) => {
    try {
        // Find ended products where user has the highest bid
        const products = await Product.find({
            status: 'ended',
            winner: req.user._id
        }).populate('seller', 'username email');
        
        res.json({
            success: true,
            count: products.length,
            wonAuctions: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching winning bids',
            error: error.message
        });
    }
});

module.exports = router;
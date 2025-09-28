const express = require('express');
const router = express.Router();
const UserInteraction = require('../models/UserInteraction');
const { protect, requireActive } = require('../middleware/auth');

// @route   POST /api/interactions
// @desc    Track user interactions with products
// @access  Private
router.post('/', protect, requireActive, async (req, res) => {
    try {
        const { productId, type, timestamp } = req.body;

        // Update or create interaction
        await UserInteraction.findOneAndUpdate(
            { 
                userId: req.user._id, 
                productId: productId,
                type: type
            },
            {
                userId: req.user._id,
                productId: productId,
                type: type,
                timestamp: timestamp,
                $inc: { 
                    viewCount: type === 'view' ? 1 : 0,
                    bidCount: type === 'bid' ? 1 : 0
                }
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error tracking interaction:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error tracking interaction' 
        });
    }
});

module.exports = router;
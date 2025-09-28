const mongoose = require('mongoose');

const userInteractionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    type: {
        type: String,
        required: true,
        enum: ['view', 'bid', 'purchase', 'watchlist']
    },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserInteraction', userInteractionSchema);
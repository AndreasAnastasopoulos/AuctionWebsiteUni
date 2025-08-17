const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    bidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    isWinning: {
        type: Boolean,
        default: false
    }
});

// Compound index for efficient queries
bidSchema.index({ product: 1, timestamp: -1 });
bidSchema.index({ bidder: 1, timestamp: -1 });

module.exports = mongoose.model('Bid', bidSchema);
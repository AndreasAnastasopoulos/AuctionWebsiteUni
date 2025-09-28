const mongoose = require('mongoose');
const bidSchema = require('./Bid').schema; // Import Bid schema for embedding
const userSchema = require('./User').schema; // Import User schema for referencing

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: [{ // Changed to an array of strings
        type: String,
        required: true
    }],
    currentPrice: {
        type: Number,
        default: function() {
            return this.startingPrice;
        }
    },
    description: {
        type: String,
        required: true
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    images: [{
        type: String
    }],
    startingPrice: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'ended', 'cancelled'],
        default: 'active'
    },
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    bids: [{ // Array of ObjectIds referencing the Bid model
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bid'
    }],
    location: String,
    country: String,
    seller: { // Reference to the User model
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    itemID: { // Unique identifier for the item
        type: String,
        required: true,
        unique: true,
        trim: true
    },

}, 
{ timestamps: true });

// Index for efficient queries
productSchema.index({ status: 1, endDate: 1 });
productSchema.index({ seller: 1 });
productSchema.index({ category: 1 });
productSchema.index({ itemID: 1 }); // Added index for itemID

module.exports = mongoose.model('Product', productSchema);
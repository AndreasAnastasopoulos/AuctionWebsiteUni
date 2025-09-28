const mongoose = require('mongoose');
const userSchema = require('./User').schema; // Import User schema for referencing
const productSchema = require('./Product').schema; // Import Product schema for referencing

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    },
    read: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Message', messageSchema);
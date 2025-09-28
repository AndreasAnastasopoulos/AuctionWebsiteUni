const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const https = require('https'); // Import https module
const fs = require('fs'); // Import fs module
const recommendationRoutes = require('./recommendation/recommendationRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const MatrixFactorizationRecommender = require('./recommendation/MatrixFactorizationRecommender');

// Initialize recommender
const recommender = new MatrixFactorizationRecommender({
    k: 10,
    learningRate: 0.01,
    regularization: 0.01,
    iterations: 100
});

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Middleware
// app.use(cors({
//     origin: 'http://localhost:5001', // Add your frontend URLs
//     credentials: true
// }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS) from the 'client' directory
app.use(express.static(path.join(__dirname, 'client')));

// Import routes
const authRoutes = require('./routes/authRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const productRoutes = require('./routes/productRoutes.js');
const bidRoutes = require('./routes/bidRoutes.js');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api', recommendationRoutes);
app.use('/api/interactions', interactionRoutes);

// DB reference for recommendations
mongoose.connection.once('open', () => {
    app.locals.db = mongoose.connection.db;
    console.log('MongoDB connected for recommendations');
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, './client/index.html'));
});

// Retrain recommendation model periodically
async function trainRecommendationModel() {
    try {
        const UserInteraction = require('./models/UserInteraction');
        const Product = require('./models/Product');

        // Get all interactions and products
        const interactions = await UserInteraction.find({}).lean();
        const products = await Product.find({ status: 'active' }).lean();

        // Prepare data for training
        const sparseMatrix = recommender.prepareData(interactions, products);
        
        // Train the model
        if (sparseMatrix.length > 0) {
            recommender.train(sparseMatrix);
            console.log('Recommendation model trained successfully');
        } else {
            console.log('No data available for training');
        }
    } catch (error) {
        console.error('Error training recommendation model:', error);
    }
}

// Train model on startup
mongoose.connection.once('open', async () => {
    app.locals.db = mongoose.connection.db;
    console.log('MongoDB connected for recommendations');
    await trainRecommendationModel();
});

// Retrain model every 24 hours
setInterval(trainRecommendationModel, 24 * 60 * 60 * 1000);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// SSL options
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'ssl/server.key')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl/server.crt'))
};

// Start server
const PORT = process.env.PORT;
https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`Server running on port ${PORT} with SSL`);
    console.log(`Visit https://localhost:${PORT} to view the site`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    // Close server & exit process
    process.exit(1);
});



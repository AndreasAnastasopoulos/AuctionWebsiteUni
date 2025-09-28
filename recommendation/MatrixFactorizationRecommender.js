// MatrixFactorizationRecommender.js
// Matrix Factorization Recommendation System for Auction Website

class MatrixFactorizationRecommender {
    constructor(options = {}) {
        // Hyperparameters
        this.k = options.k || 10; // Number of latent factors
        this.learningRate = options.learningRate || 0.01;
        this.regularization = options.regularization || 0.01;
        this.iterations = options.iterations || 100;
        this.minRating = options.minRating || 1;
        this.maxRating = options.maxRating || 5;

        // Model parameters
        this.userFactors = null;
        this.itemFactors = null;
        this.userBias = null;
        this.itemBias = null;
        this.globalBias = 0;

        // Mappings
        this.userIdToIndex = new Map();
        this.itemIdToIndex = new Map();
        this.indexToUserId = new Map();
        this.indexToItemId = new Map();

        // Category information for cold start
        this.itemCategories = new Map();
        this.categoryPopularity = new Map();
    }

    /**
     * Prepare data from MongoDB collections
     */
    prepareData(interactions, items) {
        // Create implicit ratings based on interaction types
        const ratingMatrix = [];

        // Store item categories for cold start recommendations
        items.forEach(item => {
            if (item.categories && Array.isArray(item.categories)) {
                this.itemCategories.set(item.itemId, item.categories);

                // Track category popularity
                item.categories.forEach(category => {
                    this.categoryPopularity.set(
                        category,
                        (this.categoryPopularity.get(category) || 0) + 1
                    );
                });
            }
        });

        // Process interactions and create implicit ratings
        interactions.forEach(interaction => {
            let rating = 0;

            // Assign weights based on interaction type
            switch (interaction.type) {
                case 'purchase':
                case 'won_auction':
                    rating = 5;
                    break;
                case 'bid':
                    // Higher rating for higher bid amounts relative to item price
                    rating = Math.min(4, 2 + (interaction.bidCount || 1) * 0.5);
                    break;
                case 'view':
                    // Rating based on view duration or frequency
                    const viewCount = interaction.viewCount || 1;
                    const viewDuration = interaction.viewDuration || 0;
                    rating = Math.min(3, 1 + Math.log(viewCount + 1) + viewDuration / 60);
                    break;
                case 'watchlist':
                    rating = 3.5;
                    break;
                default:
                    rating = 1;
            }

            if (rating > 0) {
                ratingMatrix.push({
                    userId: interaction.userId,
                    itemId: interaction.itemId,
                    rating: rating,
                    timestamp: interaction.timestamp || Date.now()
                });
            }
        });

        return this.createSparseMatrix(ratingMatrix);
    }

    /**
     * Create sparse matrix representation
     */
    createSparseMatrix(ratingData) {
        // Sort by timestamp to consider recency
        ratingData.sort((a, b) => b.timestamp - a.timestamp);

        // Create user and item mappings
        const userSet = new Set();
        const itemSet = new Set();

        ratingData.forEach(rating => {
            userSet.add(rating.userId);
            itemSet.add(rating.itemId);
        });

        let userIndex = 0;
        let itemIndex = 0;

        userSet.forEach(userId => {
            this.userIdToIndex.set(userId, userIndex);
            this.indexToUserId.set(userIndex, userId);
            userIndex++;
        });

        itemSet.forEach(itemId => {
            this.itemIdToIndex.set(itemId, itemIndex);
            this.indexToItemId.set(itemIndex, itemId);
            itemIndex++;
        });

        // Create sparse matrix
        const sparseMatrix = [];
        const recentFactor = 0.9; // Decay factor for older interactions
        const currentTime = Date.now();

        ratingData.forEach(rating => {
            const daysSinceInteraction = (currentTime - rating.timestamp) / (1000 * 60 * 60 * 24);
            const recencyWeight = Math.pow(recentFactor, daysSinceInteraction / 30); // Monthly decay

            sparseMatrix.push({
                user: this.userIdToIndex.get(rating.userId),
                item: this.itemIdToIndex.get(rating.itemId),
                rating: rating.rating * recencyWeight
            });
        });

        return sparseMatrix;
    }

    /**
     * Initialize factor matrices with small random values
     */
    initializeFactors(numUsers, numItems) {
        this.userFactors = Array(numUsers).fill(null).map(() =>
            Array(this.k).fill(0).map(() => (Math.random() - 0.5) * 0.01)
        );

        this.itemFactors = Array(numItems).fill(null).map(() =>
            Array(this.k).fill(0).map(() => (Math.random() - 0.5) * 0.01)
        );

        this.userBias = Array(numUsers).fill(0);
        this.itemBias = Array(numItems).fill(0);
    }

    /**
     * Train the matrix factorization model using SGD
     */
    train(sparseMatrix) {
        const numUsers = this.userIdToIndex.size;
        const numItems = this.itemIdToIndex.size;

        if (numUsers === 0 || numItems === 0) {
            console.log("No data to train on");
            return;
        }

        // Initialize factors
        this.initializeFactors(numUsers, numItems);

        // Calculate global bias
        this.globalBias = sparseMatrix.reduce((sum, r) => sum + r.rating, 0) / sparseMatrix.length;

        // Training loop
        for (let iter = 0; iter < this.iterations; iter++) {
            // Shuffle data for SGD
            const shuffled = [...sparseMatrix].sort(() => Math.random() - 0.5);

            let totalError = 0;

            shuffled.forEach(rating => {
                const prediction = this.predict(rating.user, rating.item);
                const error = rating.rating - prediction;

                totalError += error * error;

                // Update biases
                this.userBias[rating.user] += this.learningRate *
                    (error - this.regularization * this.userBias[rating.user]);
                this.itemBias[rating.item] += this.learningRate *
                    (error - this.regularization * this.itemBias[rating.item]);

                // Update factors
                for (let f = 0; f < this.k; f++) {
                    const userFeature = this.userFactors[rating.user][f];
                    const itemFeature = this.itemFactors[rating.item][f];

                    this.userFactors[rating.user][f] += this.learningRate *
                        (error * itemFeature - this.regularization * userFeature);
                    this.itemFactors[rating.item][f] += this.learningRate *
                        (error * userFeature - this.regularization * itemFeature);
                }
            });

            // Adaptive learning rate
            if (iter % 10 === 0) {
                this.learningRate *= 0.95;
                console.log(`Iteration ${iter}, MSE: ${totalError / shuffled.length}`);
            }
        }
    }

    /**
     * Predict rating for a user-item pair
     */
    predict(userIndex, itemIndex) {
        if (!this.userFactors || !this.itemFactors) {
            return this.globalBias || 2.5;
        }

        let prediction = this.globalBias +
            this.userBias[userIndex] +
            this.itemBias[itemIndex];

        for (let f = 0; f < this.k; f++) {
            prediction += this.userFactors[userIndex][f] * this.itemFactors[itemIndex][f];
        }

        return Math.max(this.minRating, Math.min(this.maxRating, prediction));
    }

    /**
     * Get recommendations for a user
     */
    getRecommendations(userId, n = 10, excludeItems = [], availableItems = null) {
        const userIndex = this.userIdToIndex.get(userId);

        // Handle cold start (new user or only views)
        if (userIndex === undefined || !this.userFactors) {
            return this.getColdStartRecommendations(userId, n, excludeItems, availableItems);
        }

        const recommendations = [];
        const excludeSet = new Set(excludeItems);
        const availableSet = availableItems ? new Set(availableItems) : null;

        // Score all items
        for (let [itemId, itemIndex] of this.itemIdToIndex) {
            if (excludeSet.has(itemId)) continue;
            if (availableSet && !availableSet.has(itemId)) continue;

            const score = this.predict(userIndex, itemIndex);
            recommendations.push({
                itemId: itemId,
                score: score,
                confidence: this.calculateConfidence(userIndex, itemIndex)
            });
        }

        // Sort by score and return top n
        recommendations.sort((a, b) => b.score - a.score);
        return recommendations.slice(0, n);
    }

    /**
     * Calculate confidence score for a prediction
     */
    calculateConfidence(userIndex, itemIndex) {
        // Simple confidence based on factor similarity
        let similarity = 0;
        for (let f = 0; f < this.k; f++) {
            similarity += Math.abs(this.userFactors[userIndex][f] * this.itemFactors[itemIndex][f]);
        }
        return Math.min(1, similarity / this.k);
    }

    /**
     * Handle cold start recommendations for new users or users with only views
     */
    getColdStartRecommendations(userId, n, excludeItems, availableItems) {
        const recommendations = [];
        const excludeSet = new Set(excludeItems);

        // For cold start, return empty array or implement popularity-based recommendations
        if (this.itemBias && availableItems) {
            for (let itemId of availableItems) {
                if (excludeSet.has(itemId)) continue;

                const itemIndex = this.itemIdToIndex.get(itemId);
                if (itemIndex !== undefined) {
                    recommendations.push({
                        itemId: itemId,
                        score: (this.itemBias[itemIndex] + this.globalBias) || 2.5,
                        confidence: 0.3 // Lower confidence for cold start
                    });
                }
            }
        }

        recommendations.sort((a, b) => b.score - a.score);
        return recommendations.slice(0, n);
    }

    /**
     * Get popular items by category
     */
    getPopularItemsByCategory(n, excludeItems, availableItems) {
        const recommendations = [];
        const excludeSet = new Set(excludeItems);
        const availableSet = availableItems ? new Set(availableItems) : null;

        // Score items based on their category popularity
        for (let [itemId, categories] of this.itemCategories) {
            if (excludeSet.has(itemId)) continue;
            if (availableSet && !availableSet.has(itemId)) continue;

            let categoryScore = 0;
            categories.forEach(category => {
                categoryScore += this.categoryPopularity.get(category) || 0;
            });

            recommendations.push({
                itemId: itemId,
                score: categoryScore / categories.length,
                confidence: 0.2
            });
        }

        recommendations.sort((a, b) => b.score - a.score);
        return recommendations.slice(0, n);
    }

    /**
     * Get similar items to a given item (for "you might also like")
     */
    getSimilarItems(itemId, n = 5) {
        const itemIndex = this.itemIdToIndex.get(itemId);
        if (itemIndex === undefined || !this.itemFactors) {
            return [];
        }

        const similarities = [];
        const targetFactors = this.itemFactors[itemIndex];

        for (let [otherItemId, otherIndex] of this.itemIdToIndex) {
            if (otherItemId === itemId) continue;

            // Calculate cosine similarity
            let dotProduct = 0;
            let norm1 = 0;
            let norm2 = 0;

            for (let f = 0; f < this.k; f++) {
                dotProduct += targetFactors[f] * this.itemFactors[otherIndex][f];
                norm1 += targetFactors[f] * targetFactors[f];
                norm2 += this.itemFactors[otherIndex][f] * this.itemFactors[otherIndex][f];
            }

            const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2) + 1e-8);

            similarities.push({
                itemId: otherItemId,
                similarity: similarity
            });
        }

        similarities.sort((a, b) => b.similarity - a.similarity);
        return similarities.slice(0, n);
    }

    /**
     * Save model to MongoDB
     */
    async saveModel(db) {
        const model = {
            timestamp: new Date(),
            hyperparameters: {
                k: this.k,
                learningRate: this.learningRate,
                regularization: this.regularization,
                iterations: this.iterations
            },
            userFactors: this.userFactors,
            itemFactors: this.itemFactors,
            userBias: this.userBias,
            itemBias: this.itemBias,
            globalBias: this.globalBias,
            mappings: {
                userIdToIndex: Array.from(this.userIdToIndex.entries()),
                itemIdToIndex: Array.from(this.itemIdToIndex.entries())
            },
            metadata: {
                itemCategories: Array.from(this.itemCategories.entries()),
                categoryPopularity: Array.from(this.categoryPopularity.entries())
            }
        };

        await db.collection('recommendation_models').replaceOne(
            { type: 'matrix_factorization' },
            { type: 'matrix_factorization', ...model },
            { upsert: true }
        );
    }

    /**
     * Load model from MongoDB
     */
    async loadModel(db) {
        const model = await db.collection('recommendation_models').findOne({
            type: 'matrix_factorization'
        });

        if (model) {
            this.k = model.hyperparameters.k;
            this.learningRate = model.hyperparameters.learningRate;
            this.regularization = model.hyperparameters.regularization;
            this.iterations = model.hyperparameters.iterations;

            this.userFactors = model.userFactors;
            this.itemFactors = model.itemFactors;
            this.userBias = model.userBias;
            this.itemBias = model.itemBias;
            this.globalBias = model.globalBias;

            this.userIdToIndex = new Map(model.mappings.userIdToIndex);
            this.itemIdToIndex = new Map(model.mappings.itemIdToIndex);

            // Rebuild reverse mappings
            this.indexToUserId.clear();
            this.indexToItemId.clear();

            for (let [userId, index] of this.userIdToIndex) {
                this.indexToUserId.set(index, userId);
            }

            for (let [itemId, index] of this.itemIdToIndex) {
                this.indexToItemId.set(index, itemId);
            }

            this.itemCategories = new Map(model.metadata.itemCategories || []);
            this.categoryPopularity = new Map(model.metadata.categoryPopularity || []);

            return true;
        }

        return false;
    }
}

// Export for Node.js
module.exports = MatrixFactorizationRecommender;
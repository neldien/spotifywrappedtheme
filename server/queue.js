const Bull = require('bull');
const Redis = require('ioredis');

// Configure Redis connection with auto-reconnect options
const redisClient = new Redis(process.env.REDIS_URL, {
    retryStrategy: (times) => Math.min(times * 50, 2000), // Retry delay increases exponentially
    reconnectOnError: (err) => {
        console.error('Redis reconnecting due to error:', err.message);
        return true; // Always attempt to reconnect
    },
    maxRetriesPerRequest: null, // Prevent errors during long retries
});

redisClient.on('connect', () => console.log('Connected to Redis.'));
redisClient.on('reconnecting', () => console.log('Reconnecting to Redis...'));
redisClient.on('error', (err) => console.error('Redis Error:', err));

const videoQueue = new Bull('video-generation', {
    redis: redisClient,
});

module.exports = videoQueue;
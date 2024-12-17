const Bull = require('bull');
const Redis = require('ioredis');

// Parse Redis URL and configure connection options
const redisUrl = process.env.REDIS_URL;
const isTLS = redisUrl.startsWith('rediss://');

const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
        if (times > 10) {
            console.error('Redis connection failed after 10 retries');
            return null;
        }
        return Math.min(times * 50, 2000);
    },
    reconnectOnError: (err) => {
        console.error('Redis reconnecting due to error:', err.message);
        return true;
    },
    tls: isTLS ? {
        rejectUnauthorized: false,
    } : undefined
};

const redisClient = new Redis(redisUrl, redisOptions);

redisClient.on('connect', () => console.log('Connected to Redis'));
redisClient.on('error', (err) => console.error('Redis Error:', err));
redisClient.on('reconnecting', () => console.log('Reconnecting to Redis...'));

const videoQueue = new Bull('video-generation', {
    redis: redisUrl,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        timeout: 600000 // 10 minutes
    }
});

module.exports = videoQueue;
const Bull = require('bull');
const Redis = require('ioredis');

// Parse Redis URL and configure connection options
const redisUrl = process.env.REDIS_URL;
const isTLS = redisUrl.startsWith('rediss://');

const redisOptions = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    retryStrategy: (times) => {
        if (times > 3) {
            console.error('Redis connection failed after 3 retries, giving up');
            return null;
        }
        const delay = Math.min(times * 1000, 3000);
        console.log(`Retrying Redis connection in ${delay}ms (attempt ${times})`);
        return delay;
    },
    tls: isTLS ? {
        rejectUnauthorized: false,
    } : undefined
};

// Create a single Redis client instance
const redisClient = new Redis(redisUrl, redisOptions);

redisClient.on('connect', () => console.log('Redis client connected'));
redisClient.on('error', (err) => console.error('Redis client error:', err));

// Configure Bull with a single Redis client
const videoQueue = new Bull('video-generation', {
    redis: redisClient,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        timeout: 600000, // 10 minutes
        removeOnComplete: true,
        removeOnFail: false
    }
});

// Add more detailed queue logging
videoQueue.on('error', (error) => {
    console.error('Queue Error:', error);
});

videoQueue.on('waiting', (jobId) => {
    console.log('Job waiting to be processed:', jobId);
});

videoQueue.on('active', (job) => {
    console.log('Job starting to be processed:', job.id);
});

videoQueue.on('completed', (job, result) => {
    console.log('Job completed:', job.id, result);
});

videoQueue.on('failed', (job, error) => {
    console.error('Job failed:', job.id, error);
});

module.exports = videoQueue;
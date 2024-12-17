const Bull = require('bull');
const Redis = require('ioredis');
require('dotenv').config();

// Parse Redis URL and configure connection options
const redisUrl = process.env.REDIS_URL;
const isTLS = redisUrl.startsWith('rediss://');

console.log('Connecting to Redis at:', redisUrl.split('@')[1]); // Log Redis host (safely)

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

// Configure Bull with the Redis URL directly
const videoQueue = new Bull('video-generation', redisUrl, {
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        timeout: 600000,
        removeOnComplete: true,
        removeOnFail: false
    }
});

// Add queue event handlers
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

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down queue...');
    await videoQueue.close();
    console.log('Queue shut down complete');
});

module.exports = videoQueue;
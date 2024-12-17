const Bull = require('bull');
require('dotenv').config();

// Parse Redis URL and configure connection options
const redisUrl = process.env.REDIS_URL;
const isTLS = redisUrl.startsWith('rediss://');

console.log('Redis Configuration:', {
    isTLS,
    url: redisUrl.split('@')[1], // Safe logging of host/port
    environment: process.env.NODE_ENV
});

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
    },
    redis: {
        tls: isTLS ? {
            rejectUnauthorized: false,
        } : undefined,
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
        }
    }
});

// Enhanced error logging
videoQueue.on('error', (error) => {
    console.error('Queue Error:', {
        message: error.message,
        stack: error.stack,
        code: error.code
    });
});

// More detailed event logging
videoQueue.on('waiting', (jobId) => {
    console.log('Job added to queue:', jobId);
});

videoQueue.on('active', (job) => {
    console.log('Job processing started:', {
        id: job.id,
        timestamp: new Date().toISOString()
    });
});

videoQueue.on('completed', (job, result) => {
    console.log('Job completed:', {
        id: job.id,
        result,
        timestamp: new Date().toISOString()
    });
});

videoQueue.on('failed', (job, error) => {
    console.error('Job failed:', {
        id: job.id,
        error: error.message,
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down queue...');
    await videoQueue.close();
    console.log('Queue shut down complete');
});

module.exports = videoQueue;
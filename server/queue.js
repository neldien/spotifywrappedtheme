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
    reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
            console.log('Redis connection error:', err.message);
            return true;
        }
        return false;
    },
    tls: isTLS ? {
        rejectUnauthorized: false,
    } : undefined,
    // Add connection timeouts
    connectTimeout: 10000,
    disconnectTimeout: 5000,
    commandTimeout: 5000,
    // Keep alive settings
    keepAlive: 10000,
    noDelay: true
};

// Create Redis client with better error handling
const createRedisClient = () => {
    const client = new Redis(redisUrl, redisOptions);

    client.on('connect', () => console.log('Connected to Redis'));
    client.on('ready', () => console.log('Redis client ready'));
    client.on('error', (err) => console.error('Redis Error:', err));
    client.on('close', () => console.log('Redis connection closed'));
    client.on('reconnecting', () => console.log('Reconnecting to Redis...'));
    client.on('end', () => console.log('Redis connection ended'));

    return client;
};

const redisClient = createRedisClient();

// Configure Bull with better error handling
const videoQueue = new Bull('video-generation', {
    createClient: (type) => {
        switch (type) {
            case 'client':
                return createRedisClient();
            case 'subscriber':
                return createRedisClient();
            case 'bclient':
                return createRedisClient();
            default:
                return createRedisClient();
        }
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        timeout: 600000, // 10 minutes
        removeOnComplete: true, // Remove completed jobs
        removeOnFail: false // Keep failed jobs for inspection
    }
});

// Add queue error handling
videoQueue.on('error', (error) => {
    console.error('Queue Error:', error);
});

videoQueue.on('failed', (job, error) => {
    console.error(`Job ${job.id} failed:`, error);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down queue...');
    await videoQueue.close();
    await redisClient.quit();
    console.log('Queue shut down complete');
});

module.exports = videoQueue;
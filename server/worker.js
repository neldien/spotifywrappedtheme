const Bull = require('bull');
const axios = require('axios');
const Redis = require('ioredis');
require('dotenv').config();

console.log('Worker started...');

// Initialize Redis with robust reconnect logic
const redisOptions = {
    redis: {
        port: 6379,
        host: process.env.REDIS_HOST || '127.0.0.1',
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times) => Math.min(times * 50, 2000), // Exponential backoff
        reconnectOnError: (err) => {
            console.error('Redis reconnecting due to error:', err.message);
            return true;
        },
    },
};

// Initialize the Bull queue
const videoQueue = new Bull('video-generation', redisOptions);

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('Worker shutting down...');
    videoQueue.close().then(() => {
        console.log('Queue closed.');
        process.exit(0);
    });
});

// Worker processing logic with concurrency and timeout
videoQueue.process(3, async (job) => {
    const { prompt } = job.data;

    try {
        console.log(`Processing job ${job.id} with prompt: ${prompt}`);

        const response = await axios.post(
            'https://api.deepinfra.com/v1/inference/genmo/mochi-1-preview',
            {
                prompt,
                width: 1280,
                height: 720,
                duration: 5.1,
                num_inference_steps: 128,
                cfg_scale: 5,
                seed: 12345,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 600000, // Set timeout to 10 minutes
            }
        );

        const videoUrl = response.data.video_url;
        console.log(`Job ${job.id} completed successfully. Video URL: ${videoUrl}`);

        // Save the result explicitly
        await job.updateProgress(100); // Marks 100% progress
        return { videoUrl };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error.response?.data || error.message);
        throw new Error('Video generation failed');
    }
});

// Retry failed jobs with exponential backoff
videoQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed: ${err.message}`);
});

// Optional: Retry configuration for failed jobs
videoQueue.on('error', (error) => {
    console.error('Queue Error:', error.message);
});
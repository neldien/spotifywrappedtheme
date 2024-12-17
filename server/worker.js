const Bull = require('bull');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const videoQueue = new Bull('video-generation', process.env.REDIS_URL);

console.log('Worker started...');

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('Worker shutting down...');
    videoQueue.close().then(() => process.exit(0));
});

// Process the video generation job with concurrency limit
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
                timeout: 600000,
            }
        );

        const videoUrl = response.data.video_url;
        console.log(`Job ${job.id} completed. Video URL: ${videoUrl}`);

        return { videoUrl };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error.response?.data || error.message);
        throw new Error('Video generation failed');
    }
});
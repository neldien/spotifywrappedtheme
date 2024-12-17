const videoQueue = require('./queue');
const axios = require('axios');
require('dotenv').config();

console.log('Worker started...');

// Process jobs with better error handling
videoQueue.process(async (job) => {
    console.log(`Starting job ${job.id}`);
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
        console.log(`Job ${job.id} completed successfully. Video URL: ${videoUrl}`);
        return { videoUrl };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error.message);
        throw new Error(`Video generation failed: ${error.message}`);
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Worker shutting down...');
    try {
        await videoQueue.close();
        console.log('Queue closed successfully');
    } catch (error) {
        console.error('Error during shutdown:', error);
    }
    process.exit(0);
});

// Keep the process running
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
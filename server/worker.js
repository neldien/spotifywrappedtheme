const videoQueue = require('./queue');
const axios = require('axios');
require('dotenv').config();

console.log('Worker started...');

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Worker shutting down...');
    await videoQueue.close();
    console.log('Queue closed. Exiting.');
    process.exit(0);
});

// Process jobs
videoQueue.process(async (job) => {
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
                timeout: 600000, // 10 minutes timeout
            }
        );

        const videoUrl = response.data.video_url;
        console.log(`Job ${job.id} completed successfully. Video URL: ${videoUrl}`);

        return { videoUrl };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error.message);
        throw new Error('Video generation failed');
    }
});

videoQueue.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed. Result: ${JSON.stringify(result)}`);
});

videoQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed: ${err.message}`);
});

videoQueue.on('error', (error) => {
    console.error('Queue Error:', error.message);
});
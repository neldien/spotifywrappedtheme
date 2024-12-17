const videoQueue = require('./queue');
const axios = require('axios');
require('dotenv').config();

console.log('Worker started with process ID:', process.pid);

videoQueue.process(async (job) => {
    console.log(`Starting to process job ${job.id}`);
    console.log('Job data:', job.data);
    
    const { prompt } = job.data;
    
    try {
        // Log the API request
        console.log(`Making API request to DeepInfra for job ${job.id}`);
        
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
        console.log(`Job ${job.id} completed successfully. Video URL:`, videoUrl);
        return { videoUrl };
    } catch (error) {
        console.error(`Job ${job.id} failed with error:`, error.message);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
        throw new Error(`Video generation failed: ${error.message}`);
    }
});

// Keep the process running
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
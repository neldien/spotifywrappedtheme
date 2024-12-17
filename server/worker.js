const videoQueue = require('./queue');
const axios = require('axios');
require('dotenv').config();

// Clean the endpoint URL
const MODEL_ENDPOINT = process.env.MODEL_ENDPOINT?.replace(/['"]/g, '');

console.log('Video generation worker started with config:', {
    modelEndpoint: MODEL_ENDPOINT,
    hasApiKey: !!process.env.DEEPINFRA_API_KEY
});

videoQueue.process(async (job) => {
    console.log(`Processing job ${job.id}`, {
        prompt: job.data.prompt?.substring(0, 100) + '...'
    });
    
    try {
        if (!process.env.DEEPINFRA_API_KEY) {
            throw new Error('DEEPINFRA_API_KEY not configured');
        }

        if (!MODEL_ENDPOINT) {
            throw new Error('MODEL_ENDPOINT not configured');
        }

        const payload = {
            prompt: job.data.prompt,
            width: 1280,
            height: 720,
            duration: 5.1,
            num_inference_steps: 128,
            cfg_scale: 5,
            seed: 12345,
        };

        console.log(`Making API request for job ${job.id} to ${MODEL_ENDPOINT}`);

        const response = await axios.post(
            MODEL_ENDPOINT,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`,
                    'Content-Type': 'application/json',
                }
            }
        );

        console.log(`API response for job ${job.id}:`, {
            status: response.status,
            hasVideoUrl: !!response.data.video_url
        });

        if (!response.data.video_url) {
            throw new Error('No video URL in response');
        }

        return { videoUrl: response.data.video_url };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            stack: error.stack
        });
        throw error;
    }
});
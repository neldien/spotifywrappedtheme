const videoQueue = require('./queue');
const axios = require('axios');
require('dotenv').config();

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
        // Using their default values from the API docs
        const payload = {
            prompt: job.data.prompt,
            width: 848,          // Default from docs
            height: 480,         // Default from docs
            duration: 5.1,       // Default from docs (max)
            num_inference_steps: 100,  // Default from docs
            cfg_scale: 4.5,      // Default from docs
            seed: 12345          // Optional
        };

        console.log(`Making API request for job ${job.id}`, {
            endpoint: MODEL_ENDPOINT,
            payloadLength: JSON.stringify(payload).length
        });

        const response = await axios.post(
            MODEL_ENDPOINT,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.DEEPINFRA_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`API response for job ${job.id}:`, {
            status: response.status,
            data: response.data
        });

        if (!response.data.video_url) {
            throw new Error('No video URL in response');
        }

        return { videoUrl: response.data.video_url };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        throw error;
    }
});
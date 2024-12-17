const videoQueue = require('./queue');
const axios = require('axios');
require('dotenv').config();

const MODEL_ENDPOINT = process.env.MODEL_ENDPOINT?.replace(/['"]/g, '');

console.log('Video generation worker started with config:', {
    modelEndpoint: MODEL_ENDPOINT,
    hasApiKey: !!process.env.DEEPINFRA_API_KEY
});

videoQueue.process(async (job) => {
    try {
        // Simplify and truncate the prompt
        const originalPrompt = job.data.prompt;
        const simplifiedPrompt = originalPrompt
            .split('Image Description:')[0] // Remove image description
            .replace(/\n/g, ' ') // Remove newlines
            .replace(/\s+/g, ' ') // Remove extra spaces
            .trim()
            .slice(0, 500); // Limit to 500 characters

        console.log(`Processing job ${job.id} with simplified prompt:`, simplifiedPrompt);

        const payload = {
            prompt: simplifiedPrompt,
            width: 848,
            height: 480,
            duration: 4.0,        // Slightly reduced
            num_inference_steps: 50,  // Reduced for faster processing
            cfg_scale: 4.5,
            seed: 12345
        };

        console.log(`Making API request for job ${job.id}`, {
            endpoint: MODEL_ENDPOINT,
            prompt: simplifiedPrompt,
            promptLength: simplifiedPrompt.length
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
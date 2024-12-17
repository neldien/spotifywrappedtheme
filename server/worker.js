const videoQueue = require('./queue');
const axios = require('axios');
require('dotenv').config();

console.log('Video generation worker started');

videoQueue.process(async (job) => {
    console.log(`Processing job ${job.id}`, job.data);
    
    try {
        const response = await axios.post(
            process.env.MODEL_ENDPOINT,
            {
                prompt: job.data.prompt,
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
                }
            }
        );

        if (!response.data.video_url) {
            throw new Error('No video URL in response');
        }

        console.log(`Job ${job.id} completed with URL:`, response.data.video_url);
        return { videoUrl: response.data.video_url };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        throw new Error(error.response?.data?.error || error.message);
    }
});
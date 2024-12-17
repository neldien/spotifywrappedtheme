const videoQueue = require('./queue');
const axios = require('axios');
require('dotenv').config();

console.log('Video generation worker started');

videoQueue.process(async (job) => {
    console.log(`Processing job ${job.id}`);
    
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

    console.log(`Job ${job.id} completed`);
    return { videoUrl: response.data.video_url };
});
const videoQueue = require('./queue');
const axios = require('axios');
require('dotenv').config();

console.log('Video generation worker started');

videoQueue.process(async (job) => {
    console.log(`Starting video generation job ${job.id}`);
    
    try {
        const apiUrl = "https://api.deepinfra.com/v1/inference/genmo/mochi-1-preview";
        
        const requestBody = {
            prompt: "A beautiful sunset over the ocean",
            width: 848,
            height: 480,
            duration: 4.0,
            num_inference_steps: 50,
            cfg_scale: 4.5,
            seed: 12345
        };

        console.log(`Sending request to DeepInfra API for job ${job.id}...`);
        
        const response = await axios.post(apiUrl, requestBody, {
            headers: {
                "Authorization": `Bearer ${process.env.DEEPINFRA_API_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.data.video_url) {
            throw new Error('No video URL in response');
        }

        console.log(`Job ${job.id} completed with video URL:`, response.data.video_url);
        return { downloadUrl: response.data.video_url };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
    }
});
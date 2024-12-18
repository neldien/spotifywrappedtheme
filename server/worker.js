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

        // The video_url is actually a base64 string
        const base64Data = response.data.video_url.split(',')[1]; // Remove the data:video/mp4;base64, prefix
        
        return { 
            videoData: base64Data,
            fileName: `video_${job.id}.mp4`,
            contentType: 'video/mp4'
        };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
    }
});
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

        // Get the video URL from the response
        const videoUrl = response.data.video_url;
        
        // Download the video as MP4
        const videoResponse = await axios.get(videoUrl, {
            responseType: 'arraybuffer'
        });

        // Upload to transfer.sh for downloadable link
        const uploadResponse = await axios.post('https://transfer.sh/', videoResponse.data, {
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename="video_${job.id}.mp4"`
            }
        });

        const downloadUrl = uploadResponse.data.trim();
        console.log(`Job ${job.id} completed with download URL:`, downloadUrl);
        
        return { 
            downloadUrl,
            fileName: `video_${job.id}.mp4`
        };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
    }
});
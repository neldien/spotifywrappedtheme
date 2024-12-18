const videoQueue = require('./queue');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
require('dotenv').config();

console.log('Video generation worker started');

videoQueue.process(async (job) => {
    console.log(`Starting video generation job ${job.id}`);
    
    try {
        const apiUrl = "https://api.deepinfra.com/v1/inference/genmo/mochi-1-preview";
        
        // Simple test prompt
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
        
        // Get video URL from DeepInfra
        const response = await axios.post(apiUrl, requestBody, {
            headers: {
                "Authorization": `Bearer ${process.env.DEEPINFRA_API_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.data.video_url) {
            throw new Error('No video URL in response');
        }

        // Download the video file
        console.log(`Downloading video for job ${job.id}...`);
        const videoResponse = await axios({
            method: 'GET',
            url: response.data.video_url,
            responseType: 'arraybuffer'
        });

        // Create videos directory if it doesn't exist
        const videoDir = path.join(__dirname, 'videos');
        if (!fs.existsSync(videoDir)) {
            fs.mkdirSync(videoDir);
        }

        // Save the video file
        const fileName = `video_${job.id}.mp4`;
        const filePath = path.join(videoDir, fileName);
        await writeFile(filePath, videoResponse.data);

        console.log(`Video saved for job ${job.id} at: ${filePath}`);

        return { 
            videoUrl: response.data.video_url,
            filePath: filePath,
            fileName: fileName
        };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        throw error;
    }
});
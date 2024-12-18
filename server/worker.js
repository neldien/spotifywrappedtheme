const videoQueue = require('./queue');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create videos directory if it doesn't exist
const videosDir = path.join(__dirname, 'videos');
if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir);
}

// Clean up old videos (older than 1 hour)
const cleanupOldVideos = () => {
    const files = fs.readdirSync(videosDir);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    files.forEach(file => {
        const filePath = path.join(videosDir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < oneHourAgo) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up old video: ${file}`);
        }
    });
};

// Run cleanup every hour
setInterval(cleanupOldVideos, 60 * 60 * 1000);

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
        const base64Data = response.data.video_url.split(',')[1];
        const fileName = `video_${job.id}.mp4`;
        const filePath = path.join(videosDir, fileName);
        
        // Save the video file
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        console.log(`Saved video to ${filePath}`);
        
        return { 
            fileName,
            filePath,
            contentType: 'video/mp4'
        };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
    }
});
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
    const { prompt } = job.data;
    console.log(`Processing video generation for job ${job.id}`);

    try {
        const response = await axios.post(
            "https://api.deepinfra.com/v1/inference/genmo/mochi-1-preview",
            {
                prompt,
                width: 848,
                height: 480,
                duration: 5.1,
                num_inference_steps: 64,
                cfg_scale: 4.5,
                seed: 12345,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const videoUrl = response.data.video_url;
        console.log(`Job ${job.id} completed with video URL: ${videoUrl}`);
        return { videoUrl };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
    }
});
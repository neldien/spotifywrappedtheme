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
    const { imagePrompt } = job.data;

    try {
        console.log(`Starting job ${job.id} with prompt: ${imagePrompt}`);
        console.log('Sending request to DeepInfra API...');
        
        const response = await axios.post(
            'https://api.deepinfra.com/v1/inference/genmo/mochi-1-preview',
            { prompt: imagePrompt, width: 1280, height: 720, duration: 5.1 },
            { headers: { Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}` } }
        );
        
        console.log(`API response for job ${job.id}:`, response.data);

        if (!response.data.video_url) {
            throw new Error('Video URL missing from response');
        }

        const videoUrl = response.data.video_url;
        const fileName = `video-${job.id}.mp4`;
        console.log(`Downloading video for job ${job.id} from ${videoUrl}`);

        const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
        const filePath = path.join(__dirname, 'videos', fileName);
        fs.writeFileSync(filePath, videoResponse.data);

        console.log(`Video for job ${job.id} saved as ${fileName}`);
        return { fileName };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error.message);
        throw error;
    }
});
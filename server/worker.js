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
        console.log('DeepInfra Response:', response.data);

        // Assuming response.data.video_url is a base64 string
        const base64Data = response.data.video_url.split(',')[1]; // Remove data URL prefix if present
        const buffer = Buffer.from(base64Data, 'base64');

        // Save the decoded video to a file
        const fileName = `video_${job.id}.mp4`;
        const filePath = path.join(videosDir, fileName);
        fs.writeFileSync(filePath, buffer);
        console.log(`Job ${job.id} completed with video saved as: ${fileName}`);

        return { fileName };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
    }
});
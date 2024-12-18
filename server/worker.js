const videoQueue = require('./queue');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Set the desired download directory
// For example: `~/Downloads` for macOS/Linux or `C:/Users/YourUserName/Downloads` for Windows
const downloadDir = path.resolve(process.env.HOME || process.env.USERPROFILE, 'Downloads');

// Ensure the download directory exists
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
}

console.log(`Videos will be saved to: ${downloadDir}`);

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

        if (response.data.inference_status.status === 'succeeded') {
            const videoUrl = response.data.video_url;
            const base64Data = videoUrl.split(',')[1]; // Extract base64 data
            const videoPath = path.join(downloadDir, `video_${job.id}.mp4`);

            // Save base64 data as MP4 file
            fs.writeFileSync(videoPath, base64Data, { encoding: 'base64' });
            console.log(`Job ${job.id} completed. Video saved at: ${videoPath}`);

            // Return video path as result
            return { videoPath };
        } else {
            console.error(`Job ${job.id} failed:`, response.data.inference_status);
            throw new Error('Video generation failed');
        }
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error.message);
        throw error;
    }
});
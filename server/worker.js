const videoQueue = require('./queue');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Temporary directory to store downloaded videos
const videosDir = path.join(__dirname, 'videos');

// Ensure the directory exists
if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
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

        if (response.data.inference_status.status === 'succeeded') {
            const videoUrl = response.data.video_url;
            const videoFilePath = path.join(videosDir, `job-${job.id}.mp4`);

            console.log(`Downloading video for job ${job.id}...`);
            const videoResponse = await axios({
                method: 'GET',
                url: videoUrl,
                responseType: 'stream',
            });

            const writer = fs.createWriteStream(videoFilePath);
            videoResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            console.log(`Job ${job.id} completed, video saved: ${videoFilePath}`);

            return { filePath: `/videos/job-${job.id}.mp4` };
        } else {
            throw new Error(`Job ${job.id} failed: ${response.data.inference_status.status}`);
        }
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
    }
});
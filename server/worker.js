const videoQueue = require('./queue');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { videosDir } = require('./server');

// Create a directory for storing videos if it doesn't exist
if (process.env.WORKER_ROLE == 'true') {
    if (!fs.existsSync(videosDir)) {
        fs.mkdirSync(videosDir);
        console.log(`Server created videos directory at: ${videosDir}`);
    }
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

        // Extract and decode the Base64 video data
        const base64Data = response.data.video_url.split(',')[1]; // Remove the data URL prefix, if present
        if (!base64Data) {
            throw new Error('Invalid Base64 data received from DeepInfra API');
        }

        const buffer = Buffer.from(base64Data, 'base64');

        // Save the decoded video to a file
        const fileName = `video_${job.id}.mp4`;
        const filePath = path.join(videosDir, fileName);

        // Write the buffer to a file
        fs.writeFileSync(filePath, buffer);

        console.log(`Job ${job.id} completed successfully. Video saved at: ${filePath}`);

        // Return the file name as the job result
        return { fileName };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error.message || error);
        throw new Error(`Job ${job.id} failed: ${error.message || 'Unknown error'}`);
    }
});
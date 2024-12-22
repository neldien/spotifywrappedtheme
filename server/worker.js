const videoQueue = require('./queue');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const AWS = require('aws-sdk');


const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION, // E.g., 'us-east-1'
});
const bucketName = process.env.AWS_S3_BUCKET_NAME;

async function uploadToS3(base64Data, bucketName, key) {
    const buffer = Buffer.from(base64Data, 'base64');
    const params = {
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'video/mp4'
    };

    return s3.upload(params).promise();
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

        const base64Data = response.data.video_url.split(',')[1];
        console.log(base64Data);
        const s3Key = `videos/video_${job.id}.mp4`;
        const uploadResult = await uploadToS3(base64Data, bucketName, s3Key);

        console.log(`Video uploaded to S3: ${uploadResult.Location}`);

        return { videoUrl: uploadResult.Location };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error.message || error);
        throw new Error(`Job ${job.id} failed: ${error.message || 'Unknown error'}`);
    }
});
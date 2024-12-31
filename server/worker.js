const videoQueue = require('./queue');
const axios = require('axios');
require('dotenv').config();
const AWS = require('aws-sdk');
const nodemailer = require('nodemailer');


// Nodemailer Configuration
const transporter = nodemailer.createTransport({
    host: 'smtp.porkbun.com',
    port: 587,
    secure: false,    auth: {
        user: process.env.EMAIL_USER, // Email address
        pass: process.env.EMAIL_PASS, // App password or email password
    },
});

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
    const { prompt, email } = job.data; // Add email to job data
    console.log(`Processing video generation for job ${job.id} for email: ${email}`);

    try {
        // Step 1: Generate the video
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
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
        const s3Key = `videos/${email.replace('@', '_')}_${timestamp}_${job.id}.mp4`;      

        // Step 2: Upload to S3
        const uploadResult = await uploadToS3(base64Data, bucketName, s3Key);
        const videoUrl = uploadResult.Location;

        console.log(`Video uploaded to S3: ${videoUrl}`);

                // Step 3: Send Email
                const mailOptions = {
                    from: '"Your Wrapped Theme" hello@wrappedthemegpt.com', // Sender email
                    to: email, // Recipient email
                    subject: 'Your Wrapped Vibe Video is Ready!',
                    text: `Your video is ready! Click the link below to download:\n\n${videoUrl}`,
                    html: `<p>Your video is ready! Click the link below to download:</p><a href="${videoUrl}">${videoUrl}</a>`,
                };

                await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${email}`);

        return { videoUrl };
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error.message || error);
        throw new Error(`Job ${job.id} failed: ${error.message || 'Unknown error'}`);
    }
});
const Bull = require('bull');
const axios = require('axios');
require('dotenv').config();

const videoQueue = new Bull('video-generation', process.env.REDIS_URL, {
  redis: {
    tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined, // Enable TLS if needed
  },
});

console.log('Worker started. Waiting for jobs...');

// Process jobs without timeout (custom error handling ensures no abrupt exits)
videoQueue.process(async (job) => {
  const { prompt } = job.data;

  console.log(`Processing job ${job.id} with prompt: ${prompt}`);

  try {
    const apiUrl = 'https://api.deepinfra.com/v1/inference/genmo/mochi-1-preview';
    console.log(`Sending request to ${apiUrl} for job ${job.id}`);

    const response = await axios.post(
      apiUrl,
      {
        prompt,
        width: 1280,
        height: 720,
        duration: 5.1,
        num_inference_steps: 128,
        cfg_scale: 5,
        seed: 12345,
      },
      {
        headers: { Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}` },
        timeout: 0, // No timeout
      }
    );

    const videoUrl = response.data.video_url;
    console.log(`Job ${job.id} completed. Video URL: ${videoUrl}`);

    return { videoUrl };
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error.response?.data || error.message);
    throw new Error('Video generation failed');
  }
});

// Retry logic
videoQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed after retries: ${err.message}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await videoQueue.close();
  process.exit(0);
});
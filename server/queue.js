const Bull = require('bull');
require('dotenv').config();

const videoQueue = new Bull('video-generation', process.env.REDIS_URL, {
    redis: {
        tls: {
            rejectUnauthorized: false
        }
    }
});

// Basic error logging
videoQueue.on('error', (error) => {
    console.error('Queue Error:', error.message);
});

module.exports = videoQueue;
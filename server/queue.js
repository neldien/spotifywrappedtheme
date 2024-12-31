const Bull = require('bull');
require('dotenv').config();

const videoQueue = new Bull('video-generation', process.env.REDIS_URL, {
    redis: {
        tls: {
            rejectUnauthorized: false
        }
    }
});

module.exports = videoQueue;
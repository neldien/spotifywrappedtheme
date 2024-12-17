const Bull = require('bull');
require('dotenv').config();

const videoQueue = new Bull('video-generation', process.env.REDIS_URL);

module.exports = videoQueue;

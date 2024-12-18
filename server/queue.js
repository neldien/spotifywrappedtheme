const Bull = require('bull');
require('dotenv').config();

const testQueue = new Bull('test-queue', process.env.REDIS_URL, {
    redis: {
        tls: {
            rejectUnauthorized: false
        }
    }
});

module.exports = testQueue;
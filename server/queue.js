const Bull = require('bull');
require('dotenv').config();

const videoQueue = new Bull('video-generation', process.env.REDIS_URL, {
    redis: {
        tls: {
            rejectUnauthorized: false
        }
    }
});
// Add a new job with the user's email
app.post('/api/generate-video', async (req, res) => {
    const { prompt, email } = req.body;

    if (!prompt || !email) {
        return res.status(400).json({ error: 'Prompt and email are required' });
    }

    try {
        const job = await videoQueue.add({ prompt, email });
        res.json({ message: 'Your video is being processed. You will receive an email shortly (we use the email tied to your Spotify account!).', jobId: job.id });
    } catch (error) {
        console.error('Error adding job to queue:', error.message);
        res.status(500).json({ error: 'Failed to process your request.' });
    }
});

module.exports = videoQueue;
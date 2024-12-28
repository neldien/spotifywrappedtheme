require('dotenv').config();
const express = require('express');
const videoQueue = require('./queue');
const axios = require('axios');
const cors = require('cors');
const { OpenAI } = require("openai");
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });
const app = express();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PORT = process.env.PORT || 5001;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

const allowedOrigins = ['https://wrappedthemegpt.com', 'http://localhost:5001'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: 'GET,POST,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization'
}));

const videosDir = path.join(__dirname, 'videos');

app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.use(express.json());

// Serve the React build from the client folder
app.use(express.static(path.join(__dirname, '../client/build')));

// API routes
app.get('/api', (req, res) => {
    res.json({ message: "API is running!" });
});

app.get('/', (req, res) => {
    res.send('Server is running!');
});

// Redirect to Spotify's authorization page
app.get('/login', (req, res) => {
    const scope = 'user-read-email user-read-private';
    const authUrl = `https://accounts.spotify.com/authorize?${querystring.stringify({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: scope,
        redirect_uri: REDIRECT_URI,
    })}`;
    res.redirect(authUrl);
});

// Handle the callback from Spotify
app.get('/callback', async (req, res) => {
    const code = req.query.code || null;

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
            code: code,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        }), {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const accessToken = response.data.access_token;
        req.session.accessToken = accessToken;

        // Fetch user profile
        const userProfile = await axios.get('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });

        req.session.user = {
            name: userProfile.data.display_name,
            email: userProfile.data.email
        };

        res.redirect('/');
    } catch (error) {
        console.error('Error during authentication:', error.message);
        res.redirect('/error');
    }
});
// Endpoint to get user information
app.get('/user-info', (req, res) => {
    if (req.session.user) {
        res.json({
            name: req.session.user.name,
            email: req.session.user.email
        });
    } else {
        res.status(401).json({ error: 'User not authenticated' });
    }
});

// Step 3: Use access token to fetch Spotify data

app.get('/top-tracks', isAuthenticated, async (req, res) => {
    const { time_range = 'long_term' } = req.query; // Default to long_term
    const accessToken = req.session.accessToken; // Retrieve token from session

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: { time_range, limit: 50 },
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching top tracks:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch top tracks' });
    }
});

app.get('/top-artists', isAuthenticated, async (req, res) => {
    const { time_range = 'long_term' } = req.query; // Default to long_term
    const accessToken = req.session.accessToken; // Retrieve token from session

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/top/artists', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: { time_range, limit: 50 },
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching top artists:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch top artists' });
    }
});

app.get('/top-summary', isAuthenticated, async (req, res) => {
    const accessToken = req.session.accessToken; // Retrieve token from session

    try {
        // Fetch top tracks
        const tracksResponse = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { time_range: 'long_term', limit: 30 },
        });

        // Fetch top artists
        const artistsResponse = await axios.get('https://api.spotify.com/v1/me/top/artists', {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { time_range: 'long_term', limit: 30 },
        });

        res.json({
            topTracks: tracksResponse.data.items,
            topArtists: artistsResponse.data.items,
        });
    } catch (error) {
        console.error('Error fetching top summary:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch top summary' });
    }
});

app.get('/api/queue-status', async (req, res) => {
    try {
        const counts = await videoQueue.getJobCounts();
        const isReady = await videoQueue.isReady();
        
        res.json({
            status: 'ok',
            isReady,
            counts,
            redis: {
                url: process.env.REDIS_URL.split('@')[1], // Safe logging
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Queue status check failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint to Generate Prompts
app.post('/generate-video-prompt', async (req, res) => {
    const { musicSummary, imageDescription } = req.body;

    try {
        const videoPromptTemplate = `
        Transform the following input into a video creation prompt where the primary focus is on the subjects described in the image:
        
        1. Subjects: "${imageDescription}". These individuals or elements must be the main focus of the scene. Center the visuals around their appearance, actions, and presence.
        
        2. Scene Guidelines:
        - The scene should reflect the **energy, mood, and themes** suggested by the following summary: "${musicSummary}".
        - Avoid mentioning any other musicians, artists, or tracks from the summary. Use only its themes, vibes, and imagery for inspiration.
        - Describe a vivid, cinematic scene with details like location, time of day, lighting, and colors.
        - Include dynamic movement or actions that highlight the subjects' involvement in the scene.
        - Add cinematic details: camera angles, textures, moods, and visual effects.
        
        3. Length: Keep the description under 120 words, ensuring it is concise and focused.
        
        **Goal**: Create a visually captivating and engaging scene where the subjects described in the image take center stage, inspired by the themes of the summary.
        `;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: "user", content: videoPromptTemplate }],
            max_tokens: 150,
        });

        const optimizedPrompt = response.choices[0].message.content;

        // Add job to the queue with the optimized prompt
        const job = await videoQueue.add({ prompt: optimizedPrompt });
        res.json({ jobId: job.id, optimizedPrompt });
    } catch (error) {
        console.error('Error generating video prompt:', error.message);
        res.status(500).json({ error: "Failed to generate video prompt" });
    }
});

app.post('/generate-music-prompt', async (req, res) => {
    const { musicSummary } = req.body;

    try {
        const musicPromptTemplate = `
            Transform the following music summary into a music creation prompt for an AI model:
            "${musicSummary}"
            Guidelines:
            - Describe the music genre, mood, and key instruments.
            - Specify a tempo or style (e.g., upbeat, lo-fi, cinematic).
            - Include 2-3 descriptive phrases that evoke strong imagery.
            - Keep it under 200 characters.
        `;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: "user", content: musicPromptTemplate }],
            max_tokens: 100,
        });

        const musicPrompt = response.choices[0].message.content;
        res.json({ musicPrompt });
    } catch (error) {
        console.error('Error generating music prompt:', error.message);
        res.status(500).json({ error: "Failed to generate music prompt" });
    }
});

// Start video generation
app.post('/generate-video', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        console.error("Invalid or missing 'prompt'");
        return res.status(400).json({ error: "The 'prompt' field is required." });
    }

    try {
        const job = await videoQueue.add({ prompt });
        console.log(`Job ${job.id} added to the queue.`);
        res.status(202).json({ jobId: job.id });
    } catch (error) {
        console.error('Error adding job to queue:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/job-status/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const job = await videoQueue.getJob(id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.finishedOn) {
            return res.status(200).json({ state: 'completed', videoUrl: job.returnvalue.videoUrl });
        } else if (job.failedReason) {
            return res.status(500).json({ state: 'failed', error: job.failedReason });
        } else {
            return res.status(200).json({ state: 'processing' });
        }
    } catch (error) {
        console.error('Error fetching job status:', error);
        res.status(500).json({ error: error.message });
    }
});
// Generate Music Summary with ChatGPT
app.post('/generate-summary', async (req, res) => {
    const { topArtists, topTracks } = req.body;

    try {
        const artistNames = topArtists.map((artist) => artist.name).join(', ');
        const trackNames = topTracks.map((track) => track.name).slice(0, 5).join(', ');

        const prompt = `
            Summarize my music taste in a fun, creative way. 
            My favorite artists are: ${artistNames}. 
            My favorite tracks are: ${trackNames}. 
            Describe the energy, vibe, and themes of this music taste. be colorful and descriptive. 
            Keep it under 100 words, only use a few of the artists and tracks names.
             i dont want to be overwhelmed. feel free to break it into paragraphs and what not.
        `;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: "user", content: prompt }],
            max_tokens: 250,
        });

        const summary = response.choices[0].message.content;
        res.json({ summary });
    } catch (error) {
        console.error('Error generating summary:', error.message);
        res.status(500).json({ error: "Failed to generate music summary" });
    }
});

app.post('/describe-image', upload.single('image'), async (req, res) => {
    try {
        const filePath = req.file.path;

        // Send the image to OpenAI GPT-4 Vision
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // OpenAI GPT-4 Vision model
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Describe this image in an accurate way, including physical features of the individual, so that it can be used in a video prompt. be concise, do it in less than 50 words" },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${fs.readFileSync(filePath, { encoding: 'base64' })}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 250,
        });

        // Cleanup uploaded file
        fs.unlinkSync(filePath);

        // Extract description
        const description = response.choices[0].message.content;
        res.json({ description });
    } catch (error) {
        console.error("Error describing image:", error.message);
        res.status(500).json({ error: "Failed to process the image." });
    }
});

// Clear queue (for maintenance)
app.post('/api/clear-queue', async (req, res) => {
    try {
        // Clear all jobs from queue
        await videoQueue.empty();
        
        // Get all jobs (including active and completed)
        const jobs = await videoQueue.getJobs();
        
        // Remove each job
        for (const job of jobs) {
            await job.remove();
        }
        
        console.log('Queue cleared successfully');
        res.json({ message: 'Queue cleared successfully' });
    } catch (error) {
        console.error('Error clearing queue:', error);
        res.status(500).json({ error: 'Failed to clear queue' });
    }
});

// Get queue status
app.get('/api/queue-status', async (req, res) => {
    try {
        const counts = await videoQueue.getJobCounts();
        res.json({
            counts,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting queue status:', error);
        res.status(500).json({ error: 'Failed to get queue status' });
    }
});


app.get('/videos/:fileName', (req, res) => {
    const filePath = path.join(__dirname, 'videos', req.params.fileName);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Video not found' });
    }

    // Stream the video file
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;
        const chunksize = (end-start)+1;
        const file = fs.createReadStream(filePath, {start, end});
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

app.get('/view-video/:jobId', async (req, res) => {
    try {
        const job = await videoQueue.getJob(req.params.jobId);
        if (!job || !job.returnvalue?.fileName) {
            return res.status(404).send('Video not found');
        }

        res.send(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Video Viewer</title>
                    <style>
                        body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000; }
                        video { max-width: 100%; max-height: 100vh; }
                    </style>
                </head>
                <body>
                    <video controls autoplay loop>
                        <source src="/videos/${job.returnvalue.fileName}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Error loading video: ' + error.message);
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const isReady = await videoQueue.isReady();
        const counts = await videoQueue.getJobCounts();
        
        res.json({
            status: 'ok',
            queueReady: isReady,
            jobCounts: counts,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            error: error.message
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});


module.exports = { app, videosDir };

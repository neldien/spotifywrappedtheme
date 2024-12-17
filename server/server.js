require('dotenv').config();
const express = require('express');
const videoQueue = require('./queue');
const axios = require('axios');
const cors = require('cors');
const { OpenAI } = require("openai");
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' }); // Save uploads temporarily to 'uploads' folder
const app = express();

// ChatGPT API Setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PORT = process.env.PORT || 5001;

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;


const allowedOrigins = ['https://wrappedthemegpt.com', 'http://localhost:3000'];

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
app.use(express.json());

// Serve the React build from the client folder
app.use(express.static(path.join(__dirname, '../client/build')));

// API routes
app.get('/api', (req, res) => {
    res.json({ message: "API is running!" });
});

// Serve React frontend for all other routes


app.get('/', (req, res) => {
    res.send('Server is running!');
});

// Step 1: Redirect user to Spotify login
app.get('/login', (req, res) => {
    const scope = 'user-top-read playlist-read-private playlist-read-collaborative';
    const authURL = `https://accounts.spotify.com/authorize?response_type=code&client_id=${process.env.SPOTIFY_CLIENT_ID}&scope=${scope}&redirect_uri=${process.env.SPOTIFY_REDIRECT_URI}&show_dialog=false`;
    res.redirect(authURL);
});

// Step 2: Handle the callback from Spotify
app.get('/callback', async (req, res) => {
    const code = req.query.code;

    try {
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        const { access_token, refresh_token } = response.data;

        // Redirect to frontend with tokens as query parameters
        res.redirect(`${process.env.CLIENT_URL}?access_token=${access_token}&refresh_token=${refresh_token}`);
    } catch (error) {
        console.error('Error exchanging code for tokens:', error.message);
        res.status(500).send('Authentication failed');
    }
});

// Step 3: Use access token to fetch Spotify data
app.get('/top-tracks', async (req, res) => {
    const { access_token, time_range = 'long_term' } = req.query; // Default to long_term if time_range is missing
    console.log('Received time_range from frontend:', time_range); // Log the time_range received

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
            params: { time_range, limit: 50 }, // Pass time_range to Spotify
        });

        console.log('Response from Spotify API:', response.data); // Log Spotify's response
        res.json(response.data); // Send response back to frontend
    } catch (error) {
        console.error('Error from Spotify API:', error.response?.data || error.message); // Log Spotify errors
        res.status(500).send('Failed to fetch top tracks');
    }
});

// Fetch all playlists of the current user
// Fetch all playlists, including paginated results
app.get('/playlists', async (req, res) => {
    const { access_token } = req.query; // Access token from query parameters
    try {
        const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        res.json(response.data); // Send the playlists to the frontend
    } catch (error) {
        console.error('Error fetching playlists:', error.response?.data || error.message);
        res.status(500).send('Failed to fetch playlists');
    }
});

app.get('/top-artists', async (req, res) => {
    const { access_token, time_range = 'long_term' } = req.query; // Default to long_term

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/top/artists', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
            params: {
                time_range,
                limit: 50, // Max 50 items per request
            },
        });

        res.json(response.data); // Return top artists
    } catch (error) {
        console.error('Error fetching top artists:', error.response?.data || error.message);
        res.status(500).send('Failed to fetch top artists');
    }
});


app.get('/top-summary', async (req, res) => {
    const { access_token } = req.query;

    try {
        // Fetch top tracks
        const tracksResponse = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
            headers: { Authorization: `Bearer ${access_token}` },
            params: { time_range: 'long_term', limit: 30 },
        });

        // Fetch top artists
        const artistsResponse = await axios.get('https://api.spotify.com/v1/me/top/artists', {
            headers: { Authorization: `Bearer ${access_token}` },
            params: { time_range: 'long_term', limit: 30 },
        });

        res.json({
            topTracks: tracksResponse.data.items,
            topArtists: artistsResponse.data.items,
        });
    } catch (error) {
        console.error('Error fetching top summary:', error.response?.data || error.message);
        res.status(500).send('Failed to fetch top summary');
    }
});

app.get('/job-status/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const job = await videoQueue.getJob(id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const state = await job.getState();
        const result = job.returnvalue;

        res.json({ state, result });
    } catch (error) {
        console.error('Error fetching job status:', error.message);
        res.status(500).json({ error: 'Failed to fetch job status' });
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

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
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
        res.json({ optimizedPrompt });
    } catch (error) {
        console.error('Error optimizing video prompt:', error.message);
        res.status(500).json({ error: "Failed to optimize video prompt" });
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

app.post('/generate-video', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "The 'prompt' field is required." });
    }

    try {
        // Add job to the queue
        const job = await videoQueue.add({ prompt });

        console.log(`Job ${job.id} added to the queue`);

        // Respond immediately with job ID
        res.status(202).json({
            jobId: job.id,
            message: 'Video generation job enqueued. Check job status later.',
        });
    } catch (error) {
        console.error('Error adding job to queue:', error.message);
        res.status(500).json({ error: 'Failed to enqueue job.' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
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
            Describe the energy, vibe, and themes of this music taste. 
            Keep it under 150 words, dont feel the need to use all the artists or tracks. i dont want to be overwhelmed. feel free to break it into paragraphs and what not.
        `;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: "user", content: prompt }],
            max_tokens: 400,
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
                        { type: "text", text: "Describe this image in an accurate way, including physical features of the individual, so that it can be used in a video prompt. be concise" },
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

app.get('/redis-health', async (req, res) => {
    try {
        const queueHealth = await videoQueue.checkHealth();
        const queueCount = await videoQueue.count();
        
        res.json({
            status: 'ok',
            redis: {
                connected: true,
                url: process.env.REDIS_URL.split('@')[1], // Safe logging
                jobsCount: queueCount
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

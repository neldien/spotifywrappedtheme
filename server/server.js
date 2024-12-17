require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { OpenAI } = require("openai");
const path = require('path');

// ChatGPT API Setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const PORT = process.env.PORT || 5001;

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:5001/callback';
const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;

app.use(cors());
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
    const authURL = `https://accounts.spotify.com/authorize?response_type=code&client_id=${process.env.SPOTIFY_CLIENT_ID}&scope=${scope}&redirect_uri=${process.env.SPOTIFY_REDIRECT_URI}`;
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
        res.redirect(`http://localhost:3000?access_token=${access_token}&refresh_token=${refresh_token}`);
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

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// Endpoint to Generate Prompts
app.post('/generate-video-prompt', async (req, res) => {
    const { musicSummary } = req.body;

    try {
        const videoPromptTemplate = `
            Transform the following music summary into a video creation prompt: "${musicSummary}"
            Follow these guidelines:
            - Describe a vivid visual scene (e.g., location, time of day, lighting, colors).
            - Include movement or dynamic actions.
            - Add specific cinematic details like camera angles, textures, and moods.
            - Keep it under 100 words for optimal text-to-video generation.
        `;

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: "user", content: videoPromptTemplate }],
            max_tokens: 120,
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
            model: 'gpt-4',
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
    const { prompt } = req.body; // Expect "prompt" field

    if (!prompt) {
        console.error("Invalid or missing 'prompt'");
        return res.status(400).json({ error: "The 'prompt' field is required." });
    }

    try {
        const response = await axios.post(
            "https://api.deepinfra.com/v1/inference/genmo/mochi-1-preview",
            {
                prompt, // Pass the prompt to DeepInfra
                width: 848,
                height: 480,
                duration: 5.1,
                num_inference_steps: 64,
                cfg_scale: 4.5,
                seed: 12345,
            },
            {
                headers: {
                    Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const videoUrl = response.data.video_url;
        res.json({ videoUrl });
    } catch (error) {
        console.error("Error generating video with DeepInfra:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to generate video using DeepInfra." });
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
            Describe the energy, vibe, and themes of this music taste. 
            Keep it under 200 words.
        `;

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
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


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [accessToken, setAccessToken] = useState('');
  const [topSummary, setTopSummary] = useState(null);
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  // Function to extract access token from URL
  const extractAccessToken = () => {
    const query = new URLSearchParams(window.location.search);
    const token = query.get('access_token');
    if (token) {
      setAccessToken(token);
      fetchTopSummary(token);
    }
  };

  // Fetch Top Summary (Long-Term Artists and Tracks)
  const fetchTopSummary = async (token) => {
    try {
      const response = await axios.get('http://localhost:5001/top-summary', {
        params: { access_token: token },
      });
      console.log('Original Top Summary:', response.data);

      const reducedPayload = {
        topArtists: response.data.topArtists.map((artist) => ({
          id: artist.id,
          name: artist.name,
          genres: artist.genres,
        })),
        topTracks: response.data.topTracks.map((track) => ({
          id: track.id,
          name: track.name,
          artist: track.artists[0]?.name || 'Unknown Artist',
        })),
      };

      console.log('Reduced Top Summary:', reducedPayload);
      setTopSummary(reducedPayload);
      generateSummary(reducedPayload);
    } catch (error) {
      console.error('Error fetching top summary:', error.message);
    }
  };

  // Generate a Music Taste Summary Using ChatGPT API
  const generateSummary = async (summaryData) => {
    try {
      const response = await axios.post('http://localhost:5001/generate-summary', summaryData);
      console.log('Generated Summary:', response.data.summary);
      setGeneratedSummary(response.data.summary);
    } catch (error) {
      console.error('Error generating summary:', error.message);
    }
  };

  // Generate Video Using DeepInfra API
  const generateAndDownloadVideo = async () => {
    try {
      console.log('Generated summary (prompt):', generatedSummary);

      if (!generatedSummary) {
        console.error('No generated summary available.');
        alert('Please wait for the music summary to be generated first.');
        return;
      }

      setIsGeneratingVideo(true);

      // Use "prompt" instead of "soraPrompt" to match backend expectations
      const payload = { prompt: generatedSummary };
      console.log('Sending payload:', payload);

      const response = await axios.post('http://localhost:5001/generate-video', payload);

      const videoUrl = response.data.videoUrl;
      console.log('Generated Video URL:', videoUrl);

      // Trigger download
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = 'music_summary_video.mp4';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating video:', error.response?.data || error.message);
      alert('Failed to generate video. Please check the backend logs for more details.');
    } finally {
      setIsGeneratingVideo(false);
    }
  };
  // Call the extracted function inside useEffect
  useEffect(() => {
    extractAccessToken();
  }, []);

  return (
    <div>
      <h1>Spotify Music Taste Summary</h1>
      {!accessToken ? (
        <a href="http://localhost:5001/login">
          <button>Login with Spotify</button>
        </a>
      ) : (
        <>
          {topSummary ? (
            <div>
              <h2>Your Top Music Summary</h2>
              <h3>Top Artists:</h3>
              <ul>
                {topSummary.topArtists.map((artist) => (
                  <li key={artist.id}>{artist.name}</li>
                ))}
              </ul>

              <h3>Top Tracks:</h3>
              <ul>
                {topSummary.topTracks.map((track) => (
                  <li key={track.id}>{track.name} - {track.artist}</li>
                ))}
              </ul>

              <h2>Generated Summary</h2>
              <p>{generatedSummary || 'Generating your music summary...'}</p>

              <button onClick={generateAndDownloadVideo} disabled={isGeneratingVideo}>
                {isGeneratingVideo ? 'Generating Video...' : 'Download Video'}
              </button>
            </div>
          ) : (
            <p>Fetching your top music data...</p>
          )}
        </>
      )}
    </div>
  );
}

export default App;
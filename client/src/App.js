import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [accessToken, setAccessToken] = useState('');
  const [topSummary, setTopSummary] = useState(null);
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [imageDescription, setImageDescription] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const API_BASE_URL = process.env.REACT_APP_API_URL;

  // Extract access token from URL
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('access_token');
    if (token) {
      setAccessToken(token);
      fetchTopSummary(token);
    }
  }, []);

  // Fetch Top Summary
  const fetchTopSummary = async (token) => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/top-summary`, {
        params: { access_token: token },
      });

      const reducedPayload = {
        topArtists: data.topArtists.map((artist) => ({
          id: artist.id,
          name: artist.name,
          genres: artist.genres,
        })),
        topTracks: data.topTracks.map((track) => ({
          id: track.id,
          name: track.name,
          artist: track.artists[0]?.name || 'Unknown Artist',
        })),
      };

      setTopSummary(reducedPayload);
      generateSummary(reducedPayload);
    } catch (error) {
      console.error('Error fetching top summary:', error.message);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    setUploadedImage(file);

    // Generate preview URL for the image
    setPreviewUrl(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/describe-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('Image Description:', response.data.description);
      setImageDescription(response.data.description);
    } catch (error) {
      console.error('Error describing image:', error.message);
      alert('Failed to describe the image. Try again.');
    }
  };

  // Generate a Music Taste Summary
  const generateSummary = async (summaryData) => {
    try {
      const { data } = await axios.post(`${API_BASE_URL}/generate-summary`, summaryData);
      setGeneratedSummary(data.summary);
    } catch (error) {
      console.error('Error generating summary:', error.message);
    }
  };

  const generateAndDownloadVideo = async () => {
    setIsGeneratingVideo(true);
    console.log('Starting video generation...');

    try {
        const { data: jobData } = await axios.post(`${API_BASE_URL}/generate-video`, { imagePrompt: imageDescription });
        console.log(`Job ${jobData.jobId} enqueued`);

        while (true) {
            const { data: status } = await axios.get(`${API_BASE_URL}/job-status/${jobData.jobId}`);
            
            if (status.state === 'completed' && status.result) {
                console.log('Video generation completed. Downloading video...');
                
                const link = document.createElement('a');
                link.href = `${API_BASE_URL}${status.result.url}`;
                link.download = status.result.fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                break;
            }

            if (status.state === 'failed') {
                throw new Error('Video generation failed');
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    } catch (error) {
        console.error('Error during video generation:', error.message);
        alert('Failed to generate video. Please try again.');
    } finally {
        setIsGeneratingVideo(false);
    }
};4

  // Add these utility functions
  const clearQueue = async () => {
    try {
        await axios.post(`${API_BASE_URL}/api/clear-queue`);
        console.log('Queue cleared successfully');
    } catch (error) {
        console.error('Failed to clear queue:', error);
        alert('Failed to clear queue: ' + error.message);
    }
  };

  const checkQueueStatus = async () => {
    try {
        const { data } = await axios.get(`${API_BASE_URL}/api/queue-status`);
        console.log('Queue status:', data);
        return data;
    } catch (error) {
        console.error('Failed to get queue status:', error);
        return null;
    }
  };

  // You can call these functions from the console:
  // await clearQueue()
  // await checkQueueStatus()

  return (
    <div className="app-container">
      <h1>Spotify Music Taste Summary</h1>

      {/* Login Button */}
      {!accessToken ? (
        <a href={`${process.env.REACT_APP_API_URL}/login`}>
          <button className="login-button">Login with Spotify</button>
        </a>
      ) : topSummary ? (
        <div>
          {/* Music Summary */}
          <section className="music-summary-section">
            <h2>Your Top Music Summary</h2>
            <p className="generated-summary">
              {generatedSummary || 'Generating your music summary...'}
            </p>
          </section>

          {/* Upload Image Section */}
          <section className="upload-section">
            <h3>Enhance Your Video</h3>
            <p>Upload a picture of yourself to provide additional context and make your video more personalized.</p>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              aria-label="Upload an image to personalize your video"
            />
            {uploadedImage && previewUrl && (
              <div className="uploaded-image-preview">
                <img src={previewUrl} alt="Uploaded" />
              </div>
            )}
          </section>

          {/* Download Video Button - Moved here */}
          <div className="action-button">
            <button
              onClick={generateAndDownloadVideo}
              disabled={isGeneratingVideo}
              aria-label="Generate and download a personalized video based on your music taste"
            >
              {isGeneratingVideo ? 'Generating Video...' : 'Generate and Download Video'}
            </button>
          </div>

          {/* Two Column Layout */}
          <section className="columns">
            <div className="column">
              <h3>Top Artists</h3>
              <ul>
                {topSummary.topArtists.map((artist) => (
                  <li key={artist.id}>{artist.name}</li>
                ))}
              </ul>
            </div>

            <div className="column">
              <h3>Top Tracks</h3>
              <ul>
                {topSummary.topTracks.map((track) => (
                  <li key={track.id}>
                    {track.name} - {track.artist}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      ) : (
        <p>Fetching your top music data...</p>
      )}
    </div>
  );
}

export default App;
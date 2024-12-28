import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [topSummary, setTopSummary] = useState(null);
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [imageDescription, setImageDescription] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const API_BASE_URL = process.env.REACT_APP_API_URL;
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');


  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
          const accessToken = localStorage.getItem('spotifyAccessToken'); // Ensure you save the token on login
          const response = await axios.get('/user-info', {
              headers: {
                  Authorization: `Bearer ${accessToken}`,
              },
          });
          setUser(response.data);
          fetchTopSummary();
      } catch (error) {
          console.error('Error fetching user info:', error.message);
      }
  };

    fetchUserInfo();
}, []);

const fetchTopSummary = async () => {
  try {
      const { data } = await axios.get(`${API_BASE_URL}/top-summary`);

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
    if (!generatedSummary || !imageDescription) {
        alert('Please ensure both the music summary and image description are generated.');
        return;
    }

    setIsGeneratingVideo(true);
    console.log('Starting video generation with music summary and image description.');

    try {
        // Get the optimized prompt
        const { data: promptData } = await axios.post(`${API_BASE_URL}/generate-video-prompt`, {
            musicSummary: generatedSummary,
            imageDescription
        });

        const { optimizedPrompt } = promptData;

        // Request video generation and get the job ID
        const { data: jobData } = await axios.post(`${API_BASE_URL}/generate-video`, {
            prompt: optimizedPrompt,
        });

        const jobId = jobData.jobId;
        console.log(`Job ${jobId} submitted. Polling for status...`);

        // Poll for job completion
        const pollJobStatus = async () => {
            try {
                const { data } = await axios.get(`${API_BASE_URL}/job-status/${jobId}`);

                if (data.state === 'completed') {
                    console.log('Video generation completed. Video URL:', data.videoUrl);

                    // Set the video preview URL for display
                    setVideoPreviewUrl(data.videoUrl);

                    // Optionally, download the video in the background
                    const link = document.createElement('a');
                    link.href = data.videoUrl;
                    link.download = `video_${jobId}.mp4`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    setIsGeneratingVideo(false);
                } else if (data.state === 'failed') {
                    alert('Video generation failed: ' + data.error);
                    setIsGeneratingVideo(false);
                } else {
                    console.log('Job still processing...');
                    setTimeout(pollJobStatus, 15000); // Poll every 15 seconds
                }
            } catch (error) {
                console.error('Error polling job status:', error.message);
                setIsGeneratingVideo(false);
            }
        };

        pollJobStatus();
    } catch (error) {
        console.error('Video generation failed:', error);
        alert('Failed to generate video: ' + error.message);
        setIsGeneratingVideo(false);
    }
};


  return (
    <div className="app-container">
      <h1>Spotify Music Taste Summary</h1>

      {/* Login Button */}
      {!user ? (
        <a href={`${process.env.REACT_APP_API_URL}/login`}>
          <button className="login-button">Login with Spotify</button>
        </a>
      ) : topSummary ? (
        <div>
          {/* Music Summary */}
          <section className="music-summary-section">
          <h2>{user.name}'s Top Music Summary</h2>
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

            {videoPreviewUrl && (
                <div>
                    <h2>Video Preview</h2>
                    <video controls width="600">
                        <source src={videoPreviewUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                    </video>
                </div>
            )}
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
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

axios.defaults.withCredentials = true;

function App() {
  console.log('Rendering App component');

  const [user,setUser] = useState(null);
  const [topSummary, setTopSummary] = useState(null);
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [imageDescription, setImageDescription] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';


  useEffect(() => {
    console.log('useEffect triggered');

    const fetchUserInfo = async () => {
      try {
          const response = await axios.get(`${API_BASE_URL}/user-info`);
          setUser(response.data);
          console.log('User data fetched successfully:', response.data);
      } catch (error) {
          console.error('Error fetching user info:', error.message);
      }
  };

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
    const handleSpotifyCallback = () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
  
      if (code) {
          // Clean up the URL
          window.history.replaceState({}, document.title, '/');
      }
  };

    handleSpotifyCallback();
    fetchUserInfo();
    fetchTopSummary();
}, []);


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
        // Step 1: Generate optimized prompt
        const { data: promptData } = await axios.post(`${API_BASE_URL}/generate-video-prompt`, {
            musicSummary: generatedSummary,
            imageDescription
        });

        const { optimizedPrompt } = promptData;
        console.log('Optimized prompt generated:', optimizedPrompt);

        // Step 2: Submit video generation job
        const { data: jobData } = await axios.post(`${API_BASE_URL}/api/generate-video`, {
            prompt: optimizedPrompt,
            email: user.email, // Assuming `user.email` is available from Spotify user info
        });

        const jobId = jobData.jobId;
        console.log(`Job ${jobId} submitted. Polling for status...`);

        // Step 3: Poll for job completion
        const pollJobStatus = async () => {
            try {
                const { data } = await axios.get(`${API_BASE_URL}/job-status/${jobId}`);

                if (data.state === 'completed') {
                    console.log('Video generation completed. Video URL:', data.videoUrl);

                    // Update video preview URL for display
                    setVideoPreviewUrl(data.videoUrl);

                    // Inform the user the video is ready and emailed
                    alert('Your video is ready and has been sent to your email!');

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
          <h2>{user.display_name}'s Musical Vibe</h2>
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
              {isGeneratingVideo ? 'Generating Video...' : 'Generate the video: Check your email!'}
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
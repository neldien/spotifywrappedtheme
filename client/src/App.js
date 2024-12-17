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
      const { data } = await axios.get('http://localhost:5001/top-summary', {
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
    setUploadedImage(file); // Show the uploaded image only

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await axios.post('http://localhost:5001/describe-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('Image Description:', response.data.description);
      // Store description in a variable for use in the prompt but don't show it
      setImageDescription(response.data.description); // Use internally
    } catch (error) {
      console.error('Error describing image:', error.message);
      alert('Failed to describe the image. Try again.');
    }
  };

  // Generate a Music Taste Summary
  const generateSummary = async (summaryData) => {
    try {
      const { data } = await axios.post('http://localhost:5001/generate-summary', summaryData);
      setGeneratedSummary(data.summary);
    } catch (error) {
      console.error('Error generating summary:', error.message);
    }
  };

  // Generate and Download Video
  const generateAndDownloadVideo = async () => {
    if (!generatedSummary) {
      alert('Please wait for the music summary to be generated first.');
      return;
    }

    // Check if no image is uploaded and inform the user
    if (!uploadedImage) {
      const proceedWithoutImage = window.confirm(
        'You have not uploaded an image. Uploading one can increase context and personalize the video. Do you want to proceed without an image?'
      );
      if (!proceedWithoutImage) {
        alert('Please upload an image to enhance the video.');
        return;
      }
    }

    setIsGeneratingVideo(true);

    try {
      const requestBody = {
        musicSummary: generatedSummary,
        imageDescription: imageDescription || '', // Pass image description if available
      };

      // Step 1: Confirmation after starting generation
      alert('Generating video... This may take up to 5 minutes. Please wait.');

      console.log('Generating video prompt...');
      const videoPromptResponse = await axios.post(
        'http://localhost:5001/generate-video-prompt',
        requestBody
      );

      const optimizedPrompt = videoPromptResponse.data.optimizedPrompt;
      console.log('Generated Video Prompt:', optimizedPrompt);

      // Step 2: Generate the video
      const videoResponse = await axios.post(
        'http://localhost:5001/generate-video',
        { prompt: optimizedPrompt }
      );

      const videoUrl = videoResponse.data.videoUrl;
      console.log('Generated Video URL:', videoUrl);

      // Step 3: Trigger download
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = 'music_summary_video.mp4';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Final confirmation after download
      alert('Your video has been generated and downloaded successfully!');
    } catch (error) {
      console.error('Error generating video:', error.response?.data || error.message);
      alert('Failed to generate video. Please try again.');
    } finally {
      setIsGeneratingVideo(false);
    }
  };


  return (
    <div className="app-container">
      <h1>Spotify Music Taste Summary</h1>

      {/* Login Button */}
      {!accessToken ? (
        <a href="http://localhost:5001/login">
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
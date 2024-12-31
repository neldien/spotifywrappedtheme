require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.porkbun.com', // Porkbun's SMTP hostname
    port: 587,               // STARTTLS port
    secure: false,           // Must be `false` for STARTTLS
    auth: {
        user: process.env.EMAIL_USER, // Your Porkbun email address
        pass: process.env.EMAIL_PASS, // Your Porkbun email password
    },
});
// Test Email Function
async function sendTestEmail() {
    try {
        const testVideoUrl = 'https://example.com/test-video.mp4'; // Example video URL
        const recipientEmail = 'eldifrawyn@gmail.com'; // Replace with a test recipient email

        const mailOptions = {
            from: '"Your Wrapped Theme" <hello@wrappedthemegpt.com>', // Sender email
            to: recipientEmail, // Recipient email
            subject: 'Your Test Wrapped Vibe Video is Ready!',
            text: `Your test video is ready! Click the link below to download:\n\n${testVideoUrl}`,
            html: `<p>Your test video is ready! Click the link below to download:</p><a href="${testVideoUrl}">${testVideoUrl}</a>`,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.response);
    } catch (error) {
        console.error('Error sending test email:', error.message || error);
    }
}

// Run the test
sendTestEmail();
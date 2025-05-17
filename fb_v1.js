const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require('fluent-ffmpeg');

// Set ffmpeg binary path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const PORT = 3000;

// Facebook Page details
const PAGE_ID = '618392368205661';
const PAGE_ACCESS_TOKEN = 'EAANZBr2GgLE4BO6XPR4P3bGnfpXcu1HS0xJBDtGkZBuRljfUtKbkebp9qMVCLZA2LiOgurf1FaUmOVd6ZCnOByysaUGIX6J5luJpqx5h0TVxDaN7qI15CiUCd81axqrsUETG8WZAhenUVvaCNuVICVekrpl1pGenUL5TzYQp8z9Yx1LeJwGZCmifHGgOggdJCI2ygGZAhCECXZBydwWkf05xLlqnwDqZA8wsPnZCI7'; // Replace with your real access token

// Middleware to handle file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware to parse form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/upload-video', upload.fields([
  { name: 'video' },
  { name: 'image' }
]), async (req, res) => {
  console.log('req.files:', req.files);
  console.log('req.body:', req.body);

  // Defensive checks
  if (
    !req.files ||
    !req.files.video ||
    !req.files.image ||
    req.files.video.length === 0 ||
    req.files.image.length === 0
  ) {
    return res.status(400).json({ error: 'Missing video or image file' });
  }

  const videoPath = req.files.video[0].path;
  const imagePath = req.files.image[0].path;
  const caption = req.body.caption || 'Download movie on https://movies.technologymanias.com';
  const title = req.body.title || 'Latest Movie';
  const processedVideoPath = `uploads/processed-${Date.now()}.mp4`;

  try {
    // FFmpeg processing
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(imagePath)
        .complexFilter([
          '[0:v][1:v]overlay=enable=\'lte(t,5)\':x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2[overlaid]',
          {
            filter: 'drawtext',
            options: {
              fontfile: 'DejaVuSans-Bold.ttf',
              text: title,
              fontsize: 40,
              fontcolor: 'white',
              x: '(main_w-text_w)/2',
              y: 'h/6',
              enable: 'lte(t,5)',
              box: 1,
              boxcolor: 'black@0.5',
              boxborderw: 5
            },
            inputs: 'overlaid',
            outputs: 'final'
          }
        ])
        .outputOptions([
          '-map [final]',
          '-map 0:a?',
          '-c:v libx264',
          '-c:a copy'
        ])
        .output(processedVideoPath)
        .on('end', () => {
          console.log('✅ Video processed -', processedVideoPath);
          resolve();
        })
        .on('error', (err, stdout, stderr) => {
          console.error('❌ FFmpeg Error:', err);
          console.error('FFmpeg stderr:', stderr);
          reject(err);
        })
        .run();
    });

    // Upload to Facebook
    const fbRes = await uploadToFacebook(processedVideoPath, PAGE_ACCESS_TOKEN, title);

    console.log('✅ Facebook Video ID:', fbRes.id);

    // Clean up temporary files
    fs.unlinkSync(videoPath);
    fs.unlinkSync(imagePath);
    fs.unlinkSync(processedVideoPath);

    res.status(200).json({ message: 'Video posted to Facebook', facebookVideoId: fbRes.id });
 } catch (error) {
  if (error.response) {
    console.error('❌ Facebook API Error:', JSON.stringify(error.response.data, null, 2));
  } else {
    console.error('❌ Error:', error.message);
  }
  throw error;
}
});

async function uploadToFacebook(videoPath, accessToken,title) {
  console.log("🚀 Starting Reel upload...");

  const fileSize = fs.statSync(videoPath).size;

  // Step 1: Initialize Upload Session
  const initRes = await axios.post(
    `https://graph.facebook.com/v22.0/${PAGE_ID}/video_reels`,
    {
      upload_phase: "start",
      access_token: accessToken
    }
  );

  const { upload_url, video_id } = initRes.data;
  console.log("📌 Upload session initialized:", video_id);

  // Step 2: Upload the Video File to upload_url
  const videoBuffer = fs.readFileSync(videoPath);
  const uploadRes = await axios.post(upload_url, videoBuffer, {
    headers: {
      Authorization: `OAuth ${accessToken}`,
      offset: 0,
      'file_size': fileSize,
      'Content-Type': 'application/octet-stream'
    }
  });

  if (!uploadRes.data.success) {
    throw new Error("❌ Upload failed");
  }
  console.log("📤 Video file uploaded successfully");

  let desc = "Download this movie -> "+title+" -> only on https://movies.technologymanias.com";
  // Step 3: Finish and Publish the Reel
  const finishRes = await axios.post(
    `https://graph.facebook.com/v22.0/${PAGE_ID}/video_reels`,
    null,
    {
      params: {
        access_token: accessToken,
        video_id,
        upload_phase: 'finish',
        video_state: 'PUBLISHED',
        description: desc
      }
    }
  );

  console.log(`🎬 Reel published successfully: https://www.facebook.com/reel/${video_id}`);
  return { id: video_id };
}


app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));

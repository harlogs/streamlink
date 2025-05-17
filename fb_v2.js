
/*
async function uploadToInstagram(videoBuffer, accessToken, caption) {
  console.log("🚀 Starting Instagram Reel upload...");

  // Step 1: Create IG media container
  const containerRes = await axios.post(
    `https://graph.facebook.com/v19.0/${IG_USER_ID}/media`,
    {
      media_type: "REELS",
      upload_type: "resumable"
    },
    {
      params: {
        accessToken
      }
    }
  );

  const igContainerId = containerRes.data.id;
  const uploadUrl = containerRes.data.video_upload_urls[0];
  const fileSize = videoBuffer.length;

  console.log("📦 Container created:", igContainerId);

  // Step 2: Upload video to rupload.facebook.com
  await axios.post(uploadUrl, videoBuffer, {
    headers: {
      Authorization: `OAuth ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'offset': 0,
      'file_size': fileSize
    },
    httpsAgent: agent
  });

  console.log("📤 Video uploaded to Instagram");

  // Step 3: Optional - Wait for Instagram to finish processing (or poll status)

  // Step 4: Publish
  const publishRes = await axios.post(
    `https://graph.facebook.com/v19.0/${IG_USER_ID}/media_publish`,
    {
      creation_id: igContainerId
    },
    {
      params: {
        accessToken
      }
    }
  );

  console.log(`🎬 Reel published to Instagram: https://www.instagram.com/reel/${publishRes.data.id}`);
  return { id: publishRes.data.id };
}
*/

/*
async function uploadInstagramReel({ videoUrl, accessToken, caption }) {
  console.log("🚀 Uploading Instagram Reel via video URL...");

  // Step 1: Create media container
  const containerRes = await axios.post(
    `https://graph.facebook.com/v22.0/17841415173261954/media`,
    null,
    {
      params: {
        media_type: "REELS",
        video_url: videoUrl,
        caption: caption,
        access_token: accessToken
      }
    }
  );

  const creationId = containerRes.data.id;
  console.log("📦 Media container created:", creationId);

  // Step 2: Poll status (optional, but recommended)
  let status = "IN_PROGRESS";
  while (status === "IN_PROGRESS") {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await axios.get(
      `https://graph.facebook.com/v22.0/${creationId}`,
      {
        params: {
          fields: "status_code",
          access_token: accessToken
        }
      }
    );
    status = statusRes.data.status_code;
    console.log("⏳ Media status:", status);
  }

  if (status !== "FINISHED") {
    throw new Error(`Media upload failed with status: ${status}`);
  }

  // Step 3: Publish
  const publishRes = await axios.post(
    `https://graph.facebook.com/v22.0/${IG_USER_ID}/media_publish`,
    null,
    {
      params: {
        creation_id: creationId,
        access_token: accessToken
      }
    }
  );

  const reelId = publishRes.data.id;
  console.log(`✅ Reel published! https://www.instagram.com/reel/${reelId}`);
  return reelId;
}
  */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');
const https = require('https');
const tmp = require('tmp');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const FB_PAGE_ID = process.env.FB_PAGE_ID;
const USER_ACCESS_TOKEN = process.env.USER_TOKEN;

const agent = new https.Agent({
  rejectUnauthorized: true,
  secureProtocol: 'TLSv1_2_method'
});

/**
 * Helper to get Facebook Page Access Token dynamically
 */
async function getPageAccessToken() {
  console.log('pageId:', FB_PAGE_ID); // should not be undefined
  console.log('userAccessToken:', USER_ACCESS_TOKEN); // should be a valid string
  try{
    const response = await axios.get(`https://graph.facebook.com/v22.0/${FB_PAGE_ID}`, {
      params: {
        fields: 'access_token',
        access_token: USER_ACCESS_TOKEN,
      },
      httpsAgent: agent
    });
    return response.data.access_token;
  }
  catch (error){
  console.error("Failed to fetch page access token:", error?.response?.data || error.message);
  res.status(500).json({ error: "Failed to fetch page access token" }); 
  }
}

/**
 * Process video and image with FFmpeg to produce a buffer of output video
 */
function processVideoToBuffer(videoPath, imagePath, title) {
  return new Promise((resolve, reject) => {
    const bufferStream = new PassThrough();
    const chunks = [];

    ffmpeg()
      .input(videoPath)
      .input(imagePath)
      .complexFilter([
        '[1:v]scale=540:960[resized_image]',
        '[0:v][resized_image]overlay=enable=\'lte(t,5)\':x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2[overlaid]',
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
        '-c:a copy',
        '-movflags +frag_keyframe+empty_moov'
      ])
      .format('mp4')
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject)
      .pipe(bufferStream, { end: true });

    bufferStream.on('data', chunk => chunks.push(chunk));
    bufferStream.on('error', reject);
  });
}

/**
 * Upload processed video buffer to Facebook as a Reel
 */
async function uploadToFacebook(videoBuffer, accessToken, title) {
  const fileSize = videoBuffer.length;

  // 1. Initialize upload session
  const initRes = await axios.post(
    `https://graph.facebook.com/v22.0/${FB_PAGE_ID}/video_reels`,
    { upload_phase: "start", access_token: accessToken }
  );
  const { upload_url, video_id } = initRes.data;

  // 2. Upload video chunk
  const uploadRes = await axios.post(upload_url, videoBuffer, {
    headers: {
      Authorization: `OAuth ${accessToken}`,
      offset: 0,
      file_size: fileSize,
      'Content-Type': 'application/octet-stream'
    },
    httpsAgent: agent
  });
  if (!uploadRes.data.success) throw new Error('Upload failed');

  // 3. Finish and publish
  const desc = `Download this movie -> ${title} -> only on https://movies.technologymanias.com`;
  await axios.post(
    `https://graph.facebook.com/v22.0/${FB_PAGE_ID}/video_reels`,
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

  return video_id;
}

/**
 * Main function to handle upload, processing, posting
 * @param {Object} files - files object, e.g. req.files from multer
 * @param {Object} body - body object, e.g. req.body
 * @returns {Object} - { message, facebookVideoId }
 */
async function handleUploadVideo(imageFile, videoFile, body) {
 if (!imageFile || !videoFile) {
    throw new Error('Missing video or image file');
  }

  const tmpVideo = tmp.fileSync({ postfix: '.mp4' });
  const tmpImage = tmp.fileSync({ postfix: '.jpg' });

  fs.writeFileSync(tmpVideo.name, videoFile.buffer);
  fs.writeFileSync(tmpImage.name, imageFile.buffer);

  

  // const videoPath = videoFile.path;
  // const imagePath = imageFile.path;
  const title = body.title || 'Default Title';

  try {
    // Process video and get buffer
    const videoBuffer = await processVideoToBuffer(tmpVideo.name, tmpImage.name, title);

    // Get Page Access Token dynamically
    const pageToken = await getPageAccessToken();

    // Upload to Facebook
    const facebookVideoId = await uploadToFacebook(videoBuffer, pageToken, title);

    // Clean up temp files
    tmpVideo.removeCallback();
    tmpImage.removeCallback();


    return {
      message: 'Video posted to Facebook',
      facebookVideoId,
    };
  } catch (err) {
    // Clean up temp files in case of error too
    tmpVideo.removeCallback();
    tmpImage.removeCallback();

    throw err;
  }
}

module.exports = { handleUploadVideo };

const express = require('express');
const multer = require('multer');
const puppeteer = require('puppeteer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cors = require('cors');
const { Buffer } = require('buffer');
const axios = require('axios');
const { getAutocompleteSuggestions } = require('./autocomplete.js');
const { get_desc } = require('./desc.js');
const { title } = require('process');
// const { handleUploadVideo } = require('./fb_v2.js');
require('dotenv').config();
import { spawn } from 'child_process';

const app = express();

// --- START THE PYTHON SERVER ---
const python = spawn('python', ['pinterest.py']);
python.stdout.on('data', data => console.log(`🐍 ${data}`));
python.stderr.on('data', data => console.error(`🐍 Error: ${data}`));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.')); // serve static files like player.html if needed


const port = process.env.PORT || 3000;

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const owner = 'harlogs';  
const repo = 'moviesmain';
const token = process.env.GH_TOKEN;
console.log(token);
const branch = 'main';  
const imageFolder = 'static/images';      
const contentFolder = 'content'; 

app.get('/player', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing video URL' });

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-profile-'))
    });

    const page = await browser.newPage();

    // 🔒 Block Popper.js, ad scripts, and popup-related URLs
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (
        url.includes('popper') ||
        url.includes('ads') ||
        url.includes('doubleclick') ||
        url.includes('googlesyndication') ||
        (url.endsWith('.js') && url.includes('popup'))
      ) {
        console.log(`❌ Blocked: ${url}`);
        return request.abort();
      }
      request.continue();
    });

    // 🧼 Prevent popup windows
    await page.evaluateOnNewDocument(() => {
      window.open = () => null;
    });

    // 🚀 Load the Streamtape page
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.waitForFunction(() => {
      const result = document.evaluate('//*[@id="mainvideo"]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue?.src;
    });
    
    const videoUrl = await page.evaluate(() => {
      const xpath = '//*[@id="mainvideo"]';
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const video = result.singleNodeValue;
      return video ? video.src : null;
    });
    
    await browser.close();

    if (!videoUrl) {
      return res.status(404).json({ error: 'Video URL not found on the page.' });
    }

    // ✅ Return the final video URL
    res.json({ videoUrl });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/*
// Function to update the video cache JSON on GitHub
async function updateVideoCacheById(id, newUrl, newExpiry) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=gh-pages`;

  // Fetch the current file to retrieve content and SHA
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });

  if (!res.ok) throw new Error(`❌ Failed to fetch current file: ${await res.text()}`);
  const fileData = await res.json();
  const contentJson = Buffer.from(fileData.content, 'base64').toString();
  let cacheArray = JSON.parse(contentJson);

  // Find the movie by id and update or push if not exists
  const index = cacheArray.findIndex(item => item.id === id);
  if (index !== -1) {
    cacheArray[index].url = newUrl;
    cacheArray[index].expires = newExpiry;
  } else {
    cacheArray.push({ id, url: newUrl, expires: newExpiry });
  }

  // Encode and push the new file
  const updatedContent = Buffer.from(JSON.stringify(cacheArray, null, 2)).toString('base64');

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Update video URL for movie ID ${id}`,
      content: updatedContent,
      sha: fileData.sha,
      branch: 'gh-pages'
    })
  });

  if (!putRes.ok) throw new Error(`❌ Failed to update file: ${await putRes.text()}`);

  return `✅ Updated video-cache.json for movie ID ${id}`;
}

// POST endpoint to update video URL in GitHub repository
app.post('/update-video', async (req, res) => {
  const { id, newUrl, newExpiry } = req.body;

  if (!id || !newUrl || !newExpiry) {
    return res.status(390).json({ error: 'Missing required fields (id, newUrl, newExpiry)' });
  }

  try {
    const message = await updateVideoCacheById(id, newUrl, newExpiry);
    res.status(200).json({ message });
  } catch (error) {
    console.error('🔥 Update Video Error:', error);
    res.status(500).json({ error: error.message });
  }
});
*/

// Upload to GitHub
async function uploadFileToGitHub(filePath, contentBuffer, commitMessage) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  let sha = undefined;

  // First GET the file to see if it exists
  const getRes = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json'
    }
  });

  if (getRes.ok) {
    const fileData = await getRes.json();
    sha = fileData.sha;  // get the sha if the file exists
  } else if (getRes.status !== 404) {
    // If it's not 404 (not found), throw an error
    throw new Error(`GitHub Fetch Failed: ${await getRes.text()}`);
  }

  // Prepare the new content
  const updatedContent = contentBuffer.toString('base64');

  // Now PUT the new file content
  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      message: commitMessage,
      content: updatedContent,
      branch: branch,
      ...(sha ? { sha } : {})  // only add `sha` if we have it
    })
  });

  if (!putRes.ok) {
    throw new Error(`GitHub Upload Failed: ${await putRes.text()}`);
  }

  const data = await putRes.json();
  return data.content.download_url;
}

function generateMarkdown({ id, title, imageUrl, date, language, year, category, series, season, episode, tags, videoUrl, desc, other, alt }) {
  return `---
id: ${id}
title: "${title}"
image: "${imageUrl}"
date: ${date}
language: "${language}"
year: ${year}
series: "${series}"
season: "${season}"
episode: ${episode}
categories: ["${category}"]
tags: ${tags}
alt: "${alt}"
---

${desc}

<br>

<iframe src="${videoUrl}"
  class="w-full h-[300px] sm:h-[400px] md:h-[500px] rounded shadow" 
  frameborder="0" 
  allowfullscreen></iframe>

<br>

<p class="w-full bg-gray-800 text-gray-300 text-left p-4 mt-4">
  Tags: ${other}
</p>
`;
}

// POST endpoint
app.post('/submit', upload.fields([{ name: 'image' }, { name: 'video' }]), async (req, res) => {
  //console.log("Called");
  //console.log(req.body);
  const imageFile = req.files['image']?.[0];
  const videoFile = req.files['video']?.[0];
  try {
    const { id, title, language, year, categories, link, pass, series, season, episode } = req.body;
    //const file = req.file;

    if (!id || !title || !language || !year || !categories || !link || !pass || !imageFile) {
      const missingFields = [];
      if (!id) missingFields.push('id');
      if (!title) missingFields.push('title');
      if (!language) missingFields.push('language');
      if (!year) missingFields.push('year');
      if (!categories) missingFields.push('categories');
      if (!link) missingFields.push('link');
      if (!pass) missingFields.push('pass');
      if (!file) missingFields.push('file');
    
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const imageExt = path.extname(imageFile.originalname);
    const imageName = `${safeTitle}-${Date.now()}${imageExt}`;
    const imagePath = `${imageFolder}/${imageName}`;
    const datee = new Date().toISOString();
    let tags = [];
    try {
      const response = await axios.get(`https://streamlink-qye0.onrender.com/api/suggest?q=${encodeURIComponent(safeTitle)}`);
      tags = response.data.suggestions;
    } catch (error) {
      console.error('Error calling internal suggest API:', error.message);
      return [];
    }
    
    const imageUrl = `images/${imageName}`;
    
    await uploadFileToGitHub(imagePath, imageFile.buffer, `Upload poster for ${title}`);

    const desc = await get_desc(title+" film");

    let tagList = [];

    if (Array.isArray(tags)) {
      tagList = tags;
    } else if (typeof tags === 'string') {
      tagList = tags.split(',').map(tag => tag.trim());
    }

    const lines = tagList.map(tag => `  - ${tag}`).join('\n');
    const output = `\n${lines}`;

    const alt = title.replace(/[^a-zA-Z0-9 ]/g, '');

    let slug = title.toLowerCase();

    slug = slug.replace(/[^a-zA-Z0-9 ]/g, '');

    slug = slug.trim().replace(/\s+/g, "-").replace(/-+/g, "-");

    // 4. Prepend your domain
    const url = `https://movies.technologymanias.com/${slug}/`;

    const alt_text = title + " Download for free full HD 720P 1080P Watch now";

    const markdownContent = generateMarkdown({
      id,
      title,
      imageUrl:imageUrl,
      date: datee,
      language,
      year,
      category: categories,
      series: series,
      season: season,
      episode: episode,
      tags:output,
      videoUrl: link,
      desc,
      other:tags,
      alt
    });

    //console.log(markdownContent);
    // res.status(200).json({ message: `✅ Successfully created post: ${title}` }); ok

    const mdFileName = `${safeTitle}.md`;
    const mdFilePath = `${contentFolder}/${mdFileName}`;

    if(pass=="2222")
    {
      await uploadFileToGitHub(mdFilePath, Buffer.from(markdownContent), `Create movie post: ${title}`);

      // const result = await handleUploadVideo(imageFile, videoFile, req.body);

      // Call Python to create Pinterest pin
     // Create a FormData instance
      const FormData = require('form-data'); 
      const form = new FormData();
      form.append('title', title);
      form.append('description', alt_text);
      form.append('alt_text', alt_text);
      form.append('link', url);

      // // Append the file directly from memory
      form.append('image_file', imageFile.buffer, {
        filename: imageFile.originalname,
        contentType: imageFile.mimetype
      });

      // Send POST request to Flask
      await axios.post('http://127.0.0.1:5001/pin', form, {
        // headers: form.getHeaders()
      });
      res.status(200).json({ message: `✅ Successfully created post: ${title} and triggered Pinterest pin` });

      console.log("UPLOADED !");
      // res.status(200).json({ message: `✅ Successfully created post: ${title}` });
    }
    else{
      res.status(420).json({ message: `Ganja peeke aye ho kya ?` });
    }
  } catch (err) {
    console.error('🔥 Error submitting movie:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/suggest', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing ?q=your+search+query' });
  }

  try {
    const suggestions = await getAutocompleteSuggestions(query);
    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating suggestions:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});

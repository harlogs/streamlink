const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cors = require('cors');
const fetch = require('node-fetch');
const { Buffer } = require('buffer');
const owner = 'harlogs';  // Change this to your GitHub username
const repo = 'gridmov'; // Change this to your GitHub repository
const filePath = 'data/video-cache.json'; // Path to the video-cache.json file
const token = process.env.GH_TOKEN;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // serve static files like player.html if needed

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

// Start the Express server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});

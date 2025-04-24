
import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs';
import os from 'os';
import path from 'path';

const app = express();
app.use(express.static('.')); // serve static files like player.html if needed

app.get('/player', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing video URL' });

  // 🔹 Fast path for direct .mp4 links
  if (targetUrl.endsWith('.mp4')) {
    return res.json({ videoUrl: targetUrl });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-profile-')),
      //executablePath: './.cache/puppeteer/chrome/linux-135.0.7049.95/chrome-linux64/chrome'
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
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // 🕵️‍♂️ Extract the video URL
    await page.waitForSelector('video');
    const videoUrl = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video?.src;
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

app.listen(3000, () => {
  console.log('🚀 Server running at http://localhost:3000');
});

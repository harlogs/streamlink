import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
app.use(express.static('.')); // serve player.html from root

app.get('/player', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing video URL');

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--disable-web-security', '--user-data-dir=./tmp'],
    });
    const page = await browser.newPage();
    await page.goto(targetUrl);

    // Wait for Streamtape to load and find video source URL
    await page.waitForSelector('video');
    await console.log('here');
    const videoUrl = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video?.src;
    });

    await browser.close();

    // Inject video URL into HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Player</title></head>
      <body style="margin:0;background:black">
        <video src="${videoUrl}" controls autoplay style="width:100%;height:100%;object-fit:contain;border:4px solid black;"></video>
      </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});

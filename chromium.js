import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    await page.goto('https://streamtape.com/v/KPrblX7al1s0XVQ/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForSelector('#mainvideo', { timeout: 15000 });

    const videoUrl = await page.$eval('#mainvideo', el => el.src);
    console.log('🎬 Video URL:', videoUrl);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await browser.close();
  }
})();

// rumble-proxy.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createServer } from 'http';
import ProxyChain from 'proxy-chain'; // <-- fixed

puppeteer.use(StealthPlugin());

// Your optional proxy (for residential IP)
const upstreamProxyUrl = 'socks5h://184.178.172.14:4145'; // <-- leave '' if you don't have

// Start local proxy server
const server = new ProxyChain.Server({
  port: 8000,
  prepareRequestFunction: ({ request }) => {
    // Only proxy video chunk/media requests
    if (request.url.includes('1a-1791.com')) {
      return {
        upstreamProxyUrl: upstreamProxyUrl || null,
      };
    }
    // Other requests go direct
    return {
      upstreamProxyUrl: null,
    };
  }
});

await server.listen();
console.log(`Proxy server running on 127.0.0.1:8000`);

(async () => {
  const browser = await puppeteer.launch({
    headless: false,  // show browser
    args: [
      '--proxy-server=http://127.0.0.1:8000', // use our smart proxy server
    ],
    defaultViewport: null,
  });

  const page = await browser.newPage();

  // Optional: set a very clean User-Agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');

  console.log('Opening Rumble iframe...');
  await page.goto('https://rumble.com/v6snqc3-grafted-2024.html', {
    waitUntil: 'networkidle2',
  });

  console.log('Iframe loaded. Watching network...');

  // Keep open
})();

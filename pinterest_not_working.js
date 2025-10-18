const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');

puppeteer.use(StealthPlugin());

async function clickButtonByText(page, texts = []) {
  for (const text of texts) {
    // Select all buttons and divs with role="button"
    const buttons = await page.$$('button, div[role="button"]');

    for (const btn of buttons) {
      const innerText = await page.evaluate(el => el.innerText || '', btn);
      if (innerText && texts.some(t => innerText.toLowerCase().includes(t.toLowerCase()))) {
        await btn.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        const box = await btn.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          console.log(`🖱️ Clicked button with text: "${innerText.trim()}"`);
          return true;
        }
      }
    }
  }
  console.log(`⚠️ No matching button found for: ${texts.join(', ')}`);
  return false;
}

(async () => {
  const PINT_EMAIL = 'stepnest02@gmail.com';
  const PINT_PASS = '22@Willas@22';
  const IMAGE_PATH = path.resolve('./image.jpg'); // local image
  const TITLE = 'My Awesome Pin';
  const DESCRIPTION = 'This is a cool pin created automatically with Puppeteer!';
  const DEST_URL = 'https://example.com';

  const browser = await puppeteer.launch({
    headless: false,  // set to true when stable
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  // 1️⃣ Go to Pinterest
  await page.goto('https://www.pinterest.com/login/', { waitUntil: 'networkidle2' });
  
  // Wait for email input
  await page.waitForSelector('input[name="id"]', { visible: true });
  await page.type('input[name="id"]', PINT_EMAIL, { delay: 80 });

  // Detect if password field is already present
  const passwordVisible = await page.$('input[name="password"]');

  if (passwordVisible) {
    // ✅ Single-page login
    console.log('📋 Single-step login detected');
    // await page.type('input[name="password"]', PINT_PASS, { delay: 80 });

    const passwordInput = await page.waitForSelector('input[name="password"]', { visible: true });
    await passwordInput.type(PINT_PASS, { delay: 80 });


    await passwordInput.focus();

    await new Promise(resolve => setTimeout(resolve, 5000));

    await page.keyboard.press('Enter');
    console.log('🔐 Pressed Enter to login');

    // await clickButtonByText(page, ["Log in", "Login"]);
  } else {
    // 🪜 Two-step login
    console.log('🪜 Two-step login detected');
    const buttons = await page.$$('button, div[role="button"]');

    for (const btn of buttons) {
    const text = await page.evaluate(el => el.innerText || '', btn);
    if (text && text.toLowerCase().includes('next')) {
        await btn.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        const box = await btn.boundingBox();
        if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        console.log('🖱️ Clicked Next button');
        break;
        }
    }
    }

    // Wait for password field
    await page.waitForSelector('input[name="password"]', { visible: true });
    await page.type('input[name="password"]', PASSWORD, { delay: 80 });

    await new Promise(resolve => setTimeout(resolve, 20000));

    const loginButton = await page.$x("//button//div[contains(text(),'Log in')]");
    if (loginButton.length) await loginButton[0].click();
    else await page.keyboard.press('Enter');
  }


  console.log('✅ Logged in successfully.');

  // 3️⃣ Go to Pin creation page
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="file"]', { visible: true });

  // 4️⃣ Upload image
  const fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(IMAGE_PATH);
  console.log('📸 Image uploaded.');

  // 5️⃣ Fill in title, description, and destination link
  await page.waitForSelector('textarea[aria-label="Add your title"]', { visible: true });
  await page.type('textarea[aria-label="Add your title"]', TITLE, { delay: 60 });
  
  await page.type('textarea[aria-label="Tell everyone what your Pin is about"]', DESCRIPTION, { delay: 60 });
  
  await page.type('input[aria-label="Add a destination link"]', DEST_URL, { delay: 60 });
  console.log('📝 Filled pin details.');

  // 6️⃣ Publish
  await page.waitForTimeout(1000);
  const publishButton = await page.$x("//div[contains(text(), 'Publish')]");
  if (publishButton.length > 0) {
    await publishButton[0].click();
    console.log('🚀 Publishing pin...');
  } else {
    console.error('❌ Publish button not found.');
  }

  await page.waitForTimeout(5000);
  console.log('✅ Pin posted successfully!');
  await browser.close();
})();

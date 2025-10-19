const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const process = require('process');

// ---------- CONFIG ----------
const PINTEREST_EMAIL = process.env.PINTEREST_EMAIL || "meetwill9222@gmail.com";
const PINTEREST_PASSWORD = process.env.PINTEREST_PASSWORD || "22@Willas@22";
const PIN_CREATOR_URL = "https://www.pinterest.com/pin-builder/";
const SESSION_FILE = "pinterest_session.json";

// ---------- SESSION HELPERS ----------
// function saveCookies(page) {
//     fs.writeFileSync(SESSION_FILE, JSON.stringify(await page.cookies(), null, 2));
//     console.log("💾 Session saved");
// }

// function loadCookies(page) {
//     if (!fs.existsSync(SESSION_FILE)) return false;
//     const cookies = JSON.parse(fs.readFileSync(SESSION_FILE));
//     await page.setCookie(...cookies);
//     console.log("♻️ Session loaded");
//     return true;
// }

// async function isLoggedIn(page) {
//     await page.goto("https://www.pinterest.com/", { waitUntil: "networkidle2" });
//     try {
//         await page.waitForSelector('div[data-test-id="header-profile-image"]', { timeout: 5000 });
//         return true;
//     } catch {
//         return false;
//     }
// }

// ---------- LOGIN ----------
async function smartLogin(page) {
    await page.goto("https://www.pinterest.com/login/", { waitUntil: "networkidle2" });
    await sleep(3000); 

    const idExists = await page.$('input[name="id"]');
    const passwordExists = await page.$('input[name="password"]');

    try {
        if (idExists && passwordExists) {
            console.log("🪄  One-step login");
            await page.type('input[name="id"]', PINTEREST_EMAIL, { delay: 100 });
            await page.type('input[name="password"]', PINTEREST_PASSWORD, { delay: 100 });
            await page.keyboard.press('Enter');
        } else if (idExists) {
            console.log("🪄  Two-step login");
            await page.type('input[name="id"]', PINTEREST_EMAIL, { delay: 100 });
            const [continueButton] = await page.$x("//button//div[text()='Continue']");
            if (continueButton) {
                await continueButton.click();
            } else {
                console.log("⚠️ Continue button not found");
            }
            await page.waitForSelector('input[name="password"]', { visible: true });
            await page.type('input[name="password"]', PINTEREST_PASSWORD, { delay: 100 });
            await page.keyboard.press('Enter');
        } else {
            throw new Error("Login form not found");
        }

        //await page.waitForSelector('div[data-test-id="header-profile-image"]', { timeout: 15000 });
        console.log("✅ Logged in successfully");

        // saveCookies(page)
        await sleep(5000); 
    } catch (e) {
        console.log(`🔥 Login failed: ${e}`);
        throw e;
    }
}

// ---------- CREATE PIN ----------
async function createPin(title, description, altText, link, imagePath = null) {
    const browser = await puppeteer.launch({ 
        headless: false, 
        args: [
            '--disable-notifications',     // disable notifications
            '--disable-popup-blocking',    // disable popup blocking
            '--no-sandbox',                // no sandbox (necessary for Linux/Railway/VPS)
            '--disable-dev-shm-usage'      // disable /dev/shm usage
        ] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    try {
        // const cookiesLoaded = await loadCookies(page);
        // if (cookiesLoaded && await isLoggedIn(page)) {
        //     console.log("✅ Logged in via cookies");
        // } else {
        //     console.log("🔑 Logging in manually...");
        //     await smartLogin(page);
        //     await saveCookies(page);
        // }

        await smartLogin(page);
        await safeGoToPinBuilder(page);

        if (imagePath && fs.existsSync(imagePath)) {
            const uploadInput = await page.waitForSelector('input[type="file"]', { visible: true });
            await uploadInput.uploadFile(imagePath);
            console.log("📸 Image uploaded");
            await sleep(3000); 

            // --- TITLE ---
            try {
                const titleSelector = 'textarea[id*="pin-draft-title"]';
                const titleInput = await page.waitForSelector(titleSelector, { visible: true });
                await titleInput.click({ clickCount: 3 });
                await titleInput.type(title, { delay: 50 });
                console.log("📝 Title entered");
            } catch (e) {
                console.log("⚠️ Title input not found:", e);
            }

            // --- DESCRIPTION ---
            try {
                const descSelector = 'div[aria-label="Tell everyone what your Pin is about"][contenteditable="true"]';
                const descContainer = await page.waitForSelector(descSelector, { visible: true });
                await descContainer.click();
                await descContainer.type(description, { delay: 50 });
                console.log("📝 Description entered");
            } catch (e) {
                console.log("⚠️ Description input not found:", e);
            }

            // --- DESTINATION LINK ---
            try {
                const linkSelector = 'textarea[id*="pin-draft-link"]';
                const linkInput = await page.waitForSelector(linkSelector, { visible: true });
                await linkInput.click({ clickCount: 3 });
                await linkInput.type(link, { delay: 50 });
                console.log("🔗 Destination link entered");
            } catch (e) {
                console.log("⚠️ Destination link input not found:", e);
            }

            // --- ALT TEXT ---
            try {
                const altButtonSelector = 'div[data-test-id="pin-draft-alt-text-button"] div';
                const altButton = await page.waitForSelector(altButtonSelector, { visible: true });
                await altButton.click();
                await page.keyboard.type(altText, { delay: 50 });
                console.log("✅ Alt text entered");
            } catch (e) {
                console.log("⚠️ Could not click 'Add alt text':", e);
            }

            // --- PUBLISH ---
            try {
                const publishBtnSelector = 'div[data-test-id="board-dropdown-save-button"]';
                const publishBtn = await page.waitForSelector(publishBtnSelector, { visible: true });
                await publishBtn.click();
                await sleep(10000); 
                console.log("✅ Pin published successfully");
            } catch (e) {
                console.log("⚠️ Could not click Publish button:", e);
            }
        } else {
            console.log("⚠️ Path not found !:", imagePath);
        }
    } catch (e) {
        console.log(`🔥 Error: ${e}`);
    } finally {
        // await page.waitForTimeout(5000);
        await browser.close();
    }
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeGoToPinBuilder(page) {
    try {
        await page.goto(PIN_CREATOR_URL, { waitUntil: "networkidle2" });
        console.log("➡️  Navigating to pin builder...");
        await sleep(5000); 
        console.log("📝 Pin builder opened successfully!");
    } catch {
        console.log("⚠️ Timeout waiting for Pin Builder — retrying once...");
        await page.goto("https://www.pinterest.com/", { waitUntil: "networkidle2" });
        await sleep(3000); 
        await page.goto(PIN_CREATOR_URL, { waitUntil: "networkidle2" });
        try {
            console.log("✅ Pin builder opened on retry");
        } catch {
            console.log("❌ Failed to open Pin Builder after retry");
        }
    }
    await sleep(5000); 
}

// // ---------- TEST ----------
// (async () => {
//     const args = process.argv.slice(2);
//     if (args.length < 4) {
//         console.log("❌ Missing arguments. Usage: node pinterest.js <title> <description> <alt_text> <link> [image_path]");
//         process.exit(1);
//     }

//     const [title, description, altText, link, imagePath] = args;
//     console.log(`🚀 Creating pin for: ${title}`);
//     await createPin(title, description, altText, link, imagePath);
// })();
// Only run when executed directly, not when imported
if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2);
        if (args.length < 4) {
            console.log("❌ Missing arguments. Usage: node pinterest.js <title> <description> <alt_text> <link> [image_path]");
            process.exit(1);
        }

        const [title, description, altText, link, imagePath] = args;
        console.log(`🚀 Creating pin for: ${title}`);
        await createPin(title, description, altText, link, imagePath);
    })();
}

// Export for external use
module.exports = { createPin };
import puppeteer from 'puppeteer-core';

const CHROME_HOST = '192.168.65.254';
const CHROME_PORT = 9222;
const APP_URL = 'http://localhost:5174';

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testModelSelector() {
  console.log('Connecting to Chrome via CDP...');

  try {
    // Connect to the already-running Chrome instance
    const browser = await puppeteer.connect({
      browserURL: `http://${CHROME_HOST}:${CHROME_PORT}`,
      defaultViewport: null,
    });

    console.log('Connected to Chrome successfully!');

    // Get all pages and find our app or create new page
    const pages = await browser.pages();
    let page;

    // Try to find existing page with our app
    page = pages.find(p => p.url().includes('localhost:5174'));

    if (!page) {
      console.log('Creating new page...');
      page = await browser.newPage();
      await page.goto(APP_URL, { waitUntil: 'networkidle2' });
    } else {
      console.log('Found existing page with app');
    }

    console.log('Current URL:', page.url());

    // Wait for the app to be ready - look for any button
    await page.waitForSelector('button', { timeout: 10000 });
    console.log('Page loaded with buttons!');

    // Take screenshot before clicking
    await page.screenshot({ path: '/WorldCharacters/screenshots/before-click.png' });
    console.log('Screenshot saved: before-click.png');

    // Click the Models button
    console.log('Clicking Models button...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const modelsButton = buttons.find(btn => btn.textContent.includes('Models'));
      if (modelsButton) {
        console.log('Found Models button, clicking...');
        modelsButton.click();
        return true;
      } else {
        throw new Error('Models button not found');
      }
    });

    // Wait a bit for React to update
    await wait(1000);
    console.log('Waited for React state update...');

    // Check what's in the DOM now
    const modalCheck = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const allDivs = document.querySelectorAll('div');
      return {
        hasDialog: !!dialog,
        totalDivs: allDivs.length,
        bodyClasses: document.body.className,
        hasFixedElements: Array.from(document.querySelectorAll('.fixed')).length,
      };
    });
    console.log('Modal check:', modalCheck);

    // Take screenshot after click
    await page.screenshot({ path: '/WorldCharacters/screenshots/after-click.png' });
    console.log('Screenshot saved: after-click.png');

    // Try to wait for modal with a longer timeout
    try {
      await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
      console.log('Modal appeared!');
    } catch (e) {
      console.log('Modal did not appear with [role="dialog"], trying alternate selector...');
      // Try to find it by looking for the modal content
      await page.waitForSelector('.fixed', { timeout: 3000 });
      console.log('Found modal by .fixed class!');
    }

    // Take screenshot of modal
    await page.screenshot({ path: '/WorldCharacters/screenshots/modal-open.png' });
    console.log('Screenshot saved: modal-open.png');

    // Click on Business Man model card
    console.log('Clicking Business Man model...');
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.cursor-pointer'));
      const businessManCard = cards.find(card =>
        card.textContent.includes('Business Man')
      );
      if (businessManCard) {
        businessManCard.click();
      }
    });

    // Wait for model to load
    await wait(3000);
    console.log('Waiting for model to load...');

    // Take screenshot after model switch
    await page.screenshot({ path: '/WorldCharacters/screenshots/business-man-loaded.png' });
    console.log('Screenshot saved: business-man-loaded.png');

    // Open modal again
    console.log('Opening modal again...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const modelsButton = buttons.find(btn => btn.textContent.includes('Models'));
      if (modelsButton) {
        modelsButton.click();
      }
    });

    // Wait for modal with fallback
    await wait(1000);
    try {
      await page.waitForSelector('[role="dialog"]', { timeout: 2000 });
    } catch {
      console.log('Using .fixed selector for second modal open...');
      await page.waitForSelector('.fixed', { timeout: 2000 });
    }

    // Click on Green Guy model
    console.log('Clicking Green Guy model...');
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.cursor-pointer'));
      const greenGuyCard = cards.find(card =>
        card.textContent.includes('Green Guy')
      );
      if (greenGuyCard) {
        greenGuyCard.click();
      }
    });

    // Wait for model to load
    await wait(3000);
    console.log('Waiting for Green Guy to load...');

    // Take final screenshot
    await page.screenshot({ path: '/WorldCharacters/screenshots/green-guy-loaded.png' });
    console.log('Screenshot saved: green-guy-loaded.png');

    console.log('\n✅ Test completed successfully!');
    console.log('Screenshots saved to /WorldCharacters/screenshots/');

    // Don't close the browser, just disconnect
    await browser.disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testModelSelector();

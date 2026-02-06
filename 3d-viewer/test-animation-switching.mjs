import puppeteer from 'puppeteer-core';

const CHROME_HOST = '192.168.65.254';
const CHROME_PORT = 9222;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testAnimationSwitching() {
  console.log('Connecting to Chrome via CDP...');

  try {
    const browser = await puppeteer.connect({
      browserURL: `http://${CHROME_HOST}:${CHROME_PORT}`,
      defaultViewport: null,
    });

    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('localhost:5174'))
      || await browser.newPage();

    if (!page.url().includes('localhost:5174')) {
      await page.goto('http://localhost:5174', { waitUntil: 'networkidle2' });
    }

    console.log('Page ready, setting up console listener...\n');

    // Collect console messages
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log(`[CONSOLE] ${text}`);
    });

    // Wait for page to be ready
    await page.waitForSelector('button', { timeout: 10000 });
    console.log('\n=== Initial state ===');
    await wait(1000);

    // Get current model info
    let modelInfo = await page.evaluate(() => {
      const modelInfoDiv = document.querySelector('[class*="text-xs"]');
      const animationCards = Array.from(document.querySelectorAll('[class*="rounded-lg"]'))
        .filter(el => el.textContent.includes('Playing') || el.textContent.includes('Stopped'));

      return {
        model: modelInfoDiv?.textContent || 'Unknown',
        animations: animationCards.map(card => {
          const name = card.querySelector('[class*="font-medium"]')?.textContent;
          const status = card.textContent.includes('Playing') ? 'Playing' : 'Stopped';
          return `${name}: ${status}`;
        })
      };
    });

    console.log('Current model:', modelInfo.model);
    console.log('Animations:', modelInfo.animations);

    // Click Models button
    console.log('\n=== Clicking Models button ===');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const modelsButton = buttons.find(btn => btn.textContent.includes('Models'));
      if (modelsButton) modelsButton.click();
    });

    await wait(1000);

    // Click Business Man
    console.log('\n=== Switching to Business Man ===');
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.cursor-pointer'));
      const businessManCard = cards.find(card => card.textContent.includes('Business Man'));
      if (businessManCard) businessManCard.click();
    });

    // Wait for model to load
    await wait(4000);

    // Get new model info
    modelInfo = await page.evaluate(() => {
      const modelInfoDiv = document.querySelector('[class*="text-xs"]');
      const animationCards = Array.from(document.querySelectorAll('[class*="rounded-lg"]'))
        .filter(el => el.textContent.includes('Playing') || el.textContent.includes('Stopped'));

      return {
        model: modelInfoDiv?.textContent || 'Unknown',
        animations: animationCards.map(card => {
          const name = card.querySelector('[class*="font-medium"]')?.textContent;
          const status = card.textContent.includes('Playing') ? 'Playing' : 'Stopped';
          return `${name}: ${status}`;
        })
      };
    });

    console.log('\nCurrent model:', modelInfo.model);
    console.log('Animations:', modelInfo.animations);

    // Open modal and switch to Green Guy
    console.log('\n=== Switching back to Green Guy ===');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const modelsButton = buttons.find(btn => btn.textContent.includes('Models'));
      if (modelsButton) modelsButton.click();
    });

    await wait(1000);

    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.cursor-pointer'));
      const greenGuyCard = cards.find(card => card.textContent.includes('Green Guy'));
      if (greenGuyCard) greenGuyCard.click();
    });

    await wait(4000);

    // Get final model info
    modelInfo = await page.evaluate(() => {
      const modelInfoDiv = document.querySelector('[class*="text-xs"]');
      const animationCards = Array.from(document.querySelectorAll('[class*="rounded-lg"]'))
        .filter(el => el.textContent.includes('Playing') || el.textContent.includes('Stopped'));

      return {
        model: modelInfoDiv?.textContent || 'Unknown',
        animations: animationCards.map(card => {
          const name = card.querySelector('[class*="font-medium"]')?.textContent;
          const status = card.textContent.includes('Playing') ? 'Playing' : 'Stopped';
          return `${name}: ${status}`;
        })
      };
    });

    console.log('\nCurrent model:', modelInfo.model);
    console.log('Animations:', modelInfo.animations);

    console.log('\n=== Console log summary ===');
    console.log(`Total console messages: ${consoleLogs.length}`);

    // Filter for important messages
    const animationLogs = consoleLogs.filter(log =>
      log.includes('animation') || log.includes('Animation') ||
      log.includes('Available animations') || log.includes('walk') ||
      log.includes('Walk')
    );

    if (animationLogs.length > 0) {
      console.log('\nAnimation-related logs:');
      animationLogs.forEach(log => console.log(`  - ${log}`));
    }

    console.log('\n✅ Test completed!');
    await browser.disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAnimationSwitching();

import puppeteer from 'puppeteer-core';

const CHROME_HOST = '192.168.65.254';
const CHROME_PORT = 9222;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testAnimationState() {
  console.log('Connecting to Chrome via CDP...');

  try {
    const browser = await puppeteer.connect({
      browserURL: `http://${CHROME_HOST}:${CHROME_PORT}`,
      defaultViewport: null,
    });

    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('localhost:5174'));

    if (!page) {
      console.log('No page found with the app');
      await browser.disconnect();
      return;
    }

    // Function to check animation state in Babylon.js
    const checkAnimationState = async (label) => {
      console.log(`\n=== ${label} ===`);

      const state = await page.evaluate(() => {
        // Access Babylon.js scene from window
        const viewer = document.querySelector('canvas')?.parentElement;

        return {
          animationGroupsCount: window.animationGroupsRef?.current?.length || 0,
          canvasExists: !!document.querySelector('canvas'),
          timestamp: Date.now()
        };
      });

      console.log('Animation groups count:', state.animationGroupsCount);
      console.log('Canvas exists:', state.canvasExists);

      // Check if animations are actually running via Babylon
      const babylonState = await page.evaluate(() => {
        // Try to access the Babylon scene
        const canvas = document.querySelector('canvas');
        if (!canvas) return { error: 'No canvas' };

        // Get the engine from canvas
        try {
          // Babylon stores references on the canvas element
          const scene = canvas.scene;
          if (!scene) return { error: 'No scene on canvas' };

          const animationGroups = scene.animationGroups || [];

          return {
            sceneExists: true,
            animationGroupsCount: animationGroups.length,
            animations: animationGroups.map(ag => ({
              name: ag.name,
              isPlaying: ag.isPlaying,
              isPaused: ag.isPaused,
              isStarted: ag.isStarted,
              speedRatio: ag.speedRatio,
              from: ag.from,
              to: ag.to
            }))
          };
        } catch (e) {
          return { error: e.message };
        }
      });

      console.log('Babylon state:', JSON.stringify(babylonState, null, 2));
    };

    await page.waitForSelector('button', { timeout: 10000 });

    // Check initial state (Green Guy)
    await checkAnimationState('Initial State - Green Guy');
    await wait(2000);

    // Switch to Business Man
    console.log('\n>>> Switching to Business Man...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const modelsButton = buttons.find(btn => btn.textContent.includes('Models'));
      if (modelsButton) modelsButton.click();
    });
    await wait(1000);

    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.cursor-pointer'));
      const businessManCard = cards.find(card => card.textContent.includes('Business Man'));
      if (businessManCard) businessManCard.click();
    });

    await wait(4000);
    await checkAnimationState('After switching to Business Man');

    // Switch back to Green Guy
    console.log('\n>>> Switching back to Green Guy...');
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
    await checkAnimationState('After switching back to Green Guy');

    console.log('\n✅ Test completed!');
    await browser.disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAnimationState();

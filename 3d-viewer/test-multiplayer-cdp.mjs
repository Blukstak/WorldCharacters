#!/usr/bin/env node
// Multiplayer test via Chrome DevTools Protocol
// Requires Chrome running with: --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0

import puppeteer from 'puppeteer-core';

const CHROME_HOST = '192.168.65.254';
const CHROME_PORT = 9222;
const APP_URL = 'http://localhost:5174';
const NUM_TABS = parseInt(process.argv[2] || '3', 10);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🎮 MULTIPLAYER TEST via Chrome CDP`);
  console.log(`${'='.repeat(70)}\n`);
  console.log(`Chrome CDP:  ${CHROME_HOST}:${CHROME_PORT}`);
  console.log(`App URL:     ${APP_URL}`);
  console.log(`Tabs:        ${NUM_TABS}\n`);

  try {
    console.log('Connecting to Chrome...');
    const browser = await puppeteer.connect({
      browserURL: `http://${CHROME_HOST}:${CHROME_PORT}`,
      defaultViewport: null,
    });
    console.log('✅ Connected to Chrome\n');

    const pages = [];
    const allLogs = [];

    // Open or find tabs
    console.log(`${'='.repeat(70)}`);
    console.log(`📂 STEP 1: Opening ${NUM_TABS} tabs`);
    console.log(`${'='.repeat(70)}\n`);

    const existingPages = await browser.pages();

    for (let i = 0; i < NUM_TABS; i++) {
      console.log(`Tab ${i + 1}:`);
      let page;

      // Try to reuse existing tabs with the app
      const existingPage = existingPages[i];
      if (existingPage && existingPage.url().includes('localhost:5174')) {
        page = existingPage;
        console.log(`  ♻️  Using existing tab`);
      } else {
        page = await browser.newPage();
        console.log(`  🆕 Created new tab`);
        await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        console.log(`  ✅ Loaded ${APP_URL}`);
      }

      // Set up console logging for this tab
      const pageLogs = [];
      page.on('console', (msg) => {
        const type = msg.type().toUpperCase();
        const text = msg.text();
        const logEntry = `[Tab ${i + 1}] [${type}] ${text}`;
        pageLogs.push(logEntry);
        allLogs.push(logEntry);
      });

      page.on('pageerror', (err) => {
        const logEntry = `[Tab ${i + 1}] [ERROR] ${err.message}`;
        pageLogs.push(logEntry);
        allLogs.push(logEntry);
      });

      // Wait for page to be fully loaded
      await page.waitForSelector('button', { timeout: 10000 });
      console.log(`  ✅ Page ready with buttons\n`);

      pages.push({ page, logs: pageLogs, tabNum: i + 1 });
    }

    console.log(`✅ All ${NUM_TABS} tabs ready\n`);

    // Verify WebGL is working
    console.log(`${'='.repeat(70)}`);
    console.log(`🔍 STEP 2: Verifying WebGL Support`);
    console.log(`${'='.repeat(70)}\n`);

    const webglCheck = await pages[0].page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return {
        hasWebGL: !!gl,
        hasCanvas: !!document.querySelector('canvas'),
        hasButtons: document.querySelectorAll('button').length > 0,
        buttonCount: document.querySelectorAll('button').length,
      };
    });

    console.log(`  WebGL Available:    ${webglCheck.hasWebGL ? '✅' : '❌'}`);
    console.log(`  Canvas Rendered:    ${webglCheck.hasCanvas ? '✅' : '❌'}`);
    console.log(`  Buttons Found:      ${webglCheck.hasButtons ? '✅' : '❌'} (${webglCheck.buttonCount} total)\n`);

    if (!webglCheck.hasWebGL || !webglCheck.hasCanvas) {
      console.error('❌ Page not rendering properly. Aborting test.\n');
      await browser.disconnect();
      process.exit(1);
    }

    // Enable multiplayer in all tabs
    console.log(`${'='.repeat(70)}`);
    console.log(`🔌 STEP 3: Enabling Multiplayer Mode in All Tabs`);
    console.log(`${'='.repeat(70)}\n`);

    for (const { page, tabNum } of pages) {
      try {
        const result = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const multiplayerBtn = buttons.find(btn =>
            btn.textContent.includes('Multiplayer Mode') ||
            btn.textContent.includes('Multiplayer (')
          );
          if (multiplayerBtn) {
            const beforeText = multiplayerBtn.textContent;
            multiplayerBtn.click();
            return { success: true, buttonText: beforeText };
          }
          return { success: false, buttonText: null };
        });

        if (result.success) {
          console.log(`  Tab ${tabNum}: ✅ Clicked "${result.buttonText}"`);
          await wait(2000); // Wait for connection
        } else {
          console.log(`  Tab ${tabNum}: ⚠️  Multiplayer button not found`);
        }
      } catch (err) {
        console.log(`  Tab ${tabNum}: ❌ Error: ${err.message}`);
      }
    }

    console.log(`\n✅ Multiplayer activation complete`);
    console.log(`⏱️  Waiting 3s for all clients to connect...\n`);
    await wait(3000);

    // Check player count in each tab
    console.log(`${'='.repeat(70)}`);
    console.log(`👥 STEP 4: Checking Player Count`);
    console.log(`${'='.repeat(70)}\n`);

    for (const { page, tabNum } of pages) {
      const buttonInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const multiplayerBtn = buttons.find(btn =>
          btn.textContent.includes('Multiplayer')
        );
        return multiplayerBtn ? multiplayerBtn.textContent : 'Button not found';
      });
      console.log(`  Tab ${tabNum}: ${buttonInfo}`);
    }

    // Test simultaneous movement
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎯 STEP 5: Testing Click-to-Move Synchronization`);
    console.log(`${'='.repeat(70)}\n`);

    console.log(`  Tab 1: Clicking at (600, 400)...`);
    await pages[0].page.mouse.click(600, 400);
    await wait(1000);
    console.log(`  Tab 1: ✅ Click sent`);

    if (NUM_TABS >= 2) {
      console.log(`\n  Tab 2: Clicking at (400, 500)...`);
      await pages[1].page.mouse.click(400, 500);
      await wait(1000);
      console.log(`  Tab 2: ✅ Click sent`);
    }

    if (NUM_TABS >= 3) {
      console.log(`\n  Tab 3: Clicking at (700, 300)...`);
      await pages[2].page.mouse.click(700, 300);
      await wait(1000);
      console.log(`  Tab 3: ✅ Click sent`);
    }

    console.log(`\n  ⏱️  Waiting 4s for movements to synchronize...\n`);
    await wait(4000);

    // Take screenshots
    console.log(`${'='.repeat(70)}`);
    console.log(`📸 STEP 6: Taking Screenshots`);
    console.log(`${'='.repeat(70)}\n`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    for (const { page, tabNum } of pages) {
      const screenshotPath = `/WorldCharacters/screenshots/multiplayer-tab${tabNum}-${timestamp}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  Tab ${tabNum}: screenshots/multiplayer-tab${tabNum}-${timestamp}.png`);
    }

    // Analyze logs
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 TEST SUMMARY`);
    console.log(`${'='.repeat(70)}\n`);

    console.log(`✅ Tabs tested:    ${NUM_TABS}`);
    console.log(`✅ Screenshots:    ${NUM_TABS}`);
    console.log(`✅ Total logs:     ${allLogs.length}`);

    const hasColyseus = allLogs.some(log => log.toLowerCase().includes('colyseus'));
    const hasConnected = allLogs.some(log => log.toLowerCase().includes('connected'));
    const hasRoom = allLogs.some(log => log.toLowerCase().includes('room'));
    const hasPlayerAdded = allLogs.some(log => log.toLowerCase().includes('player') && log.toLowerCase().includes('added'));
    const hasErrors = allLogs.some(log => log.includes('[ERROR]'));
    const hasWebGLError = allLogs.some(log => log.toLowerCase().includes('webgl not supported'));

    console.log(`\n🔍 Key Events Detected:`);
    console.log(`  ${hasColyseus ? '✅' : '⚠️ '} Colyseus messages`);
    console.log(`  ${hasConnected ? '✅' : '⚠️ '} Connection success`);
    console.log(`  ${hasRoom ? '✅' : '⚠️ '} Room messages`);
    console.log(`  ${hasPlayerAdded ? '✅' : '⚠️ '} Player added events`);
    console.log(`  ${hasErrors ? '⚠️ ' : '✅'} ${hasErrors ? 'Errors found' : 'No errors'}`);
    console.log(`  ${hasWebGLError ? '❌' : '✅'} ${hasWebGLError ? 'WebGL errors!' : 'WebGL working'}`);

    // Show relevant console logs
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📋 RELEVANT CONSOLE LOGS`);
    console.log(`${'='.repeat(70)}\n`);

    const relevantLogs = allLogs.filter(log => {
      const lower = log.toLowerCase();
      return lower.includes('colyseus') ||
             lower.includes('multiplayer') ||
             lower.includes('connected') ||
             lower.includes('player') ||
             lower.includes('room') ||
             log.includes('[ERROR]') ||
             log.includes('[WARN]');
    });

    if (relevantLogs.length === 0) {
      console.log('(no relevant logs captured)');
    } else {
      relevantLogs.slice(0, 50).forEach(log => console.log(log)); // Limit to 50 lines
      if (relevantLogs.length > 50) {
        console.log(`\n... (${relevantLogs.length - 50} more log lines)`);
      }
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ MULTIPLAYER TEST COMPLETE`);
    console.log(`${'='.repeat(70)}\n`);

    // Don't close browser, just disconnect
    await browser.disconnect();

  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

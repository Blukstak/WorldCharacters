#!/usr/bin/env node
// Test 2 players connecting and verify with screenshots

import puppeteer from 'puppeteer-core';

const CHROME_HOST = '192.168.65.254';
const CHROME_PORT = 9222;
const APP_URL = 'http://localhost:5174';

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🎮 TWO PLAYER TEST');
  console.log('='.repeat(70) + '\n');

  const browser = await puppeteer.connect({
    browserURL: `http://${CHROME_HOST}:${CHROME_PORT}`,
    defaultViewport: null,
  });

  console.log('✅ Connected to Chrome\n');

  // Close all existing tabs first
  const existingPages = await browser.pages();
  for (let i = 1; i < existingPages.length; i++) {
    await existingPages[i].close();
  }
  if (existingPages[0]) {
    await existingPages[0].goto('about:blank');
  }
  console.log('🧹 Cleaned up existing tabs\n');

  const players = [];

  // Create Player 1
  console.log('👤 Creating Player 1...');
  const player1 = await browser.newPage();
  await player1.setViewport({ width: 1400, height: 900 });

  player1.on('console', msg => {
    const text = msg.text();
    if (text.includes('[ColyseusManager]') || text.includes('[Multiplayer]')) {
      console.log(`  [P1] ${text}`);
    }
  });

  await player1.goto(APP_URL, { waitUntil: 'networkidle2' });
  await player1.waitForSelector('button', { timeout: 10000 });
  console.log('  ✅ Player 1 loaded\n');

  // Enable multiplayer for Player 1
  await player1.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.includes('Multiplayer Mode'));
    if (btn) btn.click();
  });
  console.log('  🔌 Player 1: Multiplayer Mode clicked');
  await new Promise(r => setTimeout(r, 3000));

  players.push({ page: player1, name: 'Player 1' });

  // Create Player 2
  console.log('\n👤 Creating Player 2...');
  const player2 = await browser.newPage();
  await player2.setViewport({ width: 1400, height: 900 });

  player2.on('console', msg => {
    const text = msg.text();
    if (text.includes('[ColyseusManager]') || text.includes('[Multiplayer]')) {
      console.log(`  [P2] ${text}`);
    }
  });

  await player2.goto(APP_URL, { waitUntil: 'networkidle2' });
  await player2.waitForSelector('button', { timeout: 10000 });
  console.log('  ✅ Player 2 loaded\n');

  // Enable multiplayer for Player 2
  await player2.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.includes('Multiplayer Mode'));
    if (btn) btn.click();
  });
  console.log('  🔌 Player 2: Multiplayer Mode clicked');
  await new Promise(r => setTimeout(r, 3000));

  players.push({ page: player2, name: 'Player 2' });

  // Wait for connections to stabilize
  console.log('\n⏱️  Waiting 5 seconds for connections to stabilize...\n');
  await new Promise(r => setTimeout(r, 5000));

  // Check status
  console.log('='.repeat(70));
  console.log('📊 STATUS CHECK');
  console.log('='.repeat(70) + '\n');

  for (const { page, name } of players) {
    const status = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const multiplayerBtn = buttons.find(b => b.textContent.includes('Multiplayer'));
      return {
        buttonText: multiplayerBtn ? multiplayerBtn.textContent : 'Not found',
        hasCanvas: !!document.querySelector('canvas'),
        bodyText: document.body.innerText.substring(0, 200),
      };
    });

    console.log(`${name}:`);
    console.log(`  Button: ${status.buttonText}`);
    console.log(`  Canvas: ${status.hasCanvas ? 'Yes' : 'No'}`);
  }

  // Take screenshots
  console.log('\n' + '='.repeat(70));
  console.log('📸 TAKING SCREENSHOTS');
  console.log('='.repeat(70) + '\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

  for (const { page, name } of players) {
    const filename = `/WorldCharacters/screenshots/2-player-${name.toLowerCase().replace(' ', '-')}-${timestamp}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`  ${name}: screenshots/2-player-${name.toLowerCase().replace(' ', '-')}-${timestamp}.png`);
  }

  // Take side-by-side comparison screenshot from Player 1
  console.log('\n📸 Comprehensive screenshot from Player 1...');
  await player1.screenshot({
    path: `/WorldCharacters/screenshots/2-player-verification-${timestamp}.png`,
    fullPage: false
  });
  console.log(`  screenshots/2-player-verification-${timestamp}.png`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ TEST COMPLETE');
  console.log('='.repeat(70) + '\n');

  await browser.disconnect();
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});

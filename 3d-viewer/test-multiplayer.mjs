import puppeteer from 'puppeteer-core';

const CHROME_HOST = '192.168.65.254';
const CHROME_PORT = 9222;
const APP_URL = 'http://localhost:5174';
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * PlayerInstance - Represents a player browser instance for testing
 */
class PlayerInstance {
  constructor(page, identity) {
    this.page = page;
    this.identity = identity;
  }

  /**
   * Wait for multiplayer initialization
   */
  async waitForConnection() {
    try {
      // Wait for canvas to be ready
      await this.page.waitForFunction(
        () => {
          const canvas = document.querySelector('canvas');
          return canvas !== null;
        },
        { timeout: 10000 }
      );

      // Wait for multiplayer references to be available
      console.log(`[${this.identity}] Waiting for multiplayer initialization...`);
      await wait(6000); // Give time for LiveKit to connect and multiplayer to initialize

      // Debug: Check if multiplayer is actually initialized and get console errors
      const debugInfo = await this.page.evaluate(() => {
        return {
          hasLocalPlayer: !!window.localPlayerRef,
          hasMultiplayerManager: !!window.multiplayerManagerRef,
          pageText: document.body.innerText.substring(0, 300)
        };
      });

      // Get console logs
      this.page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log(`[${this.identity}] Browser error:`, msg.text());
        }
      });

      console.log(`[${this.identity}] Debug:`, debugInfo);
      console.log(`[${this.identity}] Multiplayer ready`);
    } catch (error) {
      console.error(`[${this.identity}] Failed to initialize:`, error.message);
      throw error;
    }
  }

  /**
   * Click on canvas at specific coordinates
   */
  async clickAt(x, y) {
    try {
      const canvas = await this.page.$('canvas');
      if (!canvas) {
        throw new Error('Canvas not found');
      }

      const box = await canvas.boundingBox();
      if (!box) {
        throw new Error('Canvas has no bounding box');
      }

      await this.page.mouse.click(box.x + x, box.y + y);
      console.log(`[${this.identity}] Clicked at (${x}, ${y})`);
    } catch (error) {
      console.error(`[${this.identity}] Click failed:`, error.message);
      throw error;
    }
  }

  /**
   * Check if remote player exists
   */
  async hasRemotePlayer(remoteIdentity) {
    return await this.page.evaluate((id) => {
      return window.multiplayerManagerRef?.current?.hasRemotePlayer(id) || false;
    }, remoteIdentity);
  }

  /**
   * Get remote player position
   */
  async getRemotePlayerPosition(remoteIdentity) {
    return await this.page.evaluate((id) => {
      const player = window.multiplayerManagerRef?.current?.getRemotePlayer(id);
      if (!player) return null;
      const pos = player.getPosition();
      return { x: pos.x, y: pos.y, z: pos.z };
    }, remoteIdentity);
  }

  /**
   * Get local player position
   */
  async getLocalPlayerPosition() {
    return await this.page.evaluate(() => {
      const player = window.localPlayerRef?.current;
      if (!player) return null;
      const pos = player.getPosition();
      return { x: pos.x, y: pos.y, z: pos.z };
    });
  }

  /**
   * Take screenshot
   */
  async screenshot(path) {
    await this.page.screenshot({ path });
    console.log(`[${this.identity}] Screenshot saved to ${path}`);
  }

  /**
   * Close instance
   */
  async close() {
    await this.page.close();
    console.log(`[${this.identity}] Closed`);
  }
}

/**
 * Create a new player instance
 */
async function createPlayerInstance(browser, identity) {
  console.log(`\n=== Creating player instance: ${identity} ===`);

  const page = await browser.newPage();

  // Grant fake media device permissions
  const context = page.browserContext();
  await context.overridePermissions(APP_URL, ['camera', 'microphone']);

  // Set up fake media devices (emulated camera/microphone)
  const client = await page.createCDPSession();
  await client.send('Emulation.setFocusEmulationEnabled', { enabled: true });

  // Inject fake getUserMedia BEFORE page loads
  await page.evaluateOnNewDocument(() => {
    // Create fake video track
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Random color for each instance
      ctx.fillStyle = '#' + Math.floor(Math.random()*16777215).toString(16);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Create fake audio track using Web Audio API
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const dst = oscillator.connect(audioContext.createMediaStreamDestination());
    oscillator.start();

    // Combine video and audio tracks
    const videoStream = canvas.captureStream(30);
    const audioStream = dst.stream;

    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks()
    ]);

    // Override getUserMedia
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      console.log('[Test] Using fake media devices');
      return combinedStream;
    };
  });

  // Now navigate to the page
  await page.goto(APP_URL);

  // Wait for page to load
  await page.waitForSelector('button', { timeout: 10000 });
  console.log(`[${identity}] Page loaded`);

  // Wait for initial render
  await wait(2000);

  // Click Models button to open selector
  try {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const modelsButton = buttons.find(btn => btn.textContent.includes('Models'));
      if (modelsButton) modelsButton.click();
    });
  } catch (e) {
    console.log(`[${identity}] Note: Models button may already be showing or not needed`);
  }

  await wait(1000);

  // Select Green Guy model (may already be loaded)
  try {
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.cursor-pointer'));
      const greenGuyCard = cards.find(card => card.textContent.includes('Green Guy'));
      if (greenGuyCard) greenGuyCard.click();
    });
    console.log(`[${identity}] Green Guy model selected`);
  } catch (e) {
    console.log(`[${identity}] Green Guy may already be loaded`);
  }

  await wait(2000);

  // Enable multiplayer mode
  try {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const multiplayerButton = buttons.find(btn => btn.textContent.includes('Multiplayer Mode'));
      if (multiplayerButton) {
        multiplayerButton.click();
        return true;
      }
      return false;
    });
    console.log(`[${identity}] Multiplayer mode enabled`);
  } catch (e) {
    console.log(`[${identity}] Error enabling multiplayer:`, e.message);
    throw e;
  }

  await wait(1000);

  const instance = new PlayerInstance(page, identity);
  await instance.waitForConnection();

  return instance;
}

/**
 * Test 1: Two players connect and see each other
 */
async function testTwoPlayersConnect(browser) {
  console.log('\n========================================');
  console.log('TEST 1: Two players connect and see each other');
  console.log('========================================\n');

  const [p1, p2] = await Promise.all([
    createPlayerInstance(browser, 'player1'),
    createPlayerInstance(browser, 'player2')
  ]);

  await wait(3000); // Allow synchronization

  const p1SeesP2 = await p1.hasRemotePlayer('player2');
  const p2SeesP1 = await p2.hasRemotePlayer('player1');

  console.log(`\nResults:`);
  console.log(`  Player 1 sees Player 2: ${p1SeesP2 ? '✓' : '✗'}`);
  console.log(`  Player 2 sees Player 1: ${p2SeesP1 ? '✓' : '✗'}`);

  const success = p1SeesP2 && p2SeesP1;
  console.log(`\n${success ? '✅ TEST PASSED' : '❌ TEST FAILED'}`);

  await p1.close();
  await p2.close();

  return success;
}

/**
 * Test 2: Player movement synchronization
 */
async function testMovementSync(browser) {
  console.log('\n========================================');
  console.log('TEST 2: Player movement synchronization');
  console.log('========================================\n');

  const [p1, p2] = await Promise.all([
    createPlayerInstance(browser, 'player1'),
    createPlayerInstance(browser, 'player2')
  ]);

  await wait(2000);

  // Player 1 clicks to move
  await p1.clickAt(200, 200);
  console.log(`\n[player1] Moving to new location...`);

  // Wait for movement
  await wait(3000);

  // Check if Player 2 sees Player 1's movement
  const p1PosOnP2 = await p2.getRemotePlayerPosition('player1');
  console.log(`\nPlayer 1 position seen by Player 2:`, p1PosOnP2);

  // Verify position changed from origin
  const movedSignificantly =
    p1PosOnP2 && (Math.abs(p1PosOnP2.x) > 1 || Math.abs(p1PosOnP2.z) > 1);

  console.log(`\nResults:`);
  console.log(`  Player moved from origin: ${movedSignificantly ? '✓' : '✗'}`);

  // Take screenshots
  await p1.screenshot('/WorldCharacters/screenshots/mp-player1.png');
  await p2.screenshot('/WorldCharacters/screenshots/mp-player2.png');

  const success = movedSignificantly;
  console.log(`\n${success ? '✅ TEST PASSED' : '❌ TEST FAILED'}`);

  await p1.close();
  await p2.close();

  return success;
}

/**
 * Test 3: Three players move simultaneously
 */
async function testThreePlayersConcurrent(browser) {
  console.log('\n========================================');
  console.log('TEST 3: Three players move simultaneously');
  console.log('========================================\n');

  const [p1, p2, p3] = await Promise.all([
    createPlayerInstance(browser, 'player1'),
    createPlayerInstance(browser, 'player2'),
    createPlayerInstance(browser, 'player3')
  ]);

  await wait(3000);

  // All players click different locations
  console.log('\nAll players moving to different locations...');
  await Promise.all([
    p1.clickAt(150, 150),
    p2.clickAt(250, 150),
    p3.clickAt(200, 250)
  ]);

  await wait(4000);

  // Verify all players see each other
  const p1SeesOthers = await p1.hasRemotePlayer('player2') &&
                        await p1.hasRemotePlayer('player3');
  const p2SeesOthers = await p2.hasRemotePlayer('player1') &&
                        await p2.hasRemotePlayer('player3');
  const p3SeesOthers = await p3.hasRemotePlayer('player1') &&
                        await p3.hasRemotePlayer('player2');

  console.log(`\nResults:`);
  console.log(`  Player 1 sees others: ${p1SeesOthers ? '✓' : '✗'}`);
  console.log(`  Player 2 sees others: ${p2SeesOthers ? '✓' : '✗'}`);
  console.log(`  Player 3 sees others: ${p3SeesOthers ? '✓' : '✗'}`);

  // Screenshot from each perspective
  await Promise.all([
    p1.screenshot('/WorldCharacters/screenshots/mp-3player-view1.png'),
    p2.screenshot('/WorldCharacters/screenshots/mp-3player-view2.png'),
    p3.screenshot('/WorldCharacters/screenshots/mp-3player-view3.png')
  ]);

  const success = p1SeesOthers && p2SeesOthers && p3SeesOthers;
  console.log(`\n${success ? '✅ TEST PASSED' : '❌ TEST FAILED'}`);

  await p1.close();
  await p2.close();
  await p3.close();

  return success;
}

/**
 * Test 4: Player disconnect handling
 */
async function testPlayerDisconnect(browser) {
  console.log('\n========================================');
  console.log('TEST 4: Player disconnect handling');
  console.log('========================================\n');

  const [p1, p2] = await Promise.all([
    createPlayerInstance(browser, 'player1'),
    createPlayerInstance(browser, 'player2')
  ]);

  await wait(2000);

  const p1SeesP2 = await p1.hasRemotePlayer('player2');
  console.log(`\nBefore disconnect:`);
  console.log(`  Player 1 sees Player 2: ${p1SeesP2 ? '✓' : '✗'}`);

  // Player 2 disconnects
  console.log(`\n[player2] Disconnecting...`);
  await p2.close();

  await wait(2000);

  const p1StillSeesP2 = await p1.hasRemotePlayer('player2');
  console.log(`\nAfter disconnect:`);
  console.log(`  Player 1 sees Player 2: ${p1StillSeesP2 ? '✗ (should be false)' : '✓'}`);

  const success = p1SeesP2 && !p1StillSeesP2;
  console.log(`\n${success ? '✅ TEST PASSED' : '❌ TEST FAILED'}`);

  await p1.close();

  return success;
}

/**
 * Test 5: Pathfinding validation
 */
async function testPathfinding(browser) {
  console.log('\n========================================');
  console.log('TEST 5: Pathfinding validation');
  console.log('========================================\n');

  const p1 = await createPlayerInstance(browser, 'player1');

  await wait(1000);

  // Get initial position
  const initialPos = await p1.getLocalPlayerPosition();
  console.log(`\nInitial position:`, initialPos);

  // Click to move
  console.log(`\n[player1] Clicking to move...`);
  await p1.clickAt(300, 300);

  await wait(4000);

  // Get final position
  const finalPos = await p1.getLocalPlayerPosition();
  console.log(`Final position:`, finalPos);

  // Check if player moved
  const moved = finalPos &&
    (Math.abs(finalPos.x - (initialPos?.x || 0)) > 1 ||
     Math.abs(finalPos.z - (initialPos?.z || 0)) > 1);

  console.log(`\nResults:`);
  console.log(`  Player moved: ${moved ? '✓' : '✗'}`);

  // Visual verification
  await p1.screenshot('/WorldCharacters/screenshots/mp-pathfinding.png');

  const success = moved;
  console.log(`\n${success ? '✅ TEST PASSED' : '❌ TEST FAILED'}`);

  await p1.close();

  return success;
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('========================================');
  console.log('MULTIPLAYER TEST SUITE');
  console.log('========================================');
  console.log(`Chrome CDP: ${CHROME_HOST}:${CHROME_PORT}`);
  console.log(`App URL: ${APP_URL}`);
  console.log('========================================\n');

  let browser;
  const results = {
    twoPlayersConnect: false,
    movementSync: false,
    threePlayersConcurrent: false,
    playerDisconnect: false,
    pathfinding: false,
  };

  try {
    console.log('Connecting to Chrome via CDP...');
    browser = await puppeteer.connect({
      browserURL: `http://${CHROME_HOST}:${CHROME_PORT}`,
      defaultViewport: null,
    });
    console.log('✓ Connected to Chrome\n');

    // Run tests
    results.twoPlayersConnect = await testTwoPlayersConnect(browser);
    await wait(2000);

    results.movementSync = await testMovementSync(browser);
    await wait(2000);

    results.threePlayersConcurrent = await testThreePlayersConcurrent(browser);
    await wait(2000);

    results.playerDisconnect = await testPlayerDisconnect(browser);
    await wait(2000);

    results.pathfinding = await testPathfinding(browser);

  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.disconnect();
    }
  }

  // Print summary
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  console.log(`Two players connect:       ${results.twoPlayersConnect ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Movement synchronization:  ${results.movementSync ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Three players concurrent:  ${results.threePlayersConcurrent ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Player disconnect:         ${results.playerDisconnect ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Pathfinding validation:    ${results.pathfinding ? '✅ PASS' : '❌ FAIL'}`);
  console.log('========================================');

  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  console.log(`\n${passCount}/${totalCount} tests passed`);

  if (passCount === totalCount) {
    console.log('\n🎉 ALL TESTS PASSED! 🎉\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME TESTS FAILED ⚠️\n');
    process.exit(1);
  }
}

// Run tests
runTests();

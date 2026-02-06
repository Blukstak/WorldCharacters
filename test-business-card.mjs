#!/usr/bin/env node
// Test clicking on a character to trigger business card popup

import puppeteer from 'puppeteer-core';

const CHROME_HOST = '192.168.65.254';
const CHROME_PORT = 9222;

async function main() {
  const browser = await puppeteer.connect({
    browserURL: `http://${CHROME_HOST}:${CHROME_PORT}`,
    defaultViewport: null,
  });

  const pages = await browser.pages();
  let viewerPage = null;
  for (const p of pages) {
    const url = await p.url();
    if (url.includes('5174')) {
      viewerPage = p;
      break;
    }
  }

  if (!viewerPage) {
    console.log('No viewer page found - run test-2-players.mjs first');
    await browser.disconnect();
    return;
  }

  console.log('Found viewer page');

  viewerPage.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Multiplayer]') || text.includes('Character clicked') || text.includes('business card') || text.includes('babylonCharacterClick')) {
      console.log(`  [Console] ${text}`);
    }
  });

  // Check if multiplayer is active
  const status = await viewerPage.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const multiplayerBtn = buttons.find(b => b.textContent.includes('Multiplayer'));
    return multiplayerBtn?.textContent || 'not found';
  });
  console.log('Status:', status);

  // First, move the character to a known position by clicking center
  const canvas = await viewerPage.$('canvas');
  if (!canvas) {
    console.log('No canvas found');
    await browser.disconnect();
    return;
  }

  const box = await canvas.boundingBox();
  if (!box) {
    console.log('No bounding box');
    await browser.disconnect();
    return;
  }

  // Click center of canvas to move character there
  console.log('\n1. Moving local character to center...');
  await viewerPage.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await new Promise(r => setTimeout(r, 3000));

  // Take screenshot to see current positions
  await viewerPage.screenshot({ path: '/WorldCharacters/screenshots/business-card-before-click.png', fullPage: false });
  console.log('   Screenshot: business-card-before-click.png');

  // Now try clicking where characters should be visible
  // Since we moved to center, try clicking slightly off-center where the character was
  console.log('\n2. Trying to click on visible character mesh...');

  // Use evaluate to check what's under the click via scene.pick
  const pickInfo = await viewerPage.evaluate(() => {
    // Access scene through window
    const scene = window.__scene;
    if (!scene) return { error: 'no scene found' };

    // Pick at center where character should be
    const pick = scene.pick(scene.getEngine().getRenderWidth() / 2, scene.getEngine().getRenderHeight() / 2);
    if (pick && pick.hit && pick.pickedMesh) {
      const mesh = pick.pickedMesh;
      let current = mesh;
      const hierarchy = [];
      while (current) {
        hierarchy.push({
          name: current.name,
          hasMetadata: !!current.metadata,
          playerType: current.metadata ? current.metadata.playerType : null,
          profileIndex: current.metadata ? current.metadata.profileIndex : undefined
        });
        current = current.parent;
      }
      return { hit: true, meshName: mesh.name, hierarchy };
    }
    return { hit: false };
  });
  console.log('   Pick result:', JSON.stringify(pickInfo, null, 2));

  // Try clicking right on the character - first scan for character positions
  const charPositions = await viewerPage.evaluate(() => {
    const scene = window.__scene;
    if (!scene) return [];

    const positions = [];
    for (const mesh of scene.meshes) {
      if (mesh.metadata && mesh.metadata.playerType) {
        const pos = mesh.getAbsolutePosition();
        positions.push({
          name: mesh.name,
          playerType: mesh.metadata.playerType,
          profileIndex: mesh.metadata.profileIndex,
          worldPos: { x: pos.x, y: pos.y, z: pos.z }
        });
      }
    }
    return positions;
  });
  console.log('   Character meshes with metadata:', JSON.stringify(charPositions, null, 2));

  // Since __scene might not be exposed, let's just click around where characters are visible
  // Based on the screenshot, characters are near the center-left area
  const clickPositions = [
    { x: 0.33, y: 0.55, label: 'center-left' },
    { x: 0.33, y: 0.6, label: 'center-left lower' },
    { x: 0.35, y: 0.65, label: 'slightly right' },
    { x: 0.5, y: 0.5, label: 'dead center' },
  ];

  for (const pos of clickPositions) {
    const clickX = box.x + box.width * pos.x;
    const clickY = box.y + box.height * pos.y;
    console.log(`\n   Clicking at ${pos.label} (${clickX.toFixed(0)}, ${clickY.toFixed(0)})...`);
    await viewerPage.mouse.click(clickX, clickY);
    await new Promise(r => setTimeout(r, 500));

    // Check if business card popup appeared
    const hasPopup = await viewerPage.evaluate(() => {
      // Look for business card text content
      const h3s = document.querySelectorAll('h3');
      for (const h3 of h3s) {
        if (h3.textContent && h3.closest('.bg-zinc-900')) {
          return { visible: true, name: h3.textContent };
        }
      }
      return { visible: false };
    });

    if (hasPopup.visible) {
      console.log(`   ✅ Business card popup appeared! Name: ${hasPopup.name}`);
      await viewerPage.screenshot({ path: '/WorldCharacters/screenshots/business-card-popup.png', fullPage: false });
      console.log('   Screenshot: business-card-popup.png');
      break;
    } else {
      console.log('   No popup yet');
    }
  }

  // Final screenshot
  await viewerPage.screenshot({ path: '/WorldCharacters/screenshots/business-card-final.png', fullPage: false });
  console.log('\nFinal screenshot: business-card-final.png');

  await browser.disconnect();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
// Close all Chrome tabs except first one

import puppeteer from 'puppeteer-core';

const CHROME_HOST = '192.168.65.254';
const CHROME_PORT = 9222;

async function main() {
  console.log('\n🧹 Closing all Chrome tabs...\n');

  const browser = await puppeteer.connect({
    browserURL: `http://${CHROME_HOST}:${CHROME_PORT}`,
    defaultViewport: null,
  });

  const pages = await browser.pages();
  console.log(`Found ${pages.length} tabs`);

  // Close all tabs except the first one (to keep Chrome window open)
  for (let i = 1; i < pages.length; i++) {
    await pages[i].close();
    console.log(`  ✅ Closed tab ${i}`);
  }

  // Navigate the first tab to about:blank
  if (pages[0]) {
    await pages[0].goto('about:blank');
    console.log(`  ✅ Reset tab 1 to about:blank`);
  }

  console.log(`\n✅ Cleanup complete - ${pages.length - 1} tabs closed\n`);

  await browser.disconnect();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

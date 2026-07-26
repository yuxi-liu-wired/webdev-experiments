#!/usr/bin/env bun
// End-to-end: drive the real page in Chromium, assert on what the user sees,
// and leave screenshots in /tmp/haiku-shots for inspection.
//
//   bun test/e2e.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8093/';
// --no-bsky: for a static deployment where bsky.app is reachable from the
// browser but not from this container, so the proxy fallback cannot be tested.
const SKIP_BSKY = process.argv.includes('--no-bsky');
const SHOTS = '/tmp/haiku-shots';
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({
  headless: false,
  args: ['--disable-gpu', '--disable-software-rasterizer'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });

// The deployed page calls public.api.bsky.app directly. That request cannot
// leave this container, so the browser logs a refused connection before the
// page falls back to the local proxy. Everything else counts as a failure.
// The message text is only "Failed to load resource: ...", so match on the URL
// the console entry points at.
const EXPECTED_IN_BOX = /bsky\.app/;
const errors = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const where = m.location()?.url || '';
  if (EXPECTED_IN_BOX.test(where)) return;
  errors.push(`${m.text()} @ ${where || 'unknown'}`);
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.getElementById('status').textContent.includes('dictionary ready'), { timeout: 30000 });
const ready = await page.textContent('#status');
check('dictionary loads in the browser', /126,030 words/.test(ready), ready.trim());
await page.screenshot({ path: `${SHOTS}/01-empty.png`, fullPage: true });

// --- the sample button ------------------------------------------------------
await page.click('#sample');
await page.waitForFunction(() => document.getElementById('summary').style.display === 'flex', { timeout: 20000 });
const found = Number((await page.textContent('#s-found')).replace(/,/g, ''));
check('sample text yields haiku', found > 0, `${found} found`);
await page.screenshot({ path: `${SHOTS}/02-sample-haiku.png`, fullPage: true });

// Every rendered line must carry the syllable count it claims.
const lineBeats = await page.$$eval('.results li', (lis) => lis.map((li) => [...li.querySelectorAll('.beat')].map((b) => b.textContent)));
check('every result is a 3-line 5-7-5', lineBeats.every((b) => b.join('-') === '5-7-5'), JSON.stringify(lineBeats[0]));

const firstPoem = await page.$eval('.results li .poem', (el) => el.innerText);
console.log('\n' + firstPoem.split('\n').map((l) => `      ${l}`).join('\n') + '\n');

// --- tanka ------------------------------------------------------------------
await page.click('#fm-tanka + label');
await page.click('#sc-cross + label');
await page.click('#go');
await page.waitForFunction(() => !document.getElementById('go').disabled, { timeout: 20000 });
const tankaBeats = await page.$$eval('.results li', (lis) => lis.map((li) => [...li.querySelectorAll('.beat')].map((b) => b.textContent).join('-')));
check('tanka mode returns 5-7-5-7-7', tankaBeats.length > 0 && tankaBeats.every((b) => b === '5-7-5-7-7'), `${tankaBeats.length} found`);
await page.screenshot({ path: `${SHOTS}/03-tanka.png` }); // viewport only: hundreds of results

// --- tanaga -----------------------------------------------------------------
await page.click('#fm-tanaga + label');
await page.click('#go');
await page.waitForFunction(() => !document.getElementById('go').disabled, { timeout: 20000 });
const tanagaBeats = await page.$$eval('.results li', (lis) => lis.map((li) => [...li.querySelectorAll('.beat')].map((b) => b.textContent).join('-')));
check('tanaga mode returns 7-7-7-7', tanagaBeats.length > 0 && tanagaBeats.every((b) => b === '7-7-7-7'), `${tanagaBeats.length} found`);
await page.screenshot({ path: `${SHOTS}/04-tanaga.png` });

// --- custom form ------------------------------------------------------------
await page.click('#fm-custom + label');
await page.fill('#custom', '1-2-3-4-1');
await page.click('#go');
await page.waitForFunction(() => !document.getElementById('go').disabled, { timeout: 20000 });
const lanterne = await page.$$eval('.results li', (lis) => lis.map((li) => [...li.querySelectorAll('.beat')].map((b) => b.textContent).join('-')));
check('custom 1-2-3-4-1 works', lanterne.length > 0 && lanterne.every((b) => b === '1-2-3-4-1'), `${lanterne.length} found`);

await page.fill('#custom', 'not a pattern');
await page.click('#go');
await page.waitForFunction(() => document.querySelector('#status .err'), { timeout: 10000 });
check('a nonsense custom form is rejected politely', true, (await page.textContent('#status')).trim());
await page.screenshot({ path: `${SHOTS}/05-custom-error.png`, fullPage: true });

// --- pasted text, dictionary-only toggle, copy -------------------------------
await page.click('#fm-haiku + label');
await page.click('#sc-seg + label');
await page.fill('#text', 'Hello there. the old silent pond where a green frog jumps into the still cold water. Goodbye.');
await page.click('#go');
await page.waitForFunction(() => !document.getElementById('go').disabled, { timeout: 20000 });
const pasted = await page.$eval('.results li .poem', (el) => el.innerText.replace(/\s*\d\n?/g, '\n').trim());
check('a pasted haiku comes back split 5-7-5',
  /the old silent pond[\s\S]*where a green frog jumps into[\s\S]*the still cold water/.test(pasted), pasted.replace(/\n/g, ' / '));

await page.fill('#text', 'Hello there. the old blorping pond where a green frog jumps into the still cold water. Bye.');
await page.click('#go');
await page.waitForFunction(() => !document.getElementById('go').disabled, { timeout: 20000 });
const guessedMark = await page.$$eval('.guessed', (els) => els.map((e) => e.textContent));
check('out-of-dictionary words are marked as guesses', guessedMark.includes('blorping'), JSON.stringify(guessedMark));
await page.click('#strictwords + label'); // the input itself is display:none
await page.click('#go');
await page.waitForFunction(() => !document.getElementById('go').disabled, { timeout: 20000 });
check('"dictionary words only" drops that poem', (await page.$$('.results li')).length === 0,
  (await page.textContent('#status')).trim());
await page.click('#strictwords + label');
await page.screenshot({ path: `${SHOTS}/06-guessed-dropped.png`, fullPage: true });

// --- empty input ------------------------------------------------------------
await page.fill('#text', '');
await page.click('#go');
await page.waitForFunction(() => document.querySelector('#status .err'), { timeout: 10000 });
check('empty input asks for text rather than throwing', (await page.textContent('#status')).includes('paste some text'));

// --- bluesky source ---------------------------------------------------------
// The container's firewall denies bsky.app, so this goes through the byparr
// proxy in serve.mjs. If byparr is down the check reports it rather than
// silently passing.
if (!SKIP_BSKY) {
let triedDirect = false;
page.on('request', (r) => { if (r.url().includes('public.api.bsky.app')) triedDirect = true; });
await page.click('#src-bsky + label');
await page.fill('#handle', 'bsky.app');
await page.click('#sc-cross + label');
await page.click('#go');
await page.waitForFunction(() => !document.getElementById('go').disabled, { timeout: 120000 });
const bskyStatus = (await page.textContent('#status')).trim();
const bskyWords = Number((await page.textContent('#s-words')).replace(/,/g, ''));
check('a bluesky account can be mined for poems', bskyWords > 100, `${bskyWords} words read — ${bskyStatus}`);
check('the direct bluesky call was tried before the proxy',
  triedDirect, triedDirect ? 'saw a request to public.api.bsky.app' : 'no direct request was made');
await page.screenshot({ path: `${SHOTS}/09-bluesky.png` });
await page.click('#src-text + label');
await page.click('#sc-seg + label');
}

// --- dark mode --------------------------------------------------------------
const dark = await browser.newContext({ colorScheme: 'dark', viewport: { width: 900, height: 1200 } });
const dpage = await dark.newPage();
await dpage.goto(BASE, { waitUntil: 'networkidle' });
await dpage.waitForFunction(() => document.getElementById('status').textContent.includes('dictionary ready'), { timeout: 30000 });
await dpage.click('#sample');
await dpage.waitForFunction(() => document.getElementById('summary').style.display === 'flex', { timeout: 20000 });
await dpage.screenshot({ path: `${SHOTS}/07-dark.png`, fullPage: true });
check('dark mode renders', true);

// --- narrow viewport --------------------------------------------------------
const mobile = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
const mpage = await mobile.newPage();
await mpage.goto(BASE, { waitUntil: 'networkidle' });
await mpage.waitForFunction(() => document.getElementById('status').textContent.includes('dictionary ready'), { timeout: 30000 });
await mpage.click('#sample');
await mpage.waitForFunction(() => document.getElementById('summary').style.display === 'flex', { timeout: 20000 });
await mpage.screenshot({ path: `${SHOTS}/08-mobile.png`, fullPage: true });
const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('no horizontal overflow at 390px', overflow <= 0, `${overflow}px`);

check('no console errors', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(`\n${failures ? `${failures} FAILED` : 'all e2e checks passed'} · screenshots in ${SHOTS}`);
process.exit(failures ? 1 : 0);

// Fills in daily/<date>.json for the next DAYS days that don't have a file yet, by running the real app in headless Chrome.
// Run from the repo root:  node tools/make_daily_ci.mjs     (needs playwright; the GitHub workflow installs it)
// Env: DAYS (default 14), REDO (comma-separated dates to rebuild), CHROME (path to a Chrome/Chromium to use instead of Playwright's), PORT (default 8123).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';

const DAYS = +process.env.DAYS || 14, PORT = +process.env.PORT || 8123;
mkdirSync('daily', { recursive: true });
const dayStr = d => d.toISOString().slice(0, 10);
const today = new Date(dayStr(new Date()) + 'T00:00:00Z');
const wanted = Array.from({ length: DAYS }, (_, i) => dayStr(new Date(today.getTime() + i * 864e5)));
for (const d of (process.env.REDO || '').split(',').filter(Boolean)) if (existsSync(`daily/${d}.json`)) unlinkSync(`daily/${d}.json`);   // REDO=2026-10-13,2026-10-16 rebuilds those days
const missing = wanted.filter(d => !existsSync(`daily/${d}.json`));
if (!missing.length){ console.log('nothing to do: the next', DAYS, 'days already have routes'); process.exit(0); }
const existing = {};
for (const f of readdirSync('daily')) if (/^\d{4}-\d\d-\d\d\.json$/.test(f)) existing[f.slice(0, 10)] = JSON.parse(readFileSync('daily/' + f, 'utf8')).route;

const server = spawn(process.env.PYTHON || 'python', ['-m', 'http.server', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
let failed = 0;
try {
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'log' && m.text().startsWith('[daily]')) console.log(m.text()); });
  await page.goto(`http://localhost:${PORT}/?w=Octopus&l=en`);
  await page.waitForFunction(() => typeof buildRound === 'function' && window.__rh && window.__rh.cur && window.__rh.cur.status === 'ready', null, { timeout: 120000 });
  await page.addScriptTag({ content: readFileSync('tools/make_daily.js', 'utf8') });
  const made = await page.evaluate(([days, existing]) => makeDaily(days, existing, m => console.log('[daily] ' + m)), [missing, existing]);
  for (const [day, route] of Object.entries(made)){
    if (!route || route.length < 5){ failed++; console.log('no route for', day); continue; }
    writeFileSync(`daily/${day}.json`, JSON.stringify({ route }, null, 1) + '\n');
    console.log('wrote daily/' + day + '.json');
  }
} finally { await browser.close(); server.kill(); }
process.exit(failed && failed === missing.length ? 1 : 0);

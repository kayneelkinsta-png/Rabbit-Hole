// A full check of the running app in a real (headless) Chrome: node tools/qa_live.mjs   (BASE=http://localhost:5178/ to test a local copy)
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const BASE = process.env.BASE || 'https://kayneelkinsta-png.github.io/Rabbit-Hole/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const results = []; let current = '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rec = (ok, note = '') => results.push({ name: current, ok, note: String(note).slice(0, 260) });
async function test(name, fn){ current = name; try { await fn(); } catch (e) { rec(false, 'THREW: ' + (e.message || e).toString().split('\n')[0]); } }
const eq = (a, b, what) => rec(a === b, `${what}: got ${JSON.stringify(a)}${a === b ? '' : ', wanted ' + JSON.stringify(b)}`);
const yes = (v, what) => rec(!!v, what + (v ? '' : ' (failed)'));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
async function openPage(ctx, url, wait = 'world'){
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${current}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource.*(429|404)/i.test(m.text())) errors.push(`${current}: console ${m.text().slice(0, 160)}`); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (wait === 'world'){ await page.waitForFunction(() => window.__rh && __rh.cur && __rh.cur.status === 'ready', null, { timeout: 90000 }); await settle(page); }
  return page;
}
const settle = async page => { await sleep(5500); await page.evaluate(() => { const a = document.getElementById('arrive'); if (a) a.classList.remove('on'); }); };
const orbXY = (page, pred) => page.evaluate(src => {
  const f = new Function('it', 'return (' + src + ')(it)'); const T = __rh.cur, s = __rh.cam.s, c = Math.cos(__rh.cam.phi), sn = Math.sin(__rh.cam.phi);
  const vis = T.items.map((it, i) => ({ it, i, x: CX + s * (it.x * c + it.y * sn), y: CY + s * (-it.x * sn + it.y * c), px: it.r * s })).filter(o => o.px > 14 && o.x > 30 && o.x < innerWidth - 30 && o.y > 80 && o.y < innerHeight - 90 && f(o.it));
  vis.sort((a, b) => b.px - a.px); const o = vis[0]; return o ? { x: o.x, y: o.y, title: o.it.title, i: o.i } : null;
}, pred.toString());

const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });

/* 1. the files, the manifest, today's daily route and the outside services */
await test('1 files and services', async () => {
  const get = p => new Promise(res => { const u = new URL(BASE + p); (u.protocol === 'http:' ? http : https).get(u, r => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', () => res(0)); });   // node's own fetch trips over the simple local server
  const files = ['index.html', 'manifest.webmanifest', 'sw.js', 'intro.js', 'css/app.css', 'css/notebook.css', ...fs.readdirSync('js').map(f => 'js/' + f), 'icons/icon-192.png', 'icons/icon-512.png', 'icons/og.jpg', 'sounds/tap.mp3', 'sounds/intro.mp3', 'sounds/whoosh-short.mp3', 'sounds/whoosh-cinematic.mp3'];
  const bad = []; for (const f of files){ const c = await get(f); if (c !== 200) bad.push(f + ' ' + c); }
  yes(!bad.length, `all ${files.length} app files load` + (bad.length ? ': ' + bad.join(', ') : ''));
  const today = new Date().toISOString().slice(0, 10), tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  eq(await get(`daily/${today}.json`), 200, "today's daily route file"); const t2 = await get(`daily/${tomorrow}.json`); rec(t2 === 200, `tomorrow's daily route file: ${t2}`);
  const page = await openPage(desk, BASE + '?w=Octopus&l=en', 'none');
  const cors = await page.evaluate(async () => { const o = {}; const t = async (k, u) => { try { const r = await fetch(u); o[k] = r.status; } catch (e) { o[k] = 'blocked: ' + e.message; } };
    await t('wikipedia', 'https://en.wikipedia.org/w/api.php?action=query&titles=Octopus&format=json&origin=*'); await t('wikidata via wikipedia', 'https://en.wikipedia.org/w/api.php?action=query&titles=Octopus&prop=pageprops&format=json&origin=*');
    await t('openalex works', 'https://api.openalex.org/works?filter=cited_by_count:>1000&per-page=1&select=id'); await t('openalex concepts', 'https://api.openalex.org/concepts?filter=wikidata_id:Q11982&select=id');
    await t('europe pmc search', 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:%2210.1016/j.cell.2020.01.001%22&format=json&resultType=lite'); await t('three.js cdn', 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js'); return o; });
  for (const [k, v] of Object.entries(cors)) rec(v === 200, `${k} reachable from the page: ${v}`);
  await page.close();
});

/* 2. boot, version, a topic link and the world itself */
const P = await openPage(desk, BASE + '?w=Octopus&l=en');
await test('2 boot and world', async () => {
  const st = await P.evaluate(() => ({ title: __rh.cur.title, n: __rh.cur.items.length, slots: __rh.cur.items.filter(i => i.paper).length, ver: document.querySelector('.build').textContent, intro: document.body.classList.contains('introplay'), url: location.search, nb: !!document.getElementById('nbBtn'), lang: LANG, photos: __rh.cur.items.filter(i => i.img === 'done').length }));
  eq(st.title, 'Octopus', 'topic link opened that world'); yes(st.n > 100, `orbs in the world: ${st.n}`); yes(st.slots === 8, 'eight places reserved for papers: ' + st.slots); yes(!st.intro, 'a topic link skips the intro'); yes(/version/.test(st.ver), 'version label: ' + st.ver); yes(st.nb, 'notebook button present'); eq(st.lang, 'en', 'language from the link');
  await P.waitForFunction(() => __rh.cur.items.filter(i => i.img === 'done').length > 20, null, { timeout: 40000 }).then(() => rec(true, 'orb photos loaded'), () => rec(false, 'orb photos did not load'));
  const sw = await P.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r; }); rec(sw, 'service worker registered: ' + sw);
});

/* 3. a real click on an orb opens its tile; read the article; enter the world */
await test('3 tile, reader and falling', async () => {
  const o = await orbXY(P, it => !it.paper && it.thumb && it.title);
  yes(o, 'found an orb to click'); if (!o) return;
  await P.mouse.click(o.x, o.y); await P.waitForFunction(() => document.getElementById('card').classList.contains('on') && document.querySelector('#card p').textContent.length > 40, null, { timeout: 30000 });
  const tile = await P.evaluate(() => ({ h2: document.querySelector('#card h2').textContent, d: document.querySelector('#card p').textContent.length, btns: [...document.querySelectorAll('#card .row button, #card .row a')].filter(b => b.offsetParent).map(b => b.textContent.trim()) }));
  yes(tile.h2 && tile.d > 40, `tile opened for "${tile.h2}" with ${tile.d} characters of text`); yes(tile.btns.length >= 3, 'tile buttons: ' + tile.btns.join(' | '));
  await P.click('#cardWiki'); await P.waitForFunction(() => document.querySelector('#reader article h1') && document.querySelector('#reader article p'), null, { timeout: 25000 });
  const rd = await P.evaluate(() => ({ h1: document.querySelector('#reader article h1').textContent, len: document.querySelector('#reader article').textContent.length, kind: reader.dataset.kind || '', links: document.querySelectorAll('#reader article a[data-t]').length }));
  yes(rd.len > 1500 && rd.kind === '', `article "${rd.h1}" in the reader: ${rd.len} characters, ${rd.links} links`);
  await P.click('#reader .home'); await P.waitForFunction(() => document.getElementById('reader').classList.contains('gone'), null, { timeout: 5000 }).then(() => rec(true, 'reader closes'), () => rec(false, 'reader did not close'));
  const before = await P.evaluate(() => __rh.cur.title); await P.evaluate(() => document.getElementById('cardDig').click());
  await P.waitForFunction(b => __rh.cur.title !== b && !falling && !diving, before, { timeout: 40000 }).then(async () => rec(true, `fell into "${await P.evaluate(() => __rh.cur.title)}"; depth ${await P.evaluate(() => __rh.stack.length)}`), () => rec(false, 'did not fall into the next world'));
});

/* 4. papers: tile, in-app paper page, cited by, links */
await test('4 research papers', async () => {
  await P.goto(BASE + '?w=Photosynthesis&l=en'); await P.waitForFunction(() => window.__rh && __rh.cur && __rh.cur.status === 'ready' && Array.isArray(__rh.cur.papers), null, { timeout: 90000 }); await settle(P);
  const info = await P.evaluate(() => ({ n: __rh.cur.papers.length, reviews: __rh.cur.papers.filter(p => p.review).length, first: __rh.cur.papers[0] && __rh.cur.papers[0].title }));
  yes(info.n >= 6, `papers for Photosynthesis: ${info.n} (${info.reviews} reviews), first: ${info.first}`);
  const o = await orbXY(P, it => it.paper && it.paper !== 'slot'); yes(o, 'a paper orb is on screen'); if (!o) return;
  await P.mouse.click(o.x, o.y); await P.waitForFunction(() => document.querySelector('#card .k').textContent.length && document.getElementById('card').classList.contains('on') && document.querySelector('#card .badges span'), null, { timeout: 10000 });
  const tile = await P.evaluate(() => ({ k: document.querySelector('#card .k').textContent, chips: [...document.querySelectorAll('#card .badges span')].map(s => s.textContent), abs: document.querySelector('#card p').textContent.length, main: document.getElementById('cardWiki').textContent, alt: document.getElementById('cardAlt').textContent + ' -> ' + document.getElementById('cardAlt').getAttribute('href').slice(0, 40) }));
  yes(tile.abs > 100 && /paper/i.test(tile.k), `paper tile: "${tile.k}", abstract ${tile.abs} chars, chips: ${tile.chips.join(' / ')}`); yes(/read the paper/.test(tile.main), `main button says "${tile.main}"; second: ${tile.alt}`);
  await P.click('#cardWiki'); await P.waitForFunction(() => reader.dataset.kind === 'paper' && document.querySelector('#reader article h1'), null, { timeout: 15000 });
  await P.waitForFunction(() => document.querySelectorAll('#reader .relbox li').length > 0, null, { timeout: 25000 }).then(() => rec(true, 'cited-by and references load'), () => rec(false, 'cited-by and references did not load'));
  const pg = await P.evaluate(() => ({ h2: [...document.querySelectorAll('#reader article h2')].map(h => h.textContent), ways: [...document.querySelectorAll('#reader ul.ways a')].map(a => a.textContent), bad: [...document.querySelectorAll('#reader article a[href]')].filter(a => !/^https?:/.test(a.href) && !a.hasAttribute('data-t') && a.getAttribute('href') !== '#' ).length }));
  yes(pg.h2.includes('Abstract') && pg.ways.some(w => /OpenAlex/.test(w)), 'paper page sections: ' + pg.h2.join(', ') + ' | links: ' + pg.ways.join(', '));
  const rel = await P.$('#reader .relbox li a'); if (rel){ await rel.click(); await P.waitForFunction(() => !document.querySelector('#reader .prev').hidden, null, { timeout: 15000 }); await P.click('#reader .prev'); await P.waitForFunction(() => document.querySelector('#reader .prev').hidden, null, { timeout: 8000 }).then(() => rec(true, 'a related paper opens here and the back arrow returns'), () => rec(false, 'back arrow did not return')); }
  await P.click('#reader .home');
});

/* 5. notebook: pin, folders, picker, search, own notes, outline, citations, export, saved across a reload */
await test('5 notebook', async () => {
  await P.evaluate(() => { localStorage.removeItem('rh-notebook'); });
  await P.goto(BASE + '?w=Octopus&l=en'); await P.waitForFunction(() => window.__rh && __rh.cur && __rh.cur.status === 'ready', null, { timeout: 90000 }); await settle(P);
  const o = await orbXY(P, it => !it.paper && it.thumb); await P.mouse.click(o.x, o.y); await P.waitForFunction(() => document.getElementById('card').classList.contains('on') && document.querySelector('#card p').textContent.length > 40, null, { timeout: 15000 });
  await P.evaluate(() => { const p = document.querySelector('#card p'), r = document.createRange(); r.setStart(p.firstChild, 0); r.setEnd(p.firstChild, 45); getSelection().removeAllRanges(); getSelection().addRange(r); });
  await P.click('#cardPin'); await P.waitForSelector('.nbpick', { timeout: 5000 }); yes(true, 'folder picker opens from "Add to notebook"');
  await P.fill('.nbpick .newf input', 'Octopus research'); await P.click('.nbpick .newf button'); await P.waitForFunction(() => NB.items.length === 1, null, { timeout: 5000 });
  const st = await P.evaluate(() => ({ f: nbFolderName(nbFolder(NB.items[0].folder)), q: NB.items[0].quote, trail: NB.items[0].trail, folders: NB.folders.map(nbFolderName), badge: document.querySelector('#nbBtn .bdg').textContent }));
  yes(st.f === 'Octopus research' && st.q.length > 20, `pinned into a new folder with the selected passage; folders: ${st.folders.join(', ')}; badge ${st.badge}`);
  await P.click('#nbBtn'); await P.waitForFunction(() => document.getElementById('nb').classList.contains('on'), null, { timeout: 5000 });
  const tabs = await P.evaluate(() => [...document.querySelectorAll('#nb .tabs button')].map(b => b.textContent)); yes(tabs.includes('All') && tabs.includes('Octopus research'), 'folder tabs: ' + tabs.join(' | '));
  // own note and own link
  await P.click('#nb .addown'); await P.fill('#nb .o-title', 'Plan'); await P.fill('#nb .o-text', 'Read the Fiorito papers first.'); await P.click('#nb .addbox button[type=submit]');
  await P.click('#nb .addown'); await P.fill('#nb .o-title', 'A useful page'); await P.fill('#nb .o-link', 'example.org/octopus'); await P.fill('#nb .o-text', 'Notes on tool use.'); await P.click('#nb .addbox button[type=submit]');
  const kinds = await P.evaluate(() => NB.items.map(i => i.kind)); yes(kinds.includes('note') && kinds.includes('web'), 'own note and own link saved: ' + kinds.join(', '));
  // typing with spaces and shortcut letters in a note must not touch the world
  const ta = await P.$('#nb .item textarea'); await ta.click(); const z0 = await P.evaluate(() => __rh.cam.s + '|' + falling); await P.keyboard.type('we see eight arms and q e w s');
  const typed = await P.evaluate(() => document.activeElement.value), z1 = await P.evaluate(() => __rh.cam.s + '|' + falling); yes(/we see eight arms and q e w s/.test(typed) && z0 === z1, `typing keeps its spaces and does not move the world ("${typed.slice(0, 40)}")`);
  // search and filter
  await P.fill('#nb .find', 'tool'); const found = await P.evaluate(() => [...document.querySelectorAll('#nb .item h3')].map(h => h.textContent)); yes(found.length === 1 && /useful/i.test(found[0]), 'search "tool": ' + found.join(', ')); await P.fill('#nb .find', '');
  // outline
  await P.evaluate(() => { document.querySelector('#nb .outline').open = true; }); await P.fill('#nb .draft', '1. Arms\n2. Hearts'); eq(await P.evaluate(() => nbFolder(NB.active).draft), '1. Arms\n2. Hearts', 'outline saved to the folder');
  // citations
  const refs = await P.evaluate(() => ['apa', 'mla', 'harvard'].map(s => nbRefs(s).map(nbPlain))); yes(refs.every(r => r.length === 2) && /example\.org/.test(refs[0].join()) && /Wikipedia/.test(refs[1].join()), `references in three styles (own note excluded, web page and Wikipedia cited): ${refs[0].length} each`);
  const doc = await P.evaluate(() => nbDocHtml(false)); yes(/Plan/.test(doc) && /Hearts/.test(doc) && /References/.test(doc), 'exported document has notes, outline and references');
  await P.click('#nb .citetoggle'); yes(await P.evaluate(() => !document.querySelector('#nb .citepanel').hidden), 'cite and export row opens');
  const dl = P.waitForEvent('download', { timeout: 8000 }).catch(() => null); await P.click('#nb .word'); const d = await dl; yes(d && /\.doc$/.test(d.suggestedFilename()), 'Word export downloads: ' + (d && d.suggestedFilename()));
  await P.click('#nb .copyrefs'); await sleep(400); const cl1 = await P.evaluate(() => document.querySelector('#nb .copyrefs').textContent); yes(/✓/.test(cl1), 'copy references: button says "' + cl1 + '"'); await sleep(1700);
  await P.click('#nb .copydoc'); await sleep(400); const cl2 = await P.evaluate(() => document.querySelector('#nb .copydoc').textContent); yes(/✓/.test(cl2), 'copy for Google Docs: button says "' + cl2 + '"');
  await P.click('#nb .widebtn'); yes(await P.evaluate(() => document.getElementById('nb').offsetWidth > 700), 'wide mode'); await P.click('#nb .widebtn');
  // survives a reload
  await P.goto(BASE + '?w=Octopus&l=en'); await P.waitForFunction(() => window.__rh && __rh.cur && __rh.cur.status === 'ready', null, { timeout: 90000 }); const after = await P.evaluate(() => ({ n: NB.items.length, f: NB.folders.length, badge: document.querySelector('#nbBtn .bdg').textContent })); yes(after.n === 3 && after.f === 2, `notebook kept across a reload: ${after.n} items, ${after.f} folders`);
  // an old (version 1) notebook becomes the first folder
  const old = await desk.newPage(); await old.addInitScript(() => { if (!localStorage.getItem('rh-notebook')) localStorage.setItem('rh-notebook', JSON.stringify({ v: 1, q: 'Old question', style: 'mla', items: [{ id: 'z', at: 1, kind: 'article', lang: 'en', title: 'Old', url: 'u', quote: '', note: '', question: '', trail: [] }] })); });
  await P.evaluate(() => { localStorage.removeItem('rh-notebook'); });
  await old.goto(BASE + '?w=Octopus&l=en'); await old.waitForFunction(() => window.__rh && __rh.cur && __rh.cur.status === 'ready', null, { timeout: 90000 });
  const mig = await old.evaluate(() => ({ folders: NB.folders.length, q: NB.folders[0].q, f: NB.items[0].folder, style: NB.style })); yes(mig.folders === 1 && mig.q === 'Old question' && mig.style === 'mla', 'old notebook migrates into the first folder: ' + JSON.stringify(mig)); await old.close();
});

/* 6. keyboard shortcuts still work outside text boxes */
await test('6 keyboard', async () => {
  await P.goto(BASE + '?w=Octopus&l=en'); await P.waitForFunction(() => window.__rh && __rh.cur && __rh.cur.status === 'ready', null, { timeout: 90000 });
  await P.mouse.move(640, 400); await P.keyboard.press('Space'); await sleep(300); const f = await P.evaluate(() => falling); yes(f, 'space starts a fall on the world'); await P.keyboard.press('Space'); await sleep(200);
  const s0 = await P.evaluate(() => __rh.cam.s); await P.keyboard.down('w'); await sleep(500); await P.keyboard.up('w'); const s1 = await P.evaluate(() => __rh.cam.s); yes(s1 > s0, `W zooms in (${s0.toFixed(3)} -> ${s1.toFixed(3)})`);
});

/* 7. search and dice */
await test('7 search and dice', async () => {
  await P.goto(BASE + '?w=Octopus&l=en'); await P.waitForFunction(() => window.__rh && __rh.cur && __rh.cur.status === 'ready', null, { timeout: 90000 });
  await P.click('#seekBtn'); await P.type('#seek', 'Mount Everest', { delay: 30 }); await P.waitForSelector('#found.on li button', { timeout: 15000 }); const sug = await P.evaluate(() => [...document.querySelectorAll('#found li button')].map(b => b.firstChild.textContent));
  yes(sug.length > 0 && sug.some(s => /Everest/.test(s)), 'search suggestions: ' + sug.slice(0, 4).join(', ')); await P.click('#found li button');
  await P.waitForFunction(() => __rh.cur.title === 'Mount Everest' && !document.getElementById('enter').classList.contains('on'), null, { timeout: 60000 }).then(() => rec(true, 'search opens the world and clears the entering screen'), () => rec(false, 'search did not open the world'));
  const t0 = await P.evaluate(() => __rh.cur.title); await P.click('#dice'); await P.waitForFunction(t => __rh.cur.title !== t && !document.getElementById('enter').classList.contains('on'), t0, { timeout: 60000 }).then(async () => rec(true, `dice opened "${await P.evaluate(() => __rh.cur.title)}"`), () => rec(false, 'dice did not open a new world'));
});

/* 8. the game: normal round to a win, mystery, timed, give up, share text, streak, challenge link, daily */
await test('8 game', async () => {
  await P.goto(BASE + '?w=Octopus&l=en'); await P.waitForFunction(() => window.__rh && __rh.cur && __rh.cur.status === 'ready', null, { timeout: 90000 });
  const play = async () => P.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms)); startPlay(); const steps = [];
    for (let k = 1; k < game.route.length && !game.over; k++){ const want = game.route[k].title, T = cur, i = T.items.findIndex(it => it.title === want); if (i < 0){ steps.push('missing ' + want); break; }
      __rh.choose({ T, i, it: T.items[i] }); await sleep(700); document.getElementById('cardDig').click(); const t1 = Date.now(); while (cur.title !== want && Date.now() - t1 < 25000) await sleep(200); steps.push(cur.title === want); await sleep(500); }
    return { steps, over: game.over, how: game.how, used: game.used, par: game.par }; });
  await P.evaluate(() => { game.level = 2; game.style = { mystery: false, timed: false }; startGame(); }); await P.waitForFunction(() => game.on && game.route && cur === game.start && document.getElementById('card').classList.contains('on'), null, { timeout: 90000 }); await sleep(1500);
  const info = await P.evaluate(() => ({ start: game.start.title, goal: game.goal.title, par: game.par, cardPin: document.getElementById('cardPin').offsetParent !== null, link: document.getElementById('cardLink').offsetParent !== null })); yes(info.goal && info.par >= 2, `normal game started: ${info.start} to ${info.goal}, par ${info.par}`); yes(!info.cardPin && !info.link, 'notebook pin and link buttons are hidden during a game');
  const r = await play(); yes(r.over && r.how === 'win' && r.steps.every(Boolean), `played the route to a win in ${r.used} worlds`);
  const txt = await P.evaluate(() => resultText()); yes(/Beat me: https:\/\/.*\?s=.*&g=/.test(txt) && /Rabbit Hole/.test(txt), 'share text carries a challenge link'); const ch = await P.evaluate(() => challengeUrl()); yes(/[?&]b=\d+/.test(ch), 'challenge link includes the score to beat: ' + ch.slice(-48));
  await P.evaluate(() => { exitGame(); });
  // mystery + timed together
  await P.evaluate(() => { game.level = 2; game.style = { mystery: true, timed: true }; startGame(); }); await P.waitForFunction(() => game.on && game.route && cur === game.start, null, { timeout: 90000 }); await sleep(2500);
  const my = await P.evaluate(() => ({ clue: game.clue, timed: game.timed, limit: game.limit, hud: !document.getElementById('hud').hidden })); yes(my.clue && my.timed && my.limit > 0, `mystery and timed modes on (limit ${my.limit}s)`);
  await P.evaluate(() => { startPlay(); }); await sleep(2500); const left1 = await P.evaluate(() => document.querySelector('#hudTime b').textContent); await sleep(2500); const left2 = await P.evaluate(() => document.querySelector('#hudTime b').textContent); yes(left1 !== left2, `the clock counts down (${left1} -> ${left2})`);
  await P.evaluate(() => { endGame('gave'); }); const lose = await P.evaluate(() => ({ over: game.over, how: game.how, card: document.getElementById('result').classList.contains('on') })); yes(lose.over && lose.card, 'give up shows the result card'); await P.evaluate(() => { exitGame(); });
  // challenge link
  const c2 = await openPage(desk, BASE + '?s=Lego&g=Ferrari&d=2&b=3&l=en', 'none'); await c2.waitForFunction(() => typeof game !== 'undefined' && game.on, null, { timeout: 90000 }).then(() => rec(true, 'challenge link starts a game'), () => rec(false, 'challenge link did not start a game'));
  await c2.waitForFunction(() => cur === game.start && document.querySelector('#card .k').textContent.length > 3, null, { timeout: 60000 }).catch(() => {}); const cs = await c2.evaluate(() => ({ s: game.start && game.start.title, g: game.goal && game.goal.title, beat: game.beat, k: document.querySelector('#card .k').textContent, url: location.search })); yes(cs.s === 'Lego' && cs.g === 'Ferrari' && cs.beat === 3 && /beat 3/.test(cs.k) && /s=Lego/.test(cs.url), `challenge: ${cs.s} to ${cs.g}, "${cs.k}", address kept`);
  await c2.close();
  // daily from the stored route; streak on a win
  const today = new Date().toISOString().slice(0, 10), file = JSON.parse(fs.readFileSync(`daily/${today}.json`, 'utf8'));
  const d2 = await openPage(desk, BASE + '?daily=1&l=en', 'none'); await d2.waitForFunction(() => typeof game !== 'undefined' && game.on && game.daily && game.route && cur === game.start, null, { timeout: 120000 }); await sleep(2000);
  const dr = await d2.evaluate(() => game.route.map(T => T.title)); yes(JSON.stringify(dr) === JSON.stringify(file.route), `today's challenge uses the published route (${dr[0]} to ${dr[dr.length - 1]})`);
  await d2.evaluate(() => { localStorage.removeItem('rh-streak'); }); const rr = await d2.evaluate(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); startPlay(); for (let k = 1; k < game.route.length && !game.over; k++){ const want = game.route[k].title, T = cur, i = T.items.findIndex(it => it.title === want); if (i < 0) return 'missing ' + want; __rh.choose({ T, i, it: T.items[i] }); await sleep(700); document.getElementById('cardDig').click(); const t1 = Date.now(); while (cur.title !== want && Date.now() - t1 < 25000) await sleep(200); await sleep(500); } return { over: game.over, how: game.how }; });
  yes(rr && rr.how === 'win', 'played the daily route to a win'); const sk = await d2.evaluate(() => JSON.parse(localStorage.getItem('rh-streak') || 'null')); yes(sk && sk.n === 1 && sk.last === today, 'daily streak recorded: ' + JSON.stringify(sk)); const dtxt = await d2.evaluate(() => resultText()); yes(/daily/.test(dtxt) && /\?daily=1/.test(dtxt), 'daily share text links to today\'s challenge');
  await d2.close();
});

/* 8b. the first-visit experience: intro, the "What is" card, tutorial, game panel, feedback form */
await test('8b first visit and panels', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const F = await openPage(ctx, BASE, 'none');
  await F.waitForFunction(() => document.body.classList.contains('introplay') || document.getElementById('about').classList.contains('on'), null, { timeout: 30000 }).then(() => rec(true, 'the intro starts on a plain visit'), () => rec(false, 'no intro and no About card on a plain visit'));
  await F.waitForFunction(() => document.getElementById('about').classList.contains('on'), null, { timeout: 60000 }).then(() => rec(true, 'the "What is Rabbit Hole" card follows the intro'), () => rec(false, 'the About card never appeared'));
  const ab = await F.evaluate(() => ({ choices: [...document.querySelectorAll('#about .choices button, #about button')].filter(b => b.offsetParent).map(b => b.textContent.trim()).filter(Boolean).slice(0, 8), build: document.querySelector('.build').textContent })); yes(ab.choices.length >= 3, 'About card buttons: ' + ab.choices.join(' | '));
  const tut = await F.$('#aboutTour'); if (tut){ await tut.click(); await F.waitForFunction(() => !document.getElementById('tour').classList.contains('gone'), null, { timeout: 15000 }).then(() => rec(true, 'the tutorial starts'), () => rec(false, 'the tutorial did not start')); await F.evaluate(() => endTour()); await sleep(500); } else rec(false, 'no tutorial button on the About card');
  await F.evaluate(() => { document.getElementById('about').classList.remove('on'); document.body.classList.remove('onboard'); }); await F.click('#gameBtn'); await F.waitForFunction(() => document.getElementById('rules').classList.contains('on'), null, { timeout: 8000 }).then(() => rec(true, 'game panel opens'), () => rec(false, 'game panel did not open'));
  const gp = await F.evaluate(() => ({ slider: !!document.getElementById('depth'), levels: document.querySelector('#rules .dstat') && document.querySelector('#rules .dstat').textContent, daily: document.getElementById('daily').textContent, styles: [...document.querySelectorAll('#rules .styles button')].map(b => b.textContent.trim()) })); yes(gp.slider && gp.styles.length === 3, `game panel: slider, styles ${gp.styles.join('/')}, daily button "${gp.daily}"`);
  await F.evaluate(() => document.getElementById('rulesClose').click());
  await F.evaluate(() => { document.getElementById('helpBtn').click(); }); await sleep(600); const fb = await F.evaluate(() => { const a = document.getElementById('aboutFeedback'); return a && !a.hidden; }); yes(fb, 'the feedback link is on the About card');
  await ctx.close();
});

/* 9. languages */
await test('9 languages', async () => {
  const langs = ['es', 'fr', 'de', 'pt', 'it', 'ja'];
  for (const l of langs){ const pg = await openPage(desk, BASE + `?w=Octopus&l=${l}`, 'none'); try { await pg.waitForFunction(() => window.__rh && __rh.cur && __rh.cur.status === 'ready', null, { timeout: 90000 }); const r = await pg.evaluate(() => ({ lang: LANG, title: __rh.cur.title, search: document.getElementById('seek').placeholder, nbTitle: document.querySelector('#nb h2').textContent, n: __rh.cur.items.length })); yes(r.lang === l && r.n > 8, `${l}: world "${r.title}" (${r.n} orbs), search "${r.search}", notebook "${r.nbTitle}"`); } catch (e) { rec(false, `${l}: ${e.message.split('\n')[0]}`); } await pg.close(); await sleep(1500); }
});

/* 10. a phone: touch taps, the notebook sheet and the picker on screen */
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, permissions: ['clipboard-read', 'clipboard-write'] });
await test('10 phone', async () => {
  const M = await openPage(phone, BASE + '?w=Octopus&l=en'); await M.waitForFunction(() => __rh.cur.items.filter(i => i.img === 'done').length > 20, null, { timeout: 40000 }).catch(() => {}); const o = await orbXY(M, it => !it.paper && it.thumb); yes(o, 'an orb is on screen at phone size'); if (!o) return;
  await M.touchscreen.tap(o.x, o.y); await M.waitForFunction(() => document.getElementById('card').classList.contains('on') && document.querySelector('#card p').textContent.length > 40, null, { timeout: 15000 }).then(() => rec(true, 'a touch tap opens the tile'), () => rec(false, 'a touch tap did not open the tile'));
  const fits = await M.evaluate(() => { const r = document.getElementById('card').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }); yes(fits, 'tile fits the phone screen');
  await M.evaluate(() => { localStorage.removeItem('rh-notebook'); }); await M.tap('#cardPin'); await M.waitForSelector('.nbpick', { timeout: 5000 });
  const inView = await M.evaluate(() => { const r = document.querySelector('.nbpick').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }); yes(inView, 'folder picker is fully on screen');
  await M.tap('.nbpick button'); await M.waitForFunction(() => NB.items.length === 1, null, { timeout: 5000 }); await M.tap('#nbBtn'); await M.waitForFunction(() => document.getElementById('nb').classList.contains('on'), null, { timeout: 5000 });
  const sheet = await M.evaluate(() => { const r = document.getElementById('nb').getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; }); yes(sheet.w >= 389 && sheet.top > 100, `notebook is a pull-up sheet (${sheet.w}x${sheet.h}, top ${sheet.top})`);
  await M.evaluate(() => { localStorage.removeItem('rh-notebook'); }); await M.close();
});

await browser.close();

/* the Android project, files on disk */
await test('11 android project and build script', async () => {
  const cfg = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8')); yes(cfg.appId && cfg.webDir === 'www', `capacitor config: ${cfg.appId}, web folder "${cfg.webDir}"`);
  yes(fs.existsSync('android/app/src/main/AndroidManifest.xml') && fs.existsSync('android/gradlew'), 'android project present'); yes(fs.existsSync('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'), 'launcher icons present');
  const { execFileSync } = await import('node:child_process'); execFileSync('node', ['tools/build_www.mjs'], { stdio: 'pipe' }); const w = fs.readdirSync('www'); yes(['index.html', 'js', 'css', 'icons', 'sounds'].every(x => w.includes(x)) && !w.some(x => /docx|OPEN|launch|daily/i.test(x)), 'www build contains only app files: ' + w.join(', '));
});

const ok = results.filter(r => r.ok).length;
console.log('\n=== RESULTS: ' + ok + ' of ' + results.length + ' checks passed ===');
for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.name + '] ' + r.note);
const uniq = [...new Set(errors)]; console.log('\nbrowser errors seen: ' + (uniq.length ? '\n  ' + uniq.join('\n  ') : 'none'));
fs.writeFileSync('qa-report.json', JSON.stringify({ at: new Date().toISOString(), base: BASE, passed: ok, total: results.length, results, errors: uniq }, null, 1));
process.exit(ok === results.length ? 0 : 1);

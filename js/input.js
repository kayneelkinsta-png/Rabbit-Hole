'use strict';
/* ─────────── input: scroll or pinch falls toward the one point; drag spins the world round it ─────────── */
const ptrs = new Map(); let downAt = null, moveSum = 0, pinch = null;
cv.addEventListener('wheel', e => { e.preventDefault(); stopFall(); cam.s *= Math.exp(-e.deltaY * (e.deltaMode ? .05 : e.ctrlKey ? .012 : .0016)); if (e.deltaY < 0 && cur && !nextOf(cur)) nudge(); else if (e.deltaY < 0 && cur && cur.box && rabbit.state === 'wander') rabbitJump(); }, { passive: false });
// scrolling into a hole that leads nowhere yet points you at what to do
let nudgeT = -1e9;
function nudge(){
  const now = performance.now(); if (now - nudgeT < 2500) return; nudgeT = now;
  if (cur.box && !game.on){ hideFront(); const w = $('#seekWrap'); w.classList.remove('nudge'); void w.offsetWidth; w.classList.add('nudge'); openSeek(); }
}
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2){ const [p1, p2] = [...ptrs.values()]; pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), ang: Math.atan2(p2.y - p1.y, p2.x - p1.x), mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2 }; } if (ptrs.size === 1){ downAt = { x: e.clientX, y: e.clientY }; moveSum = 0; holdDir = e.button === 2 || e.shiftKey ? -1 : 1; panDrag = !(e.button === 2 || e.shiftKey); clearTimeout(holdT); holdT = setTimeout(() => { if (moveSum < 6 && ptrs.size === 1){ holding = true; tip.classList.remove('on'); } }, 260); } stopFall(); cv.classList.add('drag'); });
cv.addEventListener('pointermove', e => {
  const prev = ptrs.get(e.pointerId); if (!prev){ hover(e); return; }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); tip.classList.remove('on');
  if (ptrs.size === 1){ if (holding) return; moveSum += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y); if (moveSum > 5 && panDrag){ clearTimeout(holdT); lookAround(e.clientX - prev.x, e.clientY - prev.y); } else if (moveSum > 5){ const a0 = Math.atan2(prev.y - CY, prev.x - CX), a1 = Math.atan2(e.clientY - CY, e.clientX - CX); let da = a1 - a0; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; cam.phi -= da; spinGoal = cam.phi; } }
  else if (ptrs.size === 2){ moveSum = 99; if (!pinchRaf) pinchRaf = requestAnimationFrame(applyPinch); }
});
let lastPointer = { x: innerWidth / 2, y: innerHeight / 2 };
let holding = false, holdT = 0, holdV = 0, holdDir = 1;
cv.addEventListener('contextmenu', e => e.preventDefault());
let pinchRaf = 0;
function applyPinch(){
  pinchRaf = 0; if (ptrs.size !== 2) return;
  const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  if (pinch){ cam.s *= d / pinch.d; cam.phi -= ang - pinch.ang; spinGoal = cam.phi; }
  pinch = { d, ang, mx, my };
}
function endPtr(e){ if (pinchRaf && ptrs.size === 2 && ptrs.has(e.pointerId)){ cancelAnimationFrame(pinchRaf); applyPinch(); }   // a finger lifting: don't lose the last bit of movement
  if (!ptrs.delete(e.pointerId)) return; if (ptrs.size < 2) pinch = null; if (!ptrs.size) panDrag = false; if (!ptrs.size){ clearTimeout(holdT); const held = holding; holding = false; cv.classList.remove('drag'); if (!held && moveSum < 6 && e.type === 'pointerup'){ lastPointer = { x: e.clientX, y: e.clientY }; const h = hit(e.clientX, e.clientY); if (h) choose(h); } } }
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('pointerleave', () => { tip.classList.remove('on'); hovered = null; cv.classList.remove('over'); });
const held = new Set();
addEventListener('keydown', e => { if (e.target.matches('input')) return; if (e.key === ' '){ e.preventDefault(); $('#fall').click(); } else if (e.key === 'Escape') card.classList.remove('on'); else held.add(e.key.toLowerCase()); });
addEventListener('keyup', e => held.delete(e.key.toLowerCase()));
function stopFall(){ falling = false; $('#fall').classList.remove('on'); }
$('#fall').onclick = () => { falling = !falling; $('#fall').classList.toggle('on', falling); };
setTheme('glass');
$('#up').onclick = () => { if (!payToClimb()) return; if (stack.length){ cur = stack.pop(); cam.s = fitS(); moved(); } else cam.s = fitS(); };

/* start anywhere, like the Wikipedia game */
const seek = $('#seek'), found = $('#found'); let seekT = 0, seekTok = 0;
seek.addEventListener('input', () => { clearTimeout(seekT); const v = seek.value.trim(); if (!v){ found.classList.remove('on'); return; } seekT = setTimeout(async () => { const tok = ++seekTok; const j = await q({ action: 'opensearch', search: v, limit: '8', namespace: '0' }).catch(() => null); if (tok !== seekTok || !j) return; found.replaceChildren(...j[1].map((t, i) => { const li = document.createElement('li'), b = document.createElement('button'); b.textContent = t; if (j[2][i]){ const sm = document.createElement('small'); sm.textContent = j[2][i]; b.append(sm); } b.onclick = () => enterWorld(t); li.append(b); return li; })); found.classList.toggle('on', j[1].length > 0); }, 180); });
seek.addEventListener('keydown', e => { if (e.key === 'Enter' && seek.value.trim()){ track('search'); enterWorld(seek.value.trim()); } });
seek.addEventListener('blur', () => setTimeout(() => found.classList.remove('on'), 150));
// searching starts afresh: the topic you asked for becomes your first world
let enterTok = 0;
async function enterWorld(title, withTile = false){
  if (game.on) return;
  const tok = ++enterTok, E = $('#enter');
  hideFront(); found.classList.remove('on'); seek.value = ''; seek.blur(); $('#seekWrap').classList.remove('open'); card.classList.remove('on'); closeReader();
  E.querySelector('h2').textContent = title; E.querySelector('.d').textContent = ''; E.querySelector('.st').textContent = t('finding');
  const img = E.querySelector('img'); img.removeAttribute('src');
  E.classList.remove('gone', 'out', 'ready'); requestAnimationFrame(() => E.classList.add('on'));
  summary(title).then(sm => { if (tok !== enterTok || !sm) return; E.querySelector('h2').textContent = sm.title; E.querySelector('.d').textContent = sm.description || ''; if (sm.thumbnail) img.src = sm.thumbnail.source; }).catch(() => {});
  const T = topic(title); digNow(T);
  const t0 = performance.now();
  await new Promise(res => { const w = setInterval(() => { if (T.status === 'ready' || performance.now() - t0 > 25000){ clearInterval(w); res(); } }, 120); });
  if (tok !== enterTok) return;
  if (T.status !== 'ready' || !T.items.length){ E.querySelector('.st').textContent = t('cantOpen'); setTimeout(() => { if (tok === enterTok){ E.classList.remove('on'); setTimeout(() => E.classList.add('gone'), 450); } }, 2200); return; }
  E.classList.add('ready'); E.querySelector('.st').textContent = t('orbs', { n: T.items.length }); primeImgs(T);
  await new Promise(r => setTimeout(r, 650));
  if (tok !== enterTok) return;
  for (const X of TOPICS.values()){ X.next = 0; X.jump = null; X.chosen = false; }
  stack = []; cur = T; cam.s = fitS() * .8; cam.phi = spinGoal = 0; falling = diving = false; $('#fall').classList.remove('on');
  want(nextOf(cur)); moved();
  E.classList.add('out'); SFX.enter();
  // the world grows in from behind the card
  const s0 = performance.now(), grow = () => { const u = Math.min(1, (performance.now() - s0) / 900); cam.s = fitS() * (.8 + .2 * (1 - Math.pow(1 - u, 3))); if (u < 1) requestAnimationFrame(grow); };
  grow();
  setTimeout(() => { E.classList.remove('on', 'out', 'ready'); E.classList.add('gone'); if (withTile) openCard(cur.title, t('randomWorld')); arrive(cur); }, 750);
}
function start(title){ if (game.on) return; hideFront(); found.classList.remove('on'); seek.value = ''; seek.blur(); const T = topic(title); cur.jump = T; want(T); beginDive(); $('#fall').classList.add('on'); card.classList.remove('on'); showNow(); }

const ready = T => new Promise(res => { want(T); const t = setInterval(() => { if (T.status === 'ready'){ clearInterval(t); res(T); } }, 120); });
// most-read first: page views over the last month, for up to 50 links in one request
async function byReaders(items){
  if (!items.length) return [];
  const j = await q({ action: 'query', prop: 'pageviews', pvipdays: '30', titles: items.map(it => it.title).join('|') }).catch(() => null);
  const views = {}; ((j && j.query && j.query.pages) || []).forEach(p => views[p.title] = Object.values(p.pageviews || {}).reduce((a, b) => a + (b || 0), 0));
  return items.slice().sort((a, b) => (views[b.title] || 0) - (views[a.title] || 0));
}
// dry, abstract topics make joyless goals and dull stepping stones, so rounds never use them
const DRY_TITLE = /^(Gross domestic product|Gross national (income|product)|Nominal GDP|Real GDP|Metropolitan statistical area|Combined statistical area|Census|Population|Demographics?( of .*)?|Economy of .*|Politics of .*|Geography of .*|Government of .*|Administrative divisions? of .*|Municipality|Municipalities of .*|County seat|Unincorporated area|Census-designated place|Time zone|Coordinated Universal Time|Daylight saving time|ISO \d+.*|Postal code|Area code|Telephone numbering plan|Latitude|Longitude|Human Development Index|Gini coefficient|Sovereign state|Member state.*|Official language|Currency|Constitution( of .*)?|Parliament( of .*)?|Legislature|Unitary state|Federal republic|Parliamentary system|Presidential system|Purchasing power parity|Per capita|Fiscal year|Tax|Taxation|Inflation|Interest rate|Unemployment|Standard of living|Life expectancy|Literacy|Ethnic group|Religion in .*|Local government|Metric system|International System of Units|SI units?|Developed country|Developing country|Statistics)$/i;
const DRY_DESC = /\b(economic (indicator|measure|concept)|monetary measure|statistic(s|al)?|census|administrative (division|unit|region|area)|unit of (measurement|length|mass|area|time)|measure of|legal (term|concept|document)|type of (local|administrative|government|political)|form of government|political (system|concept|term)|classification|terminology|accounting|financial (term|concept)|taxation|coordinate system|time (standard|zone)|legislat\w*|jurisdiction|demograph\w*|abstract concept|academic discipline|field of study|branch of|sociocultural|geopolitical|mathematical (constant|concept|term))\b/i;
const isDry = it => DRY_TITLE.test(it.title) || DRY_DESC.test(it.desc || '');
// explorer: every stop is something a 7 to 10 year old can picture, nothing grim, nothing long-winded
const KID_KINDS = new Set(['nature', 'food', 'work', 'vehicle', 'sky', 'water']);
const KID_NO = /\b(wars?|battles?|weapons?|guns?|firearms?|rifles?|bombs?|missiles?|army|military|soldiers?|murder\w*|kill\w*|deaths?|dead|died|diseases?|cancer|virus\w*|infection\w*|drugs?|alcohol\w*|beer|wine|whisk(e)?y|vodka|cocktails?|liquor|tobacco|cigarettes?|smoking|sex\w*|crimes?|criminal\w*|terror\w*|genocide|slave\w*|nazi\w*|execution\w*|prisons?|tortur\w*|politic\w*|religio\w*|church\w*|deit(y|ies)|gods?|abortion|suicide|poison\w*|pornograph\w*|gambling|casinos?|violen\w*|horror|slaughter\w*|parasit\w*)\b/i;
const KID_SCI = /\b(anatom\w*|physiolog\w*|reproduct\w*|taxonom\w*|genetic\w*|evolution\w*|biolog\w*|botan\w*|zoolog\w*|morpholog\w*|clade|hybrid|ecolog\w*|chemi\w*|compounds?|molecul\w*|proteins?|enzymes?|cells?|tissues?|organisms?|tectonic|geolog\w*|crust|hotspot|sediment\w*|minerals?|genre|registry|awards?|selection of|list of|industry|history of|culture of)\b/i;
const kidOK = it => { const s = it.title + ' ' + (it.desc || ''); return !KID_NO.test(s) && !KID_SCI.test(s) && it.title.length <= 26 && !/\d{3,}/.test(it.title); };
// one particular thing (a lion, a mango, a film), never a grouping ("flowering plant", "family of sharks") or a body part
const KID_ABSTRACT = /\b(clade|taxon\w*|class|order|family|genus|group|kingdom|phylum|subfamily|superfamily|tribe|type of|kind of|category|branch of|study of|process|concept|term for|structure|spines?|bones?|limbs?|fins?|organs?|muscles?|anatomy|behaviou?r\w*|form of|practice|method|technique|system|movement|management|conservation|relocation|reintroduction|policy|role|status|effect|theory|hypothesis|phenomenon|strategy)\b/i;
const kidStop = it => kidOK(it) && KID_KINDS.has(it.kind) && KID_THING.test(it.title + ' ' + (it.desc || '')) && !KID_ABSTRACT.test(it.desc || '') && !/(idae|inae|iformes|oidea|aceae|ales)$/.test(it.title) && (!/(ation|ism|ology|ment)$/i.test(it.title) || /^carnation$/i.test(it.title));
// every stop must plainly be one of the things young players know
const KID_THING = /\b(fruits?|vegetables?|berr(y|ies)|nuts?|dish|dessert|food|snacks?|sweets?|cakes?|bread|cheese|drinks?|beverage|spices?|herbs?|breeds?|dogs?|cats?|horses?|animals?|mammals?|birds?|fish|sharks?|whales?|dolphins?|insects?|butterfl(y|ies)|bees?|reptiles?|snakes?|lizards?|frogs?|dinosaurs?|bears?|monkeys?|apes?|penguins?|owls?|parrots?|films?|animated|cartoons?|books?|novels?|toys?|games?|characters?|franchise|vehicles?|cars?|trains?|aircraft|boats?|ships?|rockets?|planets?|moons?|volcano(es)?|mountains?|waterfalls?|islands?|oceans?)\b/i;
// every round is built by walking real links from the start, so there is always a way through
const dayKey = () => new Date().toISOString().slice(0, 10);
const SITE = 'https://kayneelkinsta-png.github.io/Rabbit-Hole/';   // where shared results send people
const FEEDBACK_URL = 'https://tally.so/r/9qbDLX';   // Kayne's feedback form (Tally); empty hides the link on the "What is" card
const GOAT = 'rabbithole'; // Kayne's GoatCounter code (stats at rabbithole.goatcounter.com); empty turns the counter off
// count a moment worth knowing about (never anything typed, never who): shows up as an event in GoatCounter
const track = name => { try { if (window.goatcounter && goatcounter.count) goatcounter.count({ path: name, title: name, event: true }); } catch (e) {} };
async function buildRound(cfg, rnd = Math.random, say = () => {}){
  const par = cfg.par;
  for (let attempt = 0; attempt < (cfg.kids ? 12 : 6); attempt++){
    const seeds = cfg.kids ? KIDS_L : SEEDS_L, pickS = seeds[Math.floor(rnd() * seeds.length)];
    say('populating your starting world…', pickS);
    const start = await ready(topic(pickS));
    if (start.items.length < 30){ say('that world was too small, finding another…', ''); continue; }
    say('your starting world is ' + start.name, 'hiding your goal somewhere down the rabbit hole…');
    const route = [start]; let T = start, ok = true;
    for (let k = 0; k < par && ok; k++){
      // stay among prominent, pictured, much-read links, so the route and the goal are things people recognise
      const last = k === par - 1;
      let cands = T.items.slice(0, 45).filter(it => it.desc && it.thumb && !HUBS.test(it.title) && !isDry(it) && !/^(Outline|History|Index|Timeline|Glossary|List) of/.test(it.title) && !route.some(r => r.title === it.title));
      // a goal should be a thing you can picture (an animal, a place, a dish, a person…), not an idea, when there's enough choice
      // explorer is strict: every stop is one particular, picturable thing; if a world offers none, this route is dropped and another tried
      if (cfg.kids) cands = cands.filter(kidStop);
      else if (last){ const things = cands.filter(it => it.kind !== 'idea'); if (things.length >= 4) cands = things; }
      // young players get the best-known of those; everyone else a wider pick
      const ranked = await byReaders(cands); let pool = last && cfg.rank ? ranked.slice(cfg.rank[0], cfg.rank[1]) : cfg.kids ? ranked.slice(0, last ? 4 : 6) : ranked.slice(0, last ? 5 : 10);
      if (!pool.length) pool = ranked.slice(0, 10);
      let chosen = null;
      for (let tries = 0; tries < 3 && pool.length && !chosen; tries++){
        const Tc = await ready(topic(pool.splice(Math.floor(rnd() * pool.length), 1)[0].title));
        if (last || Tc.items.length >= 20) chosen = Tc;
      }
      if (!chosen){ ok = false; break; }
      T = chosen;
      say(last ? 'your goal is hidden' : 'hiding your goal…', last ? 'somewhere ' + par + ' worlds away' : 'digging deeper, ' + (k + 1) + ' of ' + par);
      route.push(T);
    }
    if (ok && route.length === par + 1) return route;
  }
  return null;
}
// rounds are built ahead of time in the background, so pressing start is (nearly) instant
const nextRound = {};
const roundKey = (daily, level) => daily ? 'daily-' + dayKey() : level;
/* ─────────── today's challenge: the same route for everyone ─────────── */
// Routes are published as daily/<date>.json (English titles), so everyone gets the same one; if a day's file is missing, the
// route is built from today's date as a seed (the same idea, but live Wikipedia can make it differ slightly between players).
async function translateTitles(titles, code){
  const j = await getJSON('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', titles: titles.join('|'), prop: 'langlinks', lllang: code, lllimit: 'max', redirects: '1', format: 'json', formatversion: '2', origin: '*' }));
  const qy = j && j.query; if (!qy || !qy.pages) return null;
  const hop = {}; for (const r of (qy.normalized || []).concat(qy.redirects || [])) hop[r.from] = r.to;
  const to = {}; for (const p of qy.pages) if (p.langlinks && p.langlinks[0]) to[p.title] = p.langlinks[0].title;
  const out = titles.map(x => { let y = x; for (let i = 0; i < 3 && hop[y]; i++) y = hop[y]; return to[y]; });
  return out.every(Boolean) ? out : null;
}
async function dailyRoute(){
  try {
    const r = await fetch((window.Capacitor ? SITE : '') + 'daily/' + dayKey() + '.json', { cache: 'no-cache' });   // the Android app reads the live site's routes if (!r.ok) return null;
    let titles = (await r.json()).route; if (!Array.isArray(titles) || titles.length < 3) return null;
    if (LANG !== 'en'){ titles = await translateTitles(titles, LANG); if (!titles) return null; }
    const route = []; for (const ti of titles) route.push(await ready(topic(ti)));
    return route;
  } catch (e) { return null; }
}
// a challenge link names the start and the goal; the player finds their own way
function challengeSlot(ch){
  const slot = { route: null };
  slot.promise = Promise.all([ready(topic(ch.s)), ready(topic(ch.g))]).then(r => { slot.route = r; return r; }).catch(() => null);
  return slot;
}
function challengeUrl(){
  const p = { s: game.start.title, g: game.goal.title, d: game.chalLevel || game.level, l: LANG };
  if (game.clue) p.m = 1; if (game.timed) p.t = 1; if (game.how === 'win' && game.used) p.b = game.used;
  return SITE + '?' + new URLSearchParams(p);
}
// a daily streak: consecutive days with the daily challenge found
const streakGet = () => { try { const v = JSON.parse(localStorage.getItem('rh-streak') || 'null'); return v && v.last ? v : { last: '', n: 0, best: 0 }; } catch (e) { return { last: '', n: 0, best: 0 }; } };
const dayBefore = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const streakNow = () => { const s = streakGet(); return s.last === dayKey() || s.last === dayBefore() ? s.n : 0; };
function streakWin(){
  const s = streakGet(), today = dayKey();
  if (s.last !== today){ s.n = s.last === dayBefore() ? s.n + 1 : 1; s.last = today; s.best = Math.max(s.best || 0, s.n); try { localStorage.setItem('rh-streak', JSON.stringify(s)); } catch (e) {} }
  return s.n;
}
function prepareRound(daily = false, level = game.level){
  const key = roundKey(daily, level);
  if (nextRound[key]) return nextRound[key];
  const cfg = daily ? GAME_LEVELS.adventurer : GAME_LEVELS[level], slot = nextRound[key] = { route: null };
  const build = () => buildRound(cfg, daily ? rng(hash('rabbit-hole-' + dayKey())) : Math.random, (m, sub) => { slot.msg = m; slot.sub = sub; });
  slot.promise = (daily ? dailyRoute().then(r => r || build()) : build())
    .then(r => { slot.route = r; if (!r) delete nextRound[key]; return r; })
    .catch(() => { delete nextRound[key]; return null; });
  return slot;
}
function openRules(){ $('#rules').classList.add('on'); prepareRound(false, game.level); prepareRound(true); }
async function startGame(opts = {}){
  $('#rules').classList.remove('on'); $('#result').classList.remove('on'); hideFront(); card.classList.remove('on');
  const ch = opts.challenge || null, daily = !!opts.daily, cfg = daily ? GAME_LEVELS.adventurer : GAME_LEVELS[ch ? ch.d : game.level] || GAME_LEVELS[4];
  track(daily ? 'game-daily' : ch ? 'game-challenge' : 'game-' + game.level);
  $('#now').innerHTML = `<div class="w">${esc(cur.name)}</div><div class="n">${daily ? "setting today's challenge…" : 'setting a goal…'}</div>`;
  const L = $('#loading'), say = (m, sub) => { L.querySelector('.msg').textContent = m; L.querySelector('.sub').textContent = sub || ''; };
  // use the round that's been building in the background (the daily one is kept all day; others are used once)
  const key = roundKey(daily, game.level);
  const slot = ch ? challengeSlot(ch) : nextRound[key] || prepareRound(daily, game.level);
  if (!daily && !ch) delete nextRound[key];
  if (!slot.route){ say(daily ? "loading today's challenge…" : 'populating your starting world…', 'nearly there'); L.classList.add('on'); }
  const myStart = ++gameStartTok;
  const progress = setInterval(() => { if (slot.msg) say(slot.msg, slot.sub); }, 300);   // deep goals take a while: show how far the digging has got
  const route = slot.route || await slot.promise;
  clearInterval(progress); L.classList.remove('on');
  if (myStart !== gameStartTok) return;   // closed with the corner exit while it loaded
  if (!route){ $('#now').innerHTML = `<div class="w">${esc(cur.name)}</div><div class="n">couldn't set a goal just now, try again</div>`; return; }
  for (const T of TOPICS.values()){ T.next = 0; T.jump = null; T.picked = false; }
  const st = daily ? {} : ch ? { mystery: ch.m, timed: ch.t } : game.style;   // today's challenge is always normal play, so everyone plays the same game
  Object.assign(game, { on: true, over: false, glow: cfg.glow && !st.mystery, route, start: route[0], goal: route[route.length - 1], par: cfg.par, allowed: cfg.par + cfg.spare, used: 0, daily, picks: [], how: null,
    clue: !!st.mystery, noPic: !!st.mystery && cfg.par >= 10, timed: !!st.timed, limit: st.timed ? limitFor(cfg) : 0, started: false, t0: 0, took: 0, climbCost: !!cfg.climbCost, levelName: daily ? "today's challenge" : DEPTH_NAMES[ch ? ch.d : game.level], chalLevel: ch ? ch.d : 0, beat: ch ? ch.b : 0 });
  document.body.classList.add('playing'); setIcon('gameBtn', 'stop', 'give up');
  cv.classList.add('swap'); await new Promise(r => setTimeout(r, 280));
  stack = []; cur = game.start; cam.s = fitS(); cam.phi = spinGoal = 0; falling = diving = false; $('#fall').classList.remove('on'); arriveLater = [cur, t('welcome')];   // shown once the goal tile is closed
  requestAnimationFrame(() => cv.classList.remove('swap'));
  moved(); showGoal(); showHud();
}
function checkGame(){
  if (cur === game.goal) return endGame('win');
  if (game.used >= game.allowed) endGame('out');
}
// the goal tile: read it, then press Start (closing it starts the round too)
function showGoal(){
  if (!game.on) return;
  if (game.clue) openClue(); else openCard(game.goal.title, 'your goal');
  $('#cardGo').hidden = game.started || game.over;
  if (game.beat && !game.daily) card.querySelector('.k').textContent = `your goal · beat ${game.beat} world${game.beat === 1 ? '' : 's'}`;
}
function startPlay(){
  if (!game.on || game.started) return;
  game.started = true; game.t0 = performance.now(); $('#cardGo').hidden = true;
  card.classList.remove('on'); showHud();
}
// the in-game corner, on the right where it can't get lost: the clue (mystery goal) and the clock (timed)
function showHud(){
  const on = game.on && !game.over && (game.clue || game.timed);
  $('#hud').hidden = !on; $('#hudClue').hidden = !game.clue; $('#hudTime').hidden = !game.timed;
  tickHud();
}
function tickHud(){
  if (!game.on || !game.timed) return;
  const left = game.over ? game.limit - game.took : game.started ? game.limit - (performance.now() - game.t0) / 1000 : game.limit;
  const el = $('#hudTime'); el.querySelector('b').textContent = clock(left);
  el.classList.toggle('low', left <= 20); el.classList.toggle('panic', left <= 10);
  if (game.started && !game.over && left <= 0) endGame('time');
}
setInterval(tickHud, 250);
// winning: a gold door twists shut over the world, and the game card rises in front of it
DOORS.set('gold-win', { n: 8, tint: ['#fff4cf', '#e8b84a', '#7a5414'], dir: 1, curl: 1.7, alt: true, rivets: 24, phase: .4 });
let winFx = null;
function drawWinDoor(){
  const now = performance.now(), p = clamp((now - winFx.t0) / 1000, 0, 1), o = 1 - (p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = `rgba(4,5,10,${.6 * p})`; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(DPR, 0, 0, DPR, W / 2 * DPR, H / 2 * DPR); ctx.rotate(now / 1000 * .04);
  drawDoor('gold-win', null, Math.hypot(W, H) * .56, 1, o, now / 1000);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
function winCard(mine){
  winFx = { t0: performance.now() }; SFX.out();
  if (!CONF.length) celebrate(W / 2, H * .35);
  stamp = null;   // the card is the celebration: no hand-drawn stamp behind it
  const gold = ['#ffd76a', '#fff1c4', '#e8b84a', '#ffffff', '#f5c451'];
  CONF.forEach((c, i) => c.c = gold[i % gold.length]);
  const w = $('#win');
  w.querySelector('.goal').textContent = game.goal.name;
  $('#wTime').textContent = clock(game.took); $('#wWorlds').textContent = game.used; $('#wBest').textContent = game.par;
  w.querySelector('.route').innerHTML = mine.map((n, i) => `<span${i === mine.length - 1 ? ' class="end"' : ''}>${esc(n)}</span>`).join('<i>›</i>');
  w.querySelector('.badges').innerHTML = [game.levelName, game.clue && 'Mystery', game.timed && 'Timed'].filter(Boolean).map(b => `<span>${esc(b)}</span>`).join('');
  const streak = game.daily ? streakWin() : 0;
  w.querySelector('.k').textContent = game.daily ? "today's challenge · complete" : game.beat ? (game.used < game.beat ? 'you beat their ' + game.beat + '!' : game.used === game.beat ? 'you matched their ' + game.beat : 'they found it in ' + game.beat) : 'congratulations';
  if (streak > 1) w.querySelector('.badges').insertAdjacentHTML('beforeend', `<span>🔥 ${streak}-day streak</span>`);
  $('#daily').textContent = dailyLabel();
  setTimeout(() => { w.classList.remove('gone'); requestAnimationFrame(() => w.classList.add('on')); }, 950);
}
function closeWin(){ const w = $('#win'); w.classList.remove('on'); setTimeout(() => w.classList.add('gone'), 450); winFx = null; }
function endGame(how){
  game.over = true; game.how = how; falling = false; settleUntil = 0; $('#fall').classList.remove('on');
  game.took = game.started ? (performance.now() - game.t0) / 1000 : 0; showHud();
  if (how === 'win') SFX.chime(); else SFX.sad();
  if (!game.daily) setTimeout(() => prepareRound(false, game.level), 2500);   // the next round builds once this one is over
  track(how === 'win' ? (game.daily ? 'won-daily' : 'won') : how === 'time' ? 'timed-out' : 'gave-up');
  if (game.daily){ try { localStorage.setItem('rh-daily-' + dayKey(), how === 'win' ? String(game.used) : 'x'); } catch (e) {} }
  const mine = stack.concat(cur).filter(T => !T.box).map(T => T.name), way = game.route.map(T => T.name).join(' → ');
  card.classList.remove('on'); clearTimeout(arriveT); $('#arrive').classList.remove('on');
  if (how === 'win') return winCard(mine);
  $('#result h2').textContent = (game.daily ? "today's challenge: " : '') + (how === 'out' ? 'out of worlds' : how === 'time' ? "time's up" : 'given up');
  $('#result .msg').innerHTML = `The goal was <b>${esc(game.goal.name)}</b>${game.goal.desc ? ` (${esc(game.goal.desc)})` : ''}.`;
  $('#result .route').innerHTML = 'one way there: ' + esc(way);
  $('#result').classList.add('on');
}
// the celebration: sketched confetti, a gold ring where you clicked, and a hand-lettered stamp
const CONF = []; let stamp = null;
function celebrate(x, y){
  const cols = ['#e4572e', '#f2c14c', '#6aa84f', '#4f86c6', '#9b5de5', '#f15bb5', '#2a9d8f'], kinds = ['rect', 'tri', 'star', 'curl'];
  for (let i = 0; i < 170; i++){ const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 12; CONF.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, r: Math.random() * 6, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 9, c: cols[i % cols.length], k: kinds[i % 4], life: 150 + Math.random() * 70 }); }
  for (let i = 0; i < 90; i++) CONF.push({ x: Math.random() * W, y: -20 - Math.random() * 200, vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 3, r: Math.random() * 6, vr: (Math.random() - .5) * .3, s: 6 + Math.random() * 8, c: cols[i % cols.length], k: kinds[i % 4], life: 260 });
  stamp = { x, y, t: 0 };
}
function drawConfetti(){
  if (!CONF.length && !stamp) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.lineJoin = ctx.lineCap = 'round';
  if (stamp){
    stamp.t++;
    const t = stamp.t, ring = t * 9;
    if (t < 50){ ctx.globalAlpha = 1 - t / 50; ctx.strokeStyle = '#f2c14c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(stamp.x, stamp.y, ring, 0, 7); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(stamp.x, stamp.y, ring * .8, 0, 7); ctx.stroke(); }
    const pop = t < 12 ? t / 12 * 1.15 : t < 20 ? 1.15 - (t - 12) / 8 * .15 : 1, fade = t > 120 ? Math.max(0, 1 - (t - 120) / 30) : 1;
    ctx.globalAlpha = fade; ctx.save(); ctx.translate(W / 2, H * .3); ctx.rotate(-.07); ctx.scale(pop, pop);
    ctx.font = `700 ${Math.min(W, H) * .11}px ${GF}`; ctx.textAlign = 'center'; ctx.lineWidth = 10; ctx.strokeStyle = '#fff'; ctx.strokeText('found it!', 0, 0); ctx.fillStyle = '#e4572e'; ctx.fillText('found it!', 0, 0);
    ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.strokeText('found it!', 0, 0); ctx.restore();
    if (t > 150) stamp = null;
  }
  for (let i = CONF.length - 1; i >= 0; i--){
    const p = CONF[i]; p.vy += .22; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--;
    if (p.life <= 0 || p.y > H + 40){ CONF.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, p.life / 40); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath();
    if (p.k === 'rect') ctx.rect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    else if (p.k === 'tri'){ ctx.moveTo(0, -p.s / 2); ctx.lineTo(p.s / 2, p.s / 2); ctx.lineTo(-p.s / 2, p.s / 2); ctx.closePath(); }
    else if (p.k === 'star'){ for (let j = 0; j < 10; j++){ const rr = j % 2 ? p.s * .22 : p.s * .55, a = j * Math.PI / 5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }
    else { ctx.moveTo(-p.s / 2, 0); ctx.quadraticCurveTo(-p.s / 4, -p.s / 2, 0, 0); ctx.quadraticCurveTo(p.s / 4, p.s / 2, p.s / 2, 0); ctx.lineWidth = 3; ctx.strokeStyle = p.c; ctx.stroke(); ctx.restore(); continue; }
    ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
$('#dice').onclick = () => { if (game.on || !cur) return; let w; do { w = WORLDS_L[Math.floor(Math.random() * WORLDS_L.length)]; } while (WORLDS_L.length > 1 && cur && w === cur.title); track('random'); enterWorld(w, true); };
function hideFront(){ setTimeout(placeCentre, 30); $('#modes').classList.add('gone'); $('#howto').classList.add('gone'); $('#helpBtn').classList.remove('on'); }
const ICONS = {"search": '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>', "game": '<svg viewBox="0 0 24 24"><path d="M7 7.5h10a4.2 4.2 0 0 1 4.1 3.3l.95 4.6a2.6 2.6 0 0 1-4.35 2.4L15.9 16H8.1l-1.8 1.8a2.6 2.6 0 0 1-4.35-2.4l.95-4.6A4.2 4.2 0 0 1 7 7.5z"/><path d="M7.6 10.4v3.2M6 12h3.2"/><circle cx="15.6" cy="11" r=".95" fill="currentColor" stroke="none"/><circle cx="17.6" cy="13" r=".95" fill="currentColor" stroke="none"/></svg>', "stop": '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>', "dice": '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/></svg>', "fall": '<svg viewBox="0 0 24 24"><path d="M12 4v15M6 13l6 6 6-6"/></svg>', "climb": '<svg viewBox="0 0 24 24"><path d="M12 20V5M6 11l6-6 6 6"/></svg>', "sound": '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/></svg>', "mute": '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 10l4 4M21 10l-4 4"/></svg>', "help": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.8-2.5 2-2.5 4"/><circle cx="12" cy="17" r=".9" fill="currentColor"/></svg>'};
function setIcon(id, name, label){ const b = document.getElementById(id); b.innerHTML = ICONS[name]; b.title = label; b.setAttribute('aria-label', label); }
$('#wShare').onclick = async () => {
  const text = resultText(), b = $('#wShare');
  try { if (navigator.share && matchMedia('(pointer:coarse)').matches) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); b.textContent = 'Copied!'; } }
  catch (e) {}
  setTimeout(() => b.textContent = 'Share', 1800);
};
$('#wSave').onclick = () => $('#saveCard').click();
$('#wAgain').onclick = () => { closeWin(); exitGame(); openRules(); };
$('#wHome').onclick = () => { closeWin(); goHome(); };
$('#win .cx').onclick = () => { closeWin(); exitGame(); };
$('#cardGo').onclick = startPlay;
$('#hudClue').onclick = () => openClue();
function exitGame(){ chalHold = false; game.on = false; game.over = false; game.started = false; winFx = null; $('#win').classList.remove('on'); $('#win').classList.add('gone'); BOX.jump = randomWorld(); want(BOX.jump); document.body.classList.remove('playing'); setIcon('gameBtn', 'game', 'the game'); $('#result').classList.remove('on'); for (const T of TOPICS.values()) T.picked = false; showNow(); showHud(); }
$('#modePlay').onclick = () => { hideFront(); openRules(); };
$('#modeFree').onclick = () => hideFront();
$('#rulesClose').onclick = () => $('#rules').classList.remove('on');
$('#go').onclick = () => startGame();
$('#daily').onclick = () => startGame({ daily: true });
function dailyLabel(){ let done = null; try { done = localStorage.getItem('rh-daily-' + dayKey()); } catch (e) {} const sn = streakNow(), fire = sn > 0 ? ` · 🔥${sn}` : ''; return (done ? (done === 'x' ? "today's challenge (try again)" : `today's challenge (done in ${done})`) : "today's challenge") + fire; }
$('#daily').textContent = dailyLabel();
// a Wordle-style result: one mark per click, green on the known route, yellow off it, a star for the goal
function resultText(){
  const onRoute = new Set(game.route.map(T => T.title)), marks = game.picks.map(t => t === '↑' ? '⬆️' : t === game.goal.title ? '⭐' : onRoute.has(t) ? '🟢' : '🟡').join('');
  const sn = game.daily && game.how === 'win' ? streakNow() : 0;
  return `Rabbit Hole${game.daily ? ' · daily ' + dayKey() : ''}\n${game.start.name} → ${game.goal.name}\n${marks || '·'}  ${game.how === 'win' ? `found in ${game.used} world${game.used === 1 ? '' : 's'}` : 'not found'}${game.took ? ' · ⏱ ' + clock(game.took) : ''} (best route ${game.par})${sn > 1 ? '\n🔥 ' + sn + '-day streak' : ''}\n${game.daily ? 'Play today\'s: ' + SITE + '?daily=1' : (game.how === 'win' ? 'Beat me: ' : 'Can you find it? ') + challengeUrl()}`;
}
$('#copyRes').onclick = async () => {
  const text = resultText(), b = $('#copyRes');
  try { if (navigator.share && matchMedia('(pointer:coarse)').matches) await navigator.share({ text }); else await navigator.clipboard.writeText(text); b.textContent = 'copied!'; }
  catch (e) { b.textContent = 'copy failed'; }
  setTimeout(() => b.textContent = 'copy result', 1800);
};
// a picture of your run, drawn in whichever style you're playing in
$('#saveCard').onclick = () => {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const g = c.getContext('2d'), glass = GLASS, fam = glass ? GF : '"Patrick Hand"';
  if (glass){ const gr = g.createLinearGradient(0, 0, 1080, 1350); gr.addColorStop(0, '#110c2c'); gr.addColorStop(.55, '#27408b'); gr.addColorStop(1, '#8a3fa0'); g.fillStyle = gr; } else g.fillStyle = '#fff';
  g.fillRect(0, 0, 1080, 1350);
  const ink = glass ? '#fff' : INK, mute = glass ? 'rgba(255,255,255,.72)' : '#6a6a6a';
  g.fillStyle = ink; g.textAlign = 'center'; g.font = `${glass ? '700 ' : ''}88px ${fam}`; g.fillText('Rabbit Hole', 540, 160);
  g.fillStyle = mute; g.font = `40px ${fam}`; g.fillText(game.daily ? "today's challenge · " + dayKey() : 'the game', 540, 225);
  const steps = [game.start.name, ...game.picks.filter(t => t !== game.start.title)], y0 = 340, gap = Math.min(150, 760 / Math.max(1, steps.length - 1));
  steps.forEach((n, i) => {
    const y = y0 + i * gap, isGoal = n === game.goal.title || n === game.goal.name;
    if (i) { g.strokeStyle = mute; g.lineWidth = 4; g.setLineDash([6, 14]); g.beginPath(); g.moveTo(540, y - gap + 44); g.lineTo(540, y - 44); g.stroke(); g.setLineDash([]); }
    g.beginPath(); g.arc(540, y, 36, 0, 7); g.fillStyle = isGoal ? '#f2c14c' : glass ? 'rgba(255,255,255,.18)' : '#fff'; g.fill(); g.lineWidth = 4; g.strokeStyle = ink; g.stroke();
    g.fillStyle = ink; g.font = `${glass ? '600 ' : ''}46px ${fam}`; g.textAlign = 'left'; g.fillText(n.length > 26 ? n.slice(0, 25) + '…' : n, 600, y + 15); g.textAlign = 'center';
  });
  g.fillStyle = ink; g.font = `${glass ? '700 ' : ''}64px ${fam}`; g.fillText(game.how === 'win' ? `found ${game.goal.name.length > 20 ? 'it' : game.goal.name} in ${game.used} worlds` : `goal: ${game.goal.name}`, 540, 1200);
  g.fillStyle = mute; g.font = `38px ${fam}`; g.fillText(`best known route: ${game.par} worlds`, 540, 1262);
  g.font = `30px ${fam}`; g.fillText(SITE.replace(/^https:\/\//, '').replace(/\/$/, ''), 540, 1318);
  c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `rabbit-hole-${game.daily ? dayKey() : 'run'}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
};
$('#sound').onclick = () => { SFX.on = !SFX.on; setIcon('sound', SFX.on ? 'sound' : 'mute', SFX.on ? 'sound on' : 'sound off'); if (SFX.on) SFX.pick(); };
setIcon('sound', SFX.on ? 'sound' : 'mute', SFX.on ? 'sound on' : 'sound off');
// search opens from the icon, and folds away again when it's empty
function openSeek(){ $('#seekWrap').classList.add('open'); setTimeout(() => seek.focus(), 30); }
$('#seekBtn').onclick = () => $('#seekWrap').classList.contains('open') && !seek.value ? $('#seekWrap').classList.remove('open') : openSeek();
seek.addEventListener('blur', () => setTimeout(() => { if (!seek.value) $('#seekWrap').classList.remove('open'); }, 200));
// the movement guide lives behind the help icon
$('#helpBtn').onclick = () => { const h = $('#howto'); h.classList.toggle('gone'); $('#helpBtn').classList.toggle('on', !h.classList.contains('gone')); };
$('#again').onclick = () => { $('#result').classList.remove('on'); openRules(); };
$('#free').onclick = exitGame;
$('#gameBtn').onclick = () => { if ($('#rules').classList.contains('on')) return $('#rules').classList.remove('on'); if (game.on && !game.over) endGame('gave'); else { exitGame(); openRules(); } };
// the depth slider (how far) and the game styles (how it plays), both remembered for next time
const depthEl = $('#depth');
function showDepth(){
  const n = game.level, c = GAME_LEVELS[n], st = game.style;
  $('#rules .dname').textContent = DEPTH_NAMES[n];
  $('#rules .dstat').textContent = `${c.par} worlds away · ${c.par + c.spare} to use` + (st.timed ? ` · ${clock(limitFor(c))}` : '');
  $('#rules .lvnote').textContent = depthNote(c, st); depthEl.style.setProperty('--p', ((n - 1) / 4 * 100) + '%');
  document.querySelectorAll('#rules .styles button').forEach(b => b.classList.toggle('on', b.dataset.style === 'normal' ? !st.mystery && !st.timed : !!st[b.dataset.style]));
}
try { const v = +localStorage.getItem('rh-depth'); if (v >= 1) game.level = Math.min(5, v > 5 ? Math.ceil(v / 2) : v); } catch (e) {}
try { const v = JSON.parse(localStorage.getItem('rh-style') || 'null'); if (v) game.style = { mystery: !!v.mystery, timed: !!v.timed }; } catch (e) {}
depthEl.value = game.level; showDepth();
depthEl.addEventListener('input', () => { if (+depthEl.value === game.level) return; game.level = +depthEl.value; showDepth(); SFX.tap(); });
depthEl.addEventListener('change', () => { try { localStorage.setItem('rh-depth', game.level); } catch (e) {} prepareRound(false, game.level); });
// Normal play is the default; Mystery and Timed switch on and off, and can be combined
document.querySelectorAll('#rules .styles button').forEach(b => b.onclick = () => {
  const k = b.dataset.style, st = game.style;
  if (k === 'normal') st.mystery = st.timed = false; else st[k] = !st[k];
  try { localStorage.setItem('rh-style', JSON.stringify(st)); } catch (e) {}
  showDepth();
});

function openWorld(T){
  const L = $('#loading'); L.querySelector('.msg').textContent = 'populating your world…'; L.querySelector('.sub').textContent = T.title; L.classList.add('on');
  wantNow(T); const wait = setInterval(() => { if (T.status !== 'ready') return; clearInterval(wait); primeImgs(T); L.classList.remove('on'); if (!openWorld.primed){ openWorld.primed = true; setTimeout(() => prepareRound(false, game.level), 4000); if (!introPlaying) setTimeout(() => showAbout(true), 500); /* the "What is" card always comes first (after the intro, when that plays) */ } stack = []; cur = T; cam.s = fitS(); cam.phi = spinGoal = 0; want(nextOf(cur)); moved(); arrive(cur); }, 100);
}
// the glowing ring shown before the intro can draw: fade it once the intro is on screen (or can't be)
// the corner exits
let gameStartTok = 0;
function wireExits(){
  $('#arrive .cx').onclick = () => $('#arrive').classList.remove('on');
  $('#result .cx').onclick = () => exitGame();
  $('#loading .cx').onclick = () => { $('#loading').classList.remove('on'); gameStartTok++; showNow(); };
  $('#enter .cx').onclick = () => { enterTok++; const E = $('#enter'); E.classList.remove('on'); setTimeout(() => E.classList.add('gone'), 450); };
  $('#tour .tourX').onclick = () => endTour();
  $('#pre .preSkip').onclick = () => { window.rhSkipIntro = true; const sk = document.querySelector('#rhIntro .skip'); if (sk) sk.click(); dropPre(); };
}
wireExits();
function dropPre(){ const p = $('#pre'); if (!p || p.classList.contains('out')) return; p.classList.add('out'); setTimeout(() => p.remove(), 1000); }
setTimeout(dropPre, 12000);   // never leave it up, whatever happens
function startIntro(){
  if (introPlaying) return;
  window.rhSkipIntro = false;
  const introMod = import('../intro.js');
  aboutAuto = false;   // each intro is followed by the card, once
  introPlaying = true; document.body.classList.add('introplay');
  $('#howto').classList.add('gone'); $('#helpBtn').classList.remove('on');
  const done = () => {
    introPlaying = false; dropPre(); SFX.musicOut(); document.body.classList.add('introfade'); document.body.classList.remove('introplay');
    setTimeout(() => document.body.classList.remove('introfade'), 1200);
    try { localStorage.setItem('rh-intro-seen', '1'); } catch (e) {}
    setTimeout(() => showAbout(true), 1100);   // the card always follows the intro
  };
  introMusic();
  Promise.all([introMod, Promise.race([langReady, sleep(1500)])]).then(([m]) => window.rhSkipIntro ? done() : m.playIntro({ titles: WORLDS_L, strings: { skip: t('skipIntro'), tagline: t('tagline') }, onReveal: done })).catch(e => { console.error(e); done(); });
}
$('#replayIntro').onclick = startIntro;

// put every on-screen word into the chosen language
function applyStrings(){
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i]').forEach(el => {
    const k = el.getAttribute('data-i');
    if (k === 'credits') el.innerHTML = t('credits', { wp: '<a href="https://www.wikipedia.org/" target="_blank" rel="noopener">' + t('wiki') + '</a>', oa: '<a href="https://openalex.org/" target="_blank" rel="noopener">OpenAlex</a>', three: '<a href="https://threejs.org/" target="_blank" rel="noopener">three.js</a>', el: '<a href="https://elevenlabs.io/" target="_blank" rel="noopener">ElevenLabs</a>', ph: '<a href="https://polyhaven.com/" target="_blank" rel="noopener">Poly Haven</a>' });
    else if (/D$|hook/.test(k)) el.innerHTML = t(k);
    else el.textContent = t(k);
  });
  document.querySelectorAll('[data-ph]').forEach(el => el.placeholder = t(el.getAttribute('data-ph')));
  $('#langBtn span').textContent = LANG.toUpperCase();
  $('#cardLink').title = t('copyLink'); $('#cardLink').setAttribute('aria-label', t('copyLink'));
  $('#langList').innerHTML = LANGS.map(([c, n]) => `<li><button type="button" data-l="${c}" class="${c === LANG ? 'on' : ''}">${n}<small>${c}</small></button></li>`).join('');
  showNow();
}
// switching language: the same world, as that language's Wikipedia has it (or a fresh one)
async function setLang(code){
  if (code === LANG || game.on) return;
  const was = cur && cur.title;
  let same = null;
  if (was){ const j = await q({ action: 'query', titles: was, prop: 'langlinks', lllang: code, redirects: '1' }).catch(() => null); const pg = j && j.query && j.query.pages && j.query.pages[0]; same = pg && pg.langlinks && pg.langlinks[0] && pg.langlinks[0].title; }
  LANG = code; try { localStorage.setItem('rh-lang', code); } catch (e) {}
  API = WIKI() + '/w/api.php';
  digQueue.length = 0; TOPICS.clear(); READ.clear(); for (const k in nextRound) delete nextRound[k];
  applyStrings();
  await localiseWorlds();
  enterWorld(same || WORLDS_L[Math.floor(Math.random() * WORLDS_L.length)]);
}
$('#langBtn').onclick = e => { e.stopPropagation(); $('#langList').classList.toggle('on'); };
$('#langList').addEventListener('click', e => { const b = e.target.closest('button[data-l]'); if (!b) return; $('#langList').classList.remove('on'); setLang(b.getAttribute('data-l')); });
addEventListener('pointerdown', e => { if (!e.target.closest('#langWrap')) $('#langList').classList.remove('on'); });
applyStrings();
// on the live site, a service worker makes sure updates arrive on the next open, even from the home screen
if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(() => {});

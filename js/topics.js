'use strict';
/* ─────────── topics ─────────── */
const TOPICS = new Map();
const topic = title => { if (!TOPICS.has(title)) TOPICS.set(title, { title, name: title, items: [], next: 0, status: 'idle', K, RH }); return TOPICS.get(title); };
const digQueue = [];
let digging = 0;
function want(T){ if (T && T.status === 'idle'){ T.status = 'queued'; digQueue.push(T); pumpDig(); } }
// the world you've picked, or are hovering over, goes to the front of the queue
function wantNow(T){ if (!T) return; if (T.status === 'idle'){ T.status = 'queued'; digQueue.unshift(T); } else if (T.status === 'queued'){ const i = digQueue.indexOf(T); if (i > 0){ digQueue.splice(i, 1); digQueue.unshift(T); } } pumpDig(); }
// a world the person asked for (dice, search) starts at once, rather than waiting behind background loading
function digNow(T){ if (!T || (T.status !== 'idle' && T.status !== 'queued')) return; const i = digQueue.indexOf(T); if (i >= 0) digQueue.splice(i, 1); digging++; dig(T).finally(() => { digging--; pumpDig(); }); }
function pumpDig(){ while (digging < 3 && digQueue.length){ const T = digQueue.shift(); digging++; dig(T).finally(() => { digging--; pumpDig(); }); } }
async function dig(T){
  T.status = 'loading';
  try {
    const [sum, parsed] = await Promise.all([summary(T.title), allLinks(T.title)]);
    T.name = sum ? sum.title : parsed.title; T.desc = sum ? (sum.description || '') : '';
    const info = (await pageInfo(parsed.links)).filter((p, i, a) => a.findIndex(x => x.title === p.title) === i && p.title !== T.name && !DULL.test(p.description || '') && !GENERIC.has(p.title)).slice(0, MAXN);
    T.setting = settingOf(T.desc + ' ' + T.name);
    layout(T, info);
  } catch (e) {
    // Wikipedia didn't answer: try this world again shortly, rather than leaving it empty for good
    if ((T.fails = (T.fails || 0) + 1) < 3){ T.status = 'idle'; setTimeout(() => want(T), 2000 * T.fails); return; }
    T.setting = 'lab'; layout(T, []);
  }
  T.status = 'ready';
}
// a sunflower spiral with log-spaced radii: the same density of things at every zoom
function layout(T, info){
  const r = rng(hash(T.title));
  // a few places are kept free for research papers (filled in once the world is the one you're in), the biggest orbs first
  if (info.length >= 30 && !T.box) info = info.slice(0, MAXN - PAPER_AT.length).flatMap((p, i) => (PAPER_AT.includes(i) ? [{ slot: true }, p] : [p]));
  const n = info.length;
  T.K = clamp(Math.exp(n / PER_FOLD) * 1.4, 12, 1500); T.RH = R0 / T.K;
  const Rout = R0 * .9, Rin = T.RH * 1.25;
  T.items = info.map((p, i) => {
    const t = (i + .5) / Math.max(n, 1), rad = Rout * Math.pow(Rin / Rout, t) * (1 + (r() - .5) * .08), ang = i * 2.39996 + (r() - .5) * .25;
    const size = rad * (.125 + (i < 12 ? .03 : 0)) * (1 + (r() - .5) * .15);
    const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
    if (p.slot) return { title: '', desc: '', kind: 'paper', paper: 'slot', r0: size, thumb: null, x, y, r: 0, bmp: null, img: 'no', ring: RINGS[i % RINGS.length], phase: r() * 6.28, wash: '#ffcf7a' };
    return { title: p.title, desc: p.description || '', kind: kindOf((p.description || '') + ' ' + p.title), thumb: p.thumbnail ? p.thumbnail.source : null, whimsy: !!p.whimsy,
             x, y, r: size, bmp: null, img: 'no', ring: RINGS[i % RINGS.length], phase: r() * 6.28, wash: p.whimsy ? '#f7c6e0' : (PAL[T.setting] || PAL.lab).wash[Math.floor(r() * (PAL[T.setting] || PAL.lab).wash.length)] };
  });
  const set = SETTINGS[T.setting || 'lab'], NS = Math.round(n * .85);
  T.scene = Array.from({ length: NS }, (_, j) => { const t = (j + .5) / NS, rad = R0 * .96 * Math.pow(T.RH * 1.3 / (R0 * .96), t) * (1 + (r() - .5) * .1), ang = j * 2.39996 + 1.2 + (r() - .5) * .3; return { g: DP[set[Math.floor(r() * set.length)]], x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, s: rad * (.1 + r() * .05), rot: (r() - .5) * .7 }; });
  T.rim = paths(gen.circle(0, 0, R0 * 2, { roughness: 1.1, strokeWidth: 2.4, stroke: INK, seed: hash(T.title) % 9999 + 1 }));
  T.dirt = paths(gen.circle(0, 0, 100 * 2.14, { roughness: 1.4, strokeWidth: 1.2, stroke: INK, seed: 7, fill: INK, fillStyle: 'hachure', hachureGap: 9, fillWeight: .5 }));
  T.next = Math.min(T.next, Math.max(0, n - 1));
}
const RINGS = Array.from({ length: 24 }, (_, i) => paths(gen.circle(0, 0, 100, { roughness: .9, bowing: .6, strokeWidth: 1.5, stroke: INK, seed: 11 + i })));
const nextOf = T => T.jump || (T.items.length && (!game.on || T.picked) ? topic(T.items[T.next].title) : null);
const imgQueue = []; let imgBusy = 0;
function wantImg(it){ if (it.img !== 'no' || !it.thumb) return; it.img = 'queued'; imgQueue.push(it); pumpImg(); }
// photos no longer on screen (a world you've left, an orb scrolled away) give up their place in the queue
function pruneImg(){ const now = performance.now(); for (let i = imgQueue.length - 1; i >= 0; i--) if (now - (imgQueue[i].seen || 0) > 2500){ imgQueue[i].img = 'no'; imgQueue.splice(i, 1); } }
// a new world's biggest orbs get their photos fetched while it's still being revealed, so they're there when it appears
function primeImgs(T, n = 48){ const now = performance.now(); T.items.slice(0, n).forEach((it, k) => { it.lastPx = Math.max(it.lastPx || 0, 60 - k); it.seen = now; wantImg(it); }); }
function pumpImg(){ pruneImg(); while (imgBusy < 24 && imgQueue.length){ let bi = 0; for (let i = 1; i < imgQueue.length; i++) if ((imgQueue[i].lastPx || 0) > (imgQueue[bi].lastPx || 0)) bi = i; const it = imgQueue.splice(bi, 1)[0]; imgBusy++; it.img = 'loading';
    // a photo Wikipedia is slow to produce lets the next one start after a moment, and still appears when it arrives
    let held = true; const free = () => { if (held){ held = false; imgBusy--; pumpImg(); } }; const slow = setTimeout(free, 2500);
    loadImg(it.thumb).catch(() => loadImg(it.thumb.replace(/\/\d+px-/, '/120px-'))).then(img => { it.bmp = { raw: img, width: img.naturalWidth, height: img.naturalHeight }; it.img = 'done'; it.shown = performance.now(); }).catch(() => { it.img = 'fail'; }).finally(() => { clearTimeout(slow); free(); }); } }

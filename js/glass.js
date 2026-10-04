'use strict';
/* ─────────── glass: luminous worlds, links as glass orbs, the hole as a glowing portal ─────────── */
const GF = '-apple-system, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';
// the intro's vortex lives on around the floating world: faint stars far behind, and dust circling it,
// faster near the rim, slowly drawn in and swallowed at the edge, then reborn further out
const SWIRL = [], STARS = [], CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;
let swirlT = 0;
// a soft point of light: bright core, long glow, like the intro's bloom
const GLOW = new Map();
function glowDot(col){
  if (GLOW.has(col)) return GLOW.get(col);
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(.1, col); gr.addColorStop(.3, col + '55'); gr.addColorStop(.6, col + '14'); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); GLOW.set(col, c); return c;
}
const smooth01 = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function newMote(anywhere){
  const gold = Math.random() < .1, cyan = !gold && Math.random() < .18;
  const r = R0 * (anywhere ? 1.04 + 1.6 * Math.pow(Math.random(), 1.7) : 2.2 + Math.random() * .5);
  const arm = Math.floor(Math.random() * 3) * 2.094, a = arm - Math.log(r / R0) * 2.4 + (Math.random() - .5) * 1.6;
  return { r, a, z: .4 + Math.random(), tw: Math.random() * 6.28, col: gold ? '#ffd9a0' : cyan ? '#bff3ff' : '#c9d6ff', age: anywhere ? 1 : 0 };
}
const TAU = Math.PI * 2;
function drawSwirl(M, s){
  const now = performance.now() / 1000, dt = CALM ? 0 : Math.min(.05, now - (swirlT || now)); swirlT = now;
  if (R0 * s > halfDiag() * 1.02) return;          // the world fills the screen: nothing around it to see
  if (!SWIRL.length){
    const small = W <= 760;
    for (let i = 0; i < (small ? 150 : 260); i++) SWIRL.push(newMote(true));
    for (let i = 0; i < (small ? 110 : 190); i++) STARS.push({ x: Math.random(), y: Math.random(), r: .35 + Math.random() * 1.05, p: Math.random() * 6.28, f: .5 + Math.random() * 1.6 });
  }
  const fade = 1 - smooth01(halfDiag() * .55, halfDiag() * 1.02, R0 * s);   // eases away as you zoom in
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#fff';
  for (const st of STARS){ ctx.globalAlpha = fade * (.2 + .35 * (.5 + .5 * Math.sin(now * st.f + st.p))); ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r, 0, 7); ctx.fill(); }
  ctx.setTransform(M); ctx.globalCompositeOperation = 'lighter';
  // the ring of light at the mouth of the hole, breathing gently, as at the end of the intro
  const ringR = R0 * (1.02 + .006 * Math.sin(now * 3)), ring = ctx.createRadialGradient(0, 0, R0 * .97, 0, 0, R0 * 1.32);
  ring.addColorStop(0, 'rgba(150,175,255,0)'); ring.addColorStop(.1, 'rgba(160,185,255,.34)'); ring.addColorStop(.35, 'rgba(110,135,255,.12)'); ring.addColorStop(1, 'rgba(90,110,255,0)');
  ctx.globalAlpha = fade; ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(0, 0, R0 * 1.32, 0, TAU); ctx.arc(0, 0, ringR * .97, 0, TAU, true); ctx.fill();   // exact full turns: a reversed arc to "7" stops short and leaves a dark wedge
  const grow = W <= 760 ? 1.3 : 1;
  for (let i = 0; i < SWIRL.length; i++){
    const m = SWIRL[i], k = m.r / R0;
    m.a -= dt * (.05 + .22 * m.z / Math.pow(k, 1.5));
    m.r -= dt * R0 * .02 * m.z / k;
    m.age = Math.min(1, m.age + dt * .4);
    if (m.r < R0 * 1.015){ SWIRL[i] = newMote(false); continue; }
    const x = Math.cos(m.a) * m.r, y = Math.sin(m.a) * m.r, px = (2.2 + 3.2 * m.z) * grow / s;
    ctx.globalAlpha = fade * m.age * (.55 + .45 * Math.sin(now * 1.7 + m.tw)) * smooth01(R0 * 1.015, R0 * 1.12, m.r) * (1 - smooth01(R0 * 2.1, R0 * 2.7, m.r));
    ctx.drawImage(glowDot(m.col), x - px * 2, y - px * 2, px * 4, px * 4);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.setTransform(M);
}
// every world's entrance is a silver iris door, and no two are alike: shut (with the world's name on it) from afar,
// twisting open as you fall towards it, twisting shut again behind you as you climb back out
const DOORS = new Map();
function doorStyle(key){
  if (DOORS.has(key)) return DOORS.get(key);
  const r = rng(hash('door:' + key));
  const tints = [['#f6f8fd', '#a7b0c4', '#565d70'], ['#fdf0ea', '#cfa293', '#744b41'], ['#fbf4e0', '#c9b27a', '#6f5c33'], ['#eaf5ff', '#95b8dc', '#40597a'],
                 ['#f2eaff', '#ac98da', '#574486'], ['#eafff7', '#8cccb2', '#3a6e5b'], ['#f4f4f4', '#999999', '#383838'], ['#fff0f6', '#d99ab8', '#7a3f5c']];
  const st = { n: 5 + Math.floor(r() * 5), tint: tints[Math.floor(r() * tints.length)], dir: r() < .5 ? 1 : -1, curl: 1.1 + r() * 1.2, alt: r() < .6, rivets: 12 + 2 * Math.floor(r() * 6), phase: r() * 6.28 };
  DOORS.set(key, st); return st;
}
function drawDoor(key, lines, R, s, o, now){
  const st = doorStyle(key), n = st.n, step = Math.PI * 2 / n, a = R * (.015 + .975 * o);
  const curl = st.dir * st.curl * (.55 + (1 - o)), tw = st.phase + st.dir * (1 - o) * 1.3;
  const arm = (i, r) => i * step + tw + curl * (R - r) / R;       // each seam spirals in from the rim
  const pt = (ang, r) => [Math.cos(ang) * r, Math.sin(ang) * r];
  if (o < .995){
    for (let i = 0; i < n; i++){
      ctx.beginPath();
      for (let k = 0; k <= 10; k++){ const r = R * 1.04 - (R * 1.04 - a) * k / 10, [x, y] = pt(arm(i, r), r); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      const a0 = arm(i, a), a1 = arm(i + 1, a); ctx.arc(0, 0, a, a0, a1, st.dir < 0);
      for (let k = 10; k >= 0; k--){ const r = R * 1.04 - (R * 1.04 - a) * k / 10, [x, y] = pt(arm(i + 1, r), r); ctx.lineTo(x, y); }
      ctx.closePath();
      const mid = arm(i + .5, R * .7), [gx, gy] = pt(mid, R * 1.05), [hx, hy] = pt(mid + st.dir * 1.2, R * .2);
      const g = ctx.createLinearGradient(gx, gy, hx, hy), t = st.tint, lit = st.alt ? (i % 2 ? 1 : .72) : 1;
      g.addColorStop(0, t[2]); g.addColorStop(.35 * lit, t[1]); g.addColorStop(.62, t[0]); g.addColorStop(1, t[1]);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = R * .012; ctx.stroke();
    }
    // a kaleidoscope sheen across the blades
    if (ctx.createConicGradient){
      const k = ctx.createConicGradient(now * .25 + tw, 0, 0);
      ['#ff9ad5', '#9ad5ff', '#b5ff9a', '#ffe39a', '#c69aff', '#ff9ad5'].forEach((c, j) => k.addColorStop(j / 5, c));
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.arc(0, 0, a, 0, TAU, true); ctx.clip();
      ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = .55; ctx.fillStyle = k; ctx.fillRect(-R, -R, R * 2, R * 2);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.restore();
    }
    // bright bevels along the seams
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = R * .006;
    for (let i = 0; i < n; i++){ ctx.beginPath(); for (let k = 0; k <= 10; k++){ const r = R - (R - a) * k / 10, [x, y] = pt(arm(i, r) + .012 * st.dir, r); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    if (o < .05){ const g = ctx.createRadialGradient(-R * .02, -R * .02, 0, 0, 0, R * .07); g.addColorStop(0, '#fff'); g.addColorStop(1, st.tint[2]); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * .06, 0, 7); ctx.fill(); }
  }
  // the frame: a polished ring with rivets
  const ring = ctx.createLinearGradient(-R, -R, R, R); ring.addColorStop(0, '#ffffff'); ring.addColorStop(.3, st.tint[1]); ring.addColorStop(.55, st.tint[2]); ring.addColorStop(.8, st.tint[0]); ring.addColorStop(1, st.tint[2]);
  ctx.strokeStyle = ring; ctx.lineWidth = R * .075; ctx.beginPath(); ctx.arc(0, 0, R * .965, 0, 7); ctx.stroke();
  ctx.fillStyle = st.tint[0];
  for (let i = 0; i < st.rivets; i++){ const an = i / st.rivets * Math.PI * 2 + st.phase, [x, y] = pt(an, R * .965); ctx.beginPath(); ctx.arc(x, y, R * .014, 0, 7); ctx.fill(); }
  // the name on the door, fading as it opens
  const ta = 1 - smooth01(.12, .42, o);
  if (ta > .02 && R * s > 22 && lines && lines.length){
    ctx.save(); ctx.rotate(cam.phi); ctx.globalAlpha = ta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const big = lines.length === 1;
    let fs = R * (big ? .2 : .16); ctx.font = `700 ${fs}px ${GF}`;
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)); if (w > R * 1.45){ fs *= R * 1.45 / w; ctx.font = `700 ${fs}px ${GF}`; }
    const plateW = Math.min(R * 1.6, Math.max(...lines.map(l => ctx.measureText(l).width)) + fs * 1.4), plateH = fs * (lines.length * 1.25 + .6);
    ctx.fillStyle = 'rgba(8,10,20,.62)'; ctx.beginPath(); ctx.roundRect(-plateW / 2, -plateH / 2, plateW, plateH, fs * .5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = fs * .06; ctx.stroke();
    ctx.fillStyle = '#fff';
    lines.forEach((l, j) => ctx.fillText(l, 0, (j - (lines.length - 1) / 2) * fs * 1.25));
    ctx.restore();
  }
}
let ringNamed = false;
// the world you're in, named around the top of its rim: "this world is", then its name, kept upright however it's spun,
// and sitting just beyond the outermost orbs so none of them can cover it
function ringLabel(T, s){
  if (T.extB !== BUMP()){ T.extB = BUMP(); T.ext = T.items.reduce((m, it) => Math.max(m, Math.hypot(it.x, it.y) + it.r * BUMP() * 1.12), R0 * 1.04); }
  let px = clamp(R0 * s * .075, 15, 30); const lp = clamp(R0 * s * .034, 10, 13), nm = T.name.toUpperCase();
  const r1 = T.ext + 6 / s;
  ctx.font = `700 ${px}px ${GF}`; const wide = ctx.measureText(nm).width / (r1 * s); if (wide > 2.2) px *= 2.2 / wide;   // very long names shrink rather than wrap half way round
  const r2 = r1 + (px * 1.12) / s;
  ctx.save(); ctx.rotate(cam.phi);
  arcText(nm, r1, px / s, s, 'rgba(255,255,255,.95)', `700 ${px / s}px ${GF}`, (px * .06) / s);
  arcText(t('thisWorld').toUpperCase(), r2, lp / s, s, 'rgba(255,255,255,.7)', `700 ${lp / s}px ${GF}`, (lp * .28) / s);
  ctx.restore();
  // the corner only names the world when this label has gone off the top of the screen
  const onScreen = CY - (r1 * s + px * 1.12 + lp * 1.2) > 6;
  if (onScreen !== ringNamed){ ringNamed = onScreen; document.body.classList.toggle('ringname', onScreen); }
}
function drawGlass(T, s, depth){
  const css = s, M = new DOMMatrix().scale(DPR).translate(CX, CY).rotate(-cam.phi * 180 / Math.PI).scale(s);
  ctx.setTransform(M);
  const vis = halfDiag() / s, bg = GBG[T.box ? 'box' : T.setting] || GBG.lab, now = performance.now() / 1000, RHt = T.RH;
  // the world's own light
  const span = Math.max(vis, R0) * 1.3, g0 = ctx.createRadialGradient(0, 0, RHt, 0, 0, R0 * 1.25);
  g0.addColorStop(0, bg[1]); g0.addColorStop(.55, bg[0]); g0.addColorStop(1, bg[0]);
  const top = depth === 0;
  if (top){   // the space the world floats in: dark, faintly tinted by the world, with the world's shadow beneath it
    ctx.fillStyle = '#090c1a'; ctx.fillRect(-span, -span, span * 2, span * 2);
    ctx.globalAlpha = .3; ctx.drawImage(halo(bg[1]), -R0 * 2.3, -R0 * 2.3, R0 * 4.6, R0 * 4.6);
    ctx.save(); ctx.rotate(cam.phi); ctx.globalAlpha = .75; ctx.drawImage(halo('#000000'), -R0 * 1.02, R0 * .78, R0 * 2.04, R0 * .5); ctx.globalAlpha = 1; ctx.restore();   // always beneath, however the world is spun
    drawSwirl(M, s);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R0, 0, 7); ctx.clip();
  }
  ctx.fillStyle = g0; ctx.fillRect(-span, -span, span * 2, span * 2);
  if (!T.blobs){ const r = rng(hash(T.title) ^ 99); T.blobs = Array.from({ length: T.box ? 5 : 34 }, (_, j) => { const t = (j + .5) / (T.box ? 5 : 34), rad = T.box ? 60 + r() * 260 : R0 * Math.pow(RHt * 2 / R0, t), a = r() * 6.28; return { a, rad, s: T.box ? 260 + r() * 200 : rad * (.5 + r() * .4), c: T.box ? ['#2bd4ff', '#e98be0', '#7b61ff', '#ffb86b', '#3a7bff'][j % 5] : [bg[1], bg[2], '#ffffff', bg[2]][j % 4], v: (r() - .5) * .06, o: .18 + r() * .2 }; }); }
  ctx.globalCompositeOperation = 'lighter';
  for (const b of T.blobs){ const a = b.a + now * b.v, x = Math.cos(a) * b.rad, y = Math.sin(a) * b.rad; if (b.s * s < 6 || Math.hypot(x, y) - b.s > vis) continue; ctx.globalAlpha = b.o; ctx.drawImage(halo(b.c), x - b.s, y - b.s, b.s * 2, b.s * 2); }
  if (T.scene) for (const d of T.scene){ const px = d.s * s; if (px < 10 || Math.hypot(d.x, d.y) - d.s > vis) continue; ctx.globalAlpha = .25 + .2 * Math.sin(now * 1.3 + d.rot * 9); const q = d.s * .22; ctx.drawImage(halo('#ffffff'), d.x - q, d.y - q, q * 2, q * 2); }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if (top){   // a glass rim, lit from the top left, so the world reads as an object
    ctx.restore(); ctx.setTransform(M);
    const rim = ctx.createLinearGradient(-R0, -R0, R0, R0); rim.addColorStop(0, 'rgba(255,255,255,.95)'); rim.addColorStop(.45, 'rgba(255,255,255,.18)'); rim.addColorStop(1, bg[2]);
    ctx.save(); ctx.rotate(cam.phi); ctx.strokeStyle = rim; ctx.lineWidth = clamp(3 * css, 1.5, 4) / css; ctx.beginPath(); ctx.arc(0, 0, R0, 0, 7); ctx.stroke(); ctx.restore();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .18; ctx.lineWidth = clamp(14 * css, 4, 18) / css; ctx.strokeStyle = bg[2]; ctx.beginPath(); ctx.arc(0, 0, R0 * 1.01, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  if (T.box) drawGlassBox(css, bg, now);
  if (T.name && !T.box && R0 * s > 60){
    if (!top) arcText(T.name.toUpperCase(), R0 * 1.04, R0 * .045, css, 'rgba(255,255,255,.9)', `600 ${R0 * .045}px ${GF}`);
  }
  const nx = T.jump || (game.on && !T.picked) || (!game.on && !T.chosen) ? null : T.items[T.next], pal = PAL[T.setting] || PAL.lab;
  for (const it of T.items){
    const px = it.r * s; if (px < 1.2 || (game.on && it.paper)) continue;
    if (Math.hypot(it.x, it.y) - it.r * 2 > vis) continue;
    it.lastPx = px; it.seen = performance.now(); if (px * BUMP() > 4) wantImg(it);   // a little ahead of need, so zooming in finds photos waiting (the biggest still go first)
    if (px * BUMP() < DOT){ const a = clamp((px * BUMP() - 2) / (DOT - 2), .25, 1); ctx.globalAlpha = .35 + .45 * a; ctx.fillStyle = it === nx ? '#ffffff' : (it.wash || '#cfd8ff'); ctx.beginPath(); ctx.arc(it.x, it.y, it.r * BUMP() * (.35 + .25 * a), 0, 7); ctx.fill(); ctx.globalAlpha = 1; continue; }
    const isGoal = game.on && game.glow && game.goal && it.title === game.goal.title;
    glassOrb(it, s, M, bg, pal, now, it === nx, it === hovered, isGoal);
  }
  ctx.textAlign = 'center';
  for (const it of T.items){
    const R = it.paper && game.on ? 0 : it.r * BUMP();
    if (R * css < DOT + 4 || Math.hypot(it.x, it.y) - R * 2 > vis) continue;
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(cam.phi);
    let fs = Math.max(R * .27, 9.5 / css), label = it.title.replace(/ \(.*\)$/, ''); ctx.font = `600 ${fs}px ${GF}`;
    let w = ctx.measureText(label).width; const maxW = R * 2.1;
    if (w > maxW){ fs = Math.max(R * .17, 9 / css, fs * maxW / w); ctx.font = `600 ${fs}px ${GF}`; w = ctx.measureText(label).width; while (w > maxW && label.length > 4){ label = label.slice(0, -2) + '…'; w = ctx.measureText(label).width; } }
    if (fs * css < 8.5){ ctx.restore(); ctx.setTransform(M); continue; }
    const y = R * .74, h = fs * 1.55, rr = h / 2;
    ctx.beginPath(); ctx.roundRect(-w / 2 - fs * .6, y - h / 2, w + fs * 1.2, h, rr);
    ctx.fillStyle = it === nx ? 'rgba(255,255,255,.92)' : 'rgba(12,16,28,.55)'; ctx.fill();
    ctx.lineWidth = 1 / css; ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.stroke();
    ctx.fillStyle = it === nx ? bg[0] : '#fff'; ctx.fillText(label, 0, y + fs * .36); ctx.restore(); ctx.setTransform(M);
  }
  if (top && T.name && !T.box && R0 * s > 60) ringLabel(T, s);
  if (nx && nx.r * s > 4){ ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.6 / css; ctx.setLineDash([2 / css, 7 / css]); ctx.beginPath(); const d = Math.hypot(nx.x, nx.y); ctx.moveTo(nx.x * (1 - nx.r * 1.15 / d), nx.y * (1 - nx.r * 1.15 / d)); ctx.quadraticCurveTo(nx.x * .35 + nx.y * .25, nx.y * .35 - nx.x * .25, nx.x / d * RHt * 1.15, nx.y / d * RHt * 1.15); ctx.stroke(); ctx.setLineDash([]); }
  // the portal
  const hp = RHt * s; if (hp < 2) return;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55 + .15 * Math.sin(now * 2); ctx.drawImage(halo(bg[2]), -RHt * 1.9, -RHt * 1.9, RHt * 3.8, RHt * 3.8); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const child = nextOf(T), mn = Math.min(W, H);
  // how open the door is: shut from afar, fully open by the time the hole fills much of the screen
  const doorO = child && child.status === 'ready' ? smooth01(mn * .14, mn * .4, hp) : 0;
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, RHt, 0, 7); ctx.clip();
  ctx.fillStyle = '#05060c'; ctx.fillRect(-RHt, -RHt, RHt * 2, RHt * 2);
  if (child){
    if (hp > 20) want(child);
    if (child.status === 'ready' && !child.primed){ child.primed = true; child.items.slice(0, 80).forEach(it => { it.lastPx = it.lastPx || .5; it.seen = performance.now(); wantImg(it); }); }
    if (child.status === 'ready' && doorO > .01 && depth < 4 && frameBudget-- > 0) drawTopic(child, s / T.K, depth + 1);
  }
  ctx.setTransform(M);
  if (hp > 3){
    const name = child ? (child.name || child.title).replace(/ \(.*\)$/, '') : '';
    const words = name.length > 16 && name.includes(' ') ? (() => { const w = name.split(' '), h = Math.ceil(w.length / 2); return [w.slice(0, h).join(' '), w.slice(h).join(' ')]; })() : [name];
    const lines = !child ? (T.box ? ['search', 'to begin'] : game.on ? ['pick a world', 'to open me'] : ['pick', 'something']) : child.status !== 'ready' ? ['opening…', ...words].slice(0, 3) : words;
    drawDoor(child ? child.title : 'empty:' + T.title, lines, RHt, s, doorO, now);
  }
  ctx.restore(); ctx.setTransform(M);
  // glass lip around the portal
  const lip = ctx.createLinearGradient(-RHt, -RHt, RHt, RHt); lip.addColorStop(0, 'rgba(255,255,255,.95)'); lip.addColorStop(.5, 'rgba(255,255,255,.25)'); lip.addColorStop(1, bg[2]);
  ctx.save(); ctx.rotate(cam.phi); ctx.strokeStyle = lip; ctx.lineWidth = clamp(4 * css, 1.5, 5) / css; ctx.beginPath(); ctx.arc(0, 0, RHt, 0, 7); ctx.stroke(); ctx.restore();
  if (top){
    const grey = smooth01(mn * .26, mn * .5, hp);
    if (grey > .01){
      const span2 = Math.max(halfDiag() / s, R0) * 1.3;
      ctx.beginPath(); ctx.rect(-span2, -span2, span2 * 2, span2 * 2); ctx.arc(0, 0, RHt * 1.004, 0, 7);
      ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = grey * .9; ctx.fillStyle = '#808080'; ctx.fill('evenodd');
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = grey * .5; ctx.fillStyle = '#070912'; ctx.fill('evenodd');
      ctx.globalAlpha = 1;
    }
  }
}
const BUMP = () => W <= 760 ? 1.24 : 1.06, DOT = 13;   // below DOT css px a bubble is shown as a soft dot
function glassOrb(it, s, M, bg, pal, now, isNext, isHover, isGoal){
  // each orb is drawn in its own upright frame, so its light, shadow and photo stay put when the world is spun
  const r = it.r * BUMP(), px = r * s;
  ctx.setTransform(M); ctx.translate(it.x, it.y); ctx.rotate(cam.phi); const L = ctx.getTransform();
  if (!it.gl || it.glR !== r){ it.glR = r;   // gradients are built around the orb's own centre once, and reused every frame
    const g1 = ctx.createRadialGradient(-r * .3, -r * .38, r * .05, 0, 0, r * 1.02); g1.addColorStop(0, 'rgba(255,255,255,.32)'); g1.addColorStop(.42, 'rgba(255,255,255,.05)'); g1.addColorStop(.82, 'rgba(0,0,0,.06)'); g1.addColorStop(1, 'rgba(0,0,0,.38)');
    const g2 = ctx.createRadialGradient(r * .12, r * .72, 0, r * .12, r * .72, r * .8); g2.addColorStop(0, 'rgba(255,255,255,.4)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
    const g3 = ctx.createLinearGradient(0, -r * .72, 0, -r * .3); g3.addColorStop(0, 'rgba(255,255,255,.9)'); g3.addColorStop(1, 'rgba(255,255,255,0)');
    const g4 = ctx.createLinearGradient(-r, -r, r, r); g4.addColorStop(0, it.wash); g4.addColorStop(1, bg[1]);
    it.gl = { g1, g2, g3, g4 };
  }
  // shadow beneath (light from the top left of the screen), and a halo when it matters
  ctx.globalAlpha = .5; ctx.drawImage(halo('#000000'), -r * 1.15 + r * .08, -r * 1.15 + r * .24, r * 2.3, r * 2.3); ctx.globalAlpha = 1;
  if (isHover || isNext || isGoal){ ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = isGoal ? .75 + .25 * Math.sin(now * 4) : .6; ctx.drawImage(halo(isGoal ? '#ffd76a' : isNext ? '#ffffff' : bg[2]), -r * 2.1, -r * 2.1, r * 4.2, r * 4.2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
  const raw = it.bmp && it.bmp.raw;
  // photos fade in over a quarter second rather than popping in
  const fade = raw && px > 10 ? Math.min(1, (performance.now() - (it.shown || 0)) / 260) : 0;
  if (fade < 1){
    ctx.fillStyle = it.gl.g4; ctx.fillRect(-r, -r, r * 2, r * 2);
    if (px > 14){ ctx.save(); ctx.translate(-r * .5, -r * .6); ctx.scale(r * .01, r * .01); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineCap = ctx.lineJoin = 'round'; ctx.stroke(GP[it.kind]); ctx.restore(); ctx.setTransform(L); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip(); }
    if (px > 22) wantImg(it);
  }
  if (fade > 0){ const iw = raw.naturalWidth, ih = raw.naturalHeight, sw = Math.min(iw, ih); ctx.globalAlpha = fade; ctx.drawImage(raw, (iw - sw) / 2, (ih - sw) / 2, sw, sw, -r, -r, r * 2, r * 2); ctx.globalAlpha = 1; }
  ctx.fillStyle = it.gl.g1; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.fillStyle = it.gl.g2; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore(); ctx.setTransform(L);
  if (px > 9){ ctx.fillStyle = it.gl.g3; ctx.beginPath(); ctx.ellipse(-r * .12, -r * .52, r * .55, r * .2, -.18, 0, 7); ctx.fill(); }
  ctx.lineWidth = clamp(1.3 * s, .6, 1.6) / s; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(0, 0, r * .92, 0, 7); ctx.stroke();
  if (it.paper){ ctx.lineWidth = clamp(2.2 * s, 1.2, 2.6) / s; ctx.strokeStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(0, 0, r * 1.06, 0, 7); ctx.stroke(); }
  if (isNext){ ctx.lineWidth = clamp(3 * s, 1.4, 3.2) / s; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 1.12, 0, 7); ctx.stroke(); }
  ctx.setTransform(M);
}
// the opening in glass: a clear cube floating on an aurora, the portal in its face
function drawGlassBox(css, bg, now){
  const S = 118, D = 64, face = (pts, a, b) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); const g = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[2][0], pts[2][1]); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, `rgba(255,255,255,${b})`); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.4 / css; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.stroke(); };
  { const F = FLOOR; ctx.save(); ctx.translate(F.x, F.y); ctx.scale(1, F.ry / F.rx);
    const gf = ctx.createRadialGradient(0, 0, 0, 0, 0, F.rx); gf.addColorStop(0, 'rgba(255,255,255,.17)'); gf.addColorStop(.7, 'rgba(255,255,255,.06)'); gf.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gf; ctx.beginPath(); ctx.arc(0, 0, F.rx, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1 / css; for (const r of [.3, .55, .8]){ ctx.beginPath(); ctx.arc(0, 0, F.rx * r, 0, 7); ctx.stroke(); }
    for (let i = 0; i < 16; i++){ const a = i / 16 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * F.rx * .12, Math.sin(a) * F.rx * .12); ctx.lineTo(Math.cos(a) * F.rx * .9, Math.sin(a) * F.rx * .9); ctx.stroke(); }
    ctx.restore(); }
  { const pulse = 1 + .05 * Math.sin(now * 1.6); ctx.globalAlpha = .42; ctx.drawImage(halo('#000000'), 20 - 170 * pulse, FLOOR.y - 36 * pulse - 18, 340 * pulse, 72 * pulse); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .22; ctx.drawImage(halo(bg[2]), -150, S - 40, 340, 180); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  face([[S, -S], [S + D, -S - D * .8], [S + D, S - D * .8], [S, S]], .1, .03);
  face([[-S, -S], [S, -S], [S + D, -S - D * .8], [-S + D, -S - D * .8]], .32, .12);
  face([[-S, -S], [S, -S], [S, S], [-S, S]], .2, .05);
  ctx.save(); ctx.beginPath(); ctx.rect(-S, -S, S * 2, S * 2); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
  const t = (now * .15) % 1, sx = -S * 2.2 + t * S * 5, g = ctx.createLinearGradient(sx - 40, 0, sx + 40, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.translate(0, 0); ctx.rotate(-.5); ctx.fillRect(sx - 60, -S * 3, 120, S * 6); ctx.restore(); ctx.setTransform(new DOMMatrix().scale(DPR).translate(CX, CY).rotate(-cam.phi * 180 / Math.PI).scale(css));
  drawBoxRabbit(css);
}
function arcText(str, rad, size, css, col, font, sp = 0){
  if (size * css < 6) return;
  ctx.save(); ctx.fillStyle = col; ctx.font = font || `${size}px "Patrick Hand"`; ctx.textAlign = 'center';
  const chars = [...str], total = (ctx.measureText(str).width + sp * (chars.length - 1)) / rad; let a = -total / 2;
  for (const ch of chars){ const w = ctx.measureText(ch).width / rad; ctx.save(); ctx.rotate(a + w / 2); ctx.translate(0, -rad); ctx.fillText(ch, 0, 0); ctx.restore(); a += w + sp / rad; }
  ctx.restore();
}

/* ─────────── the opening: one plain sketched box on white, a hole in its face ─────────── */
const BOX = { title: 'Rabbit Hole', name: 'the box', items: [], next: 0, status: 'ready', box: true, jump: null, K: 20, RH: 24 };
{
  const o = (x, e = {}) => ({ roughness: 1.2, bowing: .8, stroke: INK, strokeWidth: 2, seed: x, ...e });
  const S = 118, D = 64, Wf = { fill: '#fff', fillStyle: 'solid' }, HAT = { fill: INK, fillStyle: 'hachure', hachureGap: 6, fillWeight: .6 };
  const KR = { fill: '#e2b27a', fillStyle: 'solid' }, KR2 = { fill: '#c98f52', fillStyle: 'solid' }, KR3 = { fill: '#edc896', fillStyle: 'solid' };
  BOX.colourArt = [
    ...paths(gen.ellipse(40, S + 20, S * 2.9, 56, o(3, { fill: '#cfc6b8', fillStyle: 'solid', stroke: 'none' }))),
    ...paths(gen.polygon([[S, -S], [S + D, -S - D * .8], [S + D, S - D * .8], [S, S]], o(4, KR2))),
    ...paths(gen.polygon([[S, -S], [S + D, -S - D * .8], [S + D, S - D * .8], [S, S]], o(5, { ...HAT, stroke: 'none', fill: '#8a5a2c' }))),
    ...paths(gen.polygon([[-S, -S], [S, -S], [S + D, -S - D * .8], [-S + D, -S - D * .8]], o(6, { fill: '#6b4424', fillStyle: 'solid' }))),
    ...paths(gen.polygon([[-S, -S], [-S + D * .2, -S - D * 1.9], [S * .1, -S - D * 1.6], [S * .05, -S]], o(7, KR3))),
    ...paths(gen.polygon([[S, -S], [S + D * .5, -S - D * 1.7], [S + D * 1.4, -S - D * 1.4], [S + D, -S - D * .8]], o(8, KR3))),
    ...paths(gen.rectangle(-S, -S, S * 2, S * 2, o(9, KR))),
    ...paths(gen.rectangle(-S * .2, -S, S * .4, S * 2, o(15, { fill: '#e9d9b8', fillStyle: 'solid', strokeWidth: 1 }))),
    ...paths(gen.ellipse(S * .55, -S - D * .35, 34, 24, o(11, Wf))), ...paths(gen.ellipse(S * .72, -S - D * .62, 20, 18, o(12, Wf))),
    ...paths(gen.ellipse(S * .68, -S - D * 1.05, 7, 26, o(13, { fill: '#f7c6d0', fillStyle: 'solid' }))), ...paths(gen.ellipse(S * .8, -S - D * 1.02, 7, 25, o(14, { fill: '#f7c6d0', fillStyle: 'solid' })))
  ];
  BOX.art = [
    ...paths(gen.ellipse(40, S + 20, S * 2.9, 56, o(3, { ...HAT, hachureGap: 8, stroke: 'none' }))),
    ...paths(gen.polygon([[S, -S], [S + D, -S - D * .8], [S + D, S - D * .8], [S, S]], o(4, Wf))),
    ...paths(gen.polygon([[S, -S], [S + D, -S - D * .8], [S + D, S - D * .8], [S, S]], o(5, { ...HAT, stroke: 'none' }))),
    ...paths(gen.polygon([[-S, -S], [S, -S], [S + D, -S - D * .8], [-S + D, -S - D * .8]], o(6, Wf))),
    ...paths(gen.polygon([[-S, -S], [-S + D * .2, -S - D * 1.9], [S * .1, -S - D * 1.6], [S * .05, -S]], o(7, Wf))),
    ...paths(gen.polygon([[S, -S], [S + D * .5, -S - D * 1.7], [S + D * 1.4, -S - D * 1.4], [S + D, -S - D * .8]], o(8, Wf))),
    ...paths(gen.rectangle(-S, -S, S * 2, S * 2, o(9, Wf))),
    ...paths(gen.line(-S * .8, S * .7, S * .8, S * .7, o(10, { strokeWidth: 1 }))),
    ...paths(gen.ellipse(S * .55, -S - D * .35, 34, 24, o(11, Wf))), ...paths(gen.ellipse(S * .72, -S - D * .62, 20, 18, o(12, Wf))),
    ...paths(gen.ellipse(S * .68, -S - D * 1.05, 7, 26, o(13, Wf))), ...paths(gen.ellipse(S * .8, -S - D * 1.02, 7, 25, o(14, Wf)))
  ];
}
BOX.dirt = paths(gen.circle(0, 0, 214, { roughness: 1.4, strokeWidth: 1.2, stroke: INK, seed: 7, fill: INK, fillStyle: 'hachure', hachureGap: 9, fillWeight: .5 }));
function drawBox(css){ strokeSet(COLOUR ? BOX.colourArt : BOX.art, css); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(118 * .77, -118 - 64 * .64, 1.8, 0, 7); ctx.fill(); }

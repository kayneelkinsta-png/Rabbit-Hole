'use strict';
/* ─────────── you are the rabbit ─────────── */
const FLOOR = { x: 20, y: 222, rx: 360, ry: 78 }, RSC = 1.6;
const rabbit = { state: 'intro', t0: performance.now(), u: .18, v: .72, dir: -1, mode: 'sit', hop: null, next: 0, done: null, h: 0, pose: 0 };
const floorPt = (u, v) => ({ x: FLOOR.x + u * FLOOR.rx, y: FLOOR.y + v * FLOOR.ry, k: (.78 + .32 * (v + 1) / 2) * RSC });
const FUR = g => { const f = g.createLinearGradient(0, -52, 0, 0); f.addColorStop(0, '#f6f1ea'); f.addColorStop(.55, '#ddd2c6'); f.addColorStop(1, '#afa192'); return f; };
function E(g, x, y, rx, ry, r, fill){ g.beginPath(); g.ellipse(x, y, rx, ry, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
// side view, facing right, feet on the ground at y = 0; p goes from 0 (sitting) to 1 (stretched mid-leap)
function drawRabbit(g, p, now, twitch = 0){
  const L = (a, b) => a + (b - a) * p, fur = FUR(g), shade = '#9a8a7b';
  g.save();
  g.globalCompositeOperation = 'lighter'; g.globalAlpha *= .28; g.drawImage(halo('#ffffff'), -42, -70, 84, 84); g.globalAlpha /= .28; g.globalCompositeOperation = 'source-over';
  E(g, L(5, 0), L(-45, -37), 3.4, L(14, 15), L(-.8, -1.3), '#cbbfb2');                       // far ear
  E(g, L(-9, -27), L(-2, -7), L(11, 12), 2.6, L(0, .6), shade);                               // hind foot
  E(g, L(-11, -15), L(-17, -20), L(16, 14), L(15, 11), L(0, -.35), fur);                      // haunch
  E(g, L(-2, 0), L(-21, -22), L(19, 23), L(12.5, 10), L(-.28, -.1), fur);                     // body
  E(g, L(9, 14), L(-15, -19), L(9, 8.5), L(9.5, 8), 0, fur);                                  // chest
  E(g, L(11, 22), L(-2, -9), L(3.8, 4.6), 1.9, L(0, -.7), shade);                              // front paw
  E(g, L(-26, -37), L(-20, -23), 5.4, 5.1, 0, '#fbf8f4');                                     // tail
  const hx = L(18, 26), hy = L(-29, -27);
  E(g, hx, hy, 10.5, 8.6, .28, fur); E(g, hx + 6.5, hy + 3.4, 5.8, 4.7, .2, fur);             // head and muzzle
  const ex = L(9, 6), ey = L(-45, -38), er = L(-.8, -1.3) + twitch * .25;
  E(g, ex, ey, 4, L(15, 16), er, '#ebe3da'); E(g, ex + .6, ey + .6, 1.7, L(11, 12), er, 'rgba(226,146,166,.75)');   // near ear
  E(g, hx + 2.6, hy - 1.6, 2.3, 2.5, 0, '#1a1410'); E(g, hx + 3.2, hy - 2.5, .7, .7, 0, '#ffffff');              // eye
  E(g, hx + 11.4, hy + 2.2, 1.3, 1, 0, '#c47a88');                                            // nose
  g.strokeStyle = 'rgba(70,60,50,.45)'; g.lineWidth = .45; g.beginPath();
  for (const d of [-1.6, 0, 1.6]){ g.moveTo(hx + 10, hy + 3.2); g.lineTo(hx + 21, hy + 3.2 + d * 2.3); } g.stroke();
  g.restore();
}
// seen from behind: the view you get at the start, when it's right in front of you
function drawRabbitBack(g, twitch){
  const fur = FUR(g);
  g.save();
  E(g, -9, -1.5, 6.5, 2.4, 0, '#9a8a7b'); E(g, 9, -1.5, 6.5, 2.4, 0, '#9a8a7b');
  E(g, -11, -12, 9.5, 11, .15, fur); E(g, 11, -12, 9.5, 11, -.15, fur);
  E(g, 0, -22, 17, 19, 0, fur);
  E(g, 0, -10, 6.2, 5.8, 0, '#fbf8f4');
  E(g, 0, -45, 11.5, 10.5, 0, fur);
  E(g, -6.5, -68, 4.4, 17, -.14 + twitch * .18, '#e9e0d6'); E(g, 6.5, -68, 4.4, 17, .14 - twitch * .12, '#e9e0d6');
  g.strokeStyle = 'rgba(120,105,90,.35)'; g.lineWidth = .6; g.beginPath(); g.moveTo(-6.5, -82); g.lineTo(-6.5, -56); g.moveTo(6.5, -82); g.lineTo(6.5, -56); g.stroke();
  g.restore();
}
function rabbitReset(){ rabbit.state = 'wander'; rabbit.mode = 'sit'; rabbit.u = .18; rabbit.v = .72; rabbit.h = 0; rabbit.pose = 0; rabbit.next = performance.now() + 700; rabbit.done = null; }
function planHops(tu, tv, then){
  const d = Math.hypot(tu - rabbit.u, (tv - rabbit.v) * 1.6);
  rabbit.mode = 'hop'; rabbit.dir = tu >= rabbit.u ? 1 : -1;
  rabbit.hop = { fu: rabbit.u, fv: rabbit.v, tu, tv, n: Math.max(1, Math.round(d / .17)), t0: performance.now(), dur: 360, then };
}
function rabbitUpdate(now){
  if (rabbit.state !== 'wander' && rabbit.state !== 'toBox') return;
  if (rabbit.mode === 'sit'){
    rabbit.h = 0; rabbit.pose = 0;
    if (rabbit.state === 'wander' && now > rabbit.next){ const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * .85; planHops(Math.cos(a) * r, Math.sin(a) * r * .9); }
    return;
  }
  const H = rabbit.hop, q = (now - H.t0) / H.dur;
  if (q >= H.n){ rabbit.u = H.tu; rabbit.v = H.tv; rabbit.mode = 'sit'; rabbit.h = 0; rabbit.pose = 0; rabbit.next = now + 900 + Math.random() * 2200; if (H.then) H.then(); return; }
  const i = Math.floor(q), f = q - i, e = (i + (f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2)) / H.n;
  rabbit.u = H.fu + (H.tu - H.fu) * e; rabbit.v = H.fv + (H.tv - H.fv) * e; rabbit.h = Math.sin(f * Math.PI) * 22; rabbit.pose = Math.sin(f * Math.PI);
}
// drawn inside the box's own coordinates: hopping on the floor, or leaping up into the hole
function drawBoxRabbit(){
  const now = performance.now();
  rabbitUpdate(now);
  if (rabbit.state === 'wander' || rabbit.state === 'toBox'){
    const p = floorPt(rabbit.u, rabbit.v), tw = rabbit.mode === 'sit' ? Math.max(0, Math.sin(now / 260)) * (Math.sin(now / 1900) > .6 ? 1 : 0) : 0;
    ctx.fillStyle = `rgba(0,0,0,${.3 * (1 - rabbit.h / 36)})`; ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 21 * p.k * (1 - rabbit.h / 60), 5 * p.k, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(p.x, p.y - rabbit.h * p.k); ctx.scale(p.k * rabbit.dir, p.k); drawRabbit(ctx, rabbit.pose, now, tw); ctx.restore();
  } else if (rabbit.state === 'leap'){
    const t = Math.min(1, (now - rabbit.t0) / 780), L = floorPt(0, .3), e = t * t * (3 - 2 * t);
    if (t >= 1){ rabbit.state = 'gone'; const d = rabbit.done; rabbit.done = null; if (d) d(); return; }
    const x = L.x * (1 - e), y = L.y * (1 - e) - Math.sin(t * Math.PI) * 80, k = L.k * (1 - .85 * Math.max(0, (t - .35) / .65));
    ctx.save(); ctx.globalAlpha = 1 - Math.max(0, (t - .8) / .2); ctx.translate(x, y); ctx.rotate(-.55 + t * 1.5); ctx.scale(k, k); drawRabbit(ctx, 1, now); ctx.restore();
  }
}
// choosing how to play: hop over under the box, then leap up into the hole
function rabbitJump(then){
  if (rabbit.state === 'intro') endIntro();
  if (rabbit.state === 'leap' || rabbit.state === 'toBox'){ if (then) rabbit.done = then; return; }
  if (rabbit.state !== 'wander'){ if (then) then(); return; }
  rabbit.state = 'toBox';
  planHops(0, .3, () => { rabbit.state = 'leap'; rabbit.t0 = performance.now(); rabbit.done = then || null; });
}
// the opening: ears right in front of you, a twitch, then it hops away to the floor under the box
function drawIntroRabbit(){
  const now = performance.now(), t = (now - rabbit.t0) / 1000, Sb = Math.min(W, H) / 100;
  const end = floorPt(rabbit.u, rabbit.v), ex = W / 2 + end.x * cam.s, ey = H / 2 + end.y * cam.s, ek = end.k * cam.s;
  let x = W / 2, y, k = Sb, hop = 0, twitch = 0;
  const y0 = H + 46 * Sb;
  if (t < .9){ const e = 1 - Math.pow(1 - t / .9, 3); y = H + (90 - 44 * e) * Sb; }
  else if (t < 2.4){ y = y0; twitch = Math.sin((t - .9) * 13) * Math.sin((t - .9) / 1.5 * Math.PI); }
  else if (t < 4.6){ const q = (t - 2.4) / 2.2 * 4, i = Math.min(3, Math.floor(q)), f = q - i, e = Math.min(1, (i + (1 - Math.pow(1 - f, 2))) / 4), eg = 1 - Math.pow(1 - e, 1.6);
    x = W / 2 + (ex - W / 2) * eg; y = y0 + (ey - y0) * eg; k = Sb * Math.pow(ek / Sb, eg); hop = Math.sin(f * Math.PI) * 30 * k; }
  else { endIntro(); return; }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (t >= 2.4){ ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y, 17 * k, 4 * k, 0, 0, 7); ctx.fill(); }
  ctx.translate(x, y - hop); ctx.scale(k, k); drawRabbitBack(ctx, twitch);
}
function endIntro(){ if (rabbit.state !== 'intro') return; rabbit.state = 'wander'; rabbit.mode = 'sit'; rabbit.next = performance.now() + 900; document.body.classList.remove('intro'); }
['pointerdown', 'wheel', 'keydown'].forEach(ev => addEventListener(ev, () => endIntro(), { passive: true }));
// while you fall through a portal, you tumble in the middle of the screen
function drawFallingRabbit(){
  const t = performance.now() / 1000;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.translate(W / 2, H / 2 + Math.sin(t * 5) * 4); ctx.rotate(t * 2.4); ctx.scale(1.2, 1.2); ctx.translate(0, 22);
  drawRabbit(ctx, .85, t * 1000);
}
function pop(){ SFX.out(); cur = stack.pop(); cam.s *= cur.K; if (cur.box) rabbitReset(); moved(); }
function transitions(){
  let popped = false;
  const inGame = game.on && !game.over;
  for (let n = 0; n < 3; n++){
    const vis = restDiag() / cam.s, nx = nextOf(cur);
    if (stack.length && vis > R0 && !inGame){ pop(); popped = true; continue; }
    if (nx && nx.status === 'ready' && vis < cur.RH * .97){ push(); continue; }
    break;
  }
  if (!stack.length || inGame) cam.s = Math.max(cam.s, fitS() * (inGame ? .98 : .8));
  const nx = nextOf(cur); if (!(nx && nx.status === 'ready')) cam.s = Math.min(cam.s, restDiag() / (cur.RH * 1.02));
  if (popped) leadsBack();
  // the greeting waits until the door has shut behind you and you've pulled back a little further
  if (welcomeFor){ if (welcomeFor !== cur) welcomeFor = null; else if (cur.RH * cam.s < Math.min(W, H) * .085){ arrive(cur, t('welcomeBack')); welcomeFor = null; } }
}
// after climbing out, greet you back in the world you've returned to (once its door has closed)
let welcomeFor = null;
function leadsBack(){ if (cur && cur.status === 'ready') welcomeFor = cur; }
let falling = false, diving = false, spinGoal = 0, introPlaying = false, introSkip = 0, settleUntil = 0;
// every dive takes about the same time, however deep the world's hole is, and runs on the clock rather than the frame count
let diveRate = 1.045, lastTick = performance.now();
function beginDive(){ diveRate = clamp(Math.exp(Math.log(Math.max(cur ? cur.K : 20, 20) * 1.8) / 165), 1.035, 1.1); falling = true; diving = true; }
function tick(){
  const tNow = performance.now(), dt = clamp((tNow - lastTick) / 16.7, .25, 4); lastTick = tNow;
  if ((panX || panY) && (performance.now() - panAt > 2500 || falling || holding) && !(ptrs.size && panDrag)){ panX = panY = rawX = rawY = 0; }   // the magnet draws it back to the centre
  CX += (CXt + panX - CX) * .12; CY += (CYt + panY - CY) * .12;
  if (!cur){ ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0f1e'; ctx.fillRect(0, 0, cv.width, cv.height); return; }
  if (falling) cam.s *= Math.pow(diving ? diveRate : 1.012, dt);
  else if (settleUntil > tNow && game.on && !game.over){ const f = fitS(); cam.s *= Math.pow(f / cam.s, Math.min(1, .07 * dt)); }
  if (holding){ holdV = Math.min(holdV + .0012 * dt, .045); cam.s *= Math.pow(1 + holdV * holdDir, dt); if (holdDir > 0 && cur && !nextOf(cur)) nudge(); } else holdV = .008;
  cam.phi += (spinGoal - cam.phi) * .18;
  if (held.has('w') || held.has('arrowup')) cam.s *= 1.025; if (held.has('s') || held.has('arrowdown')) cam.s /= 1.025;
  if (held.has('q') || held.has('arrowleft')) spinGoal -= .03; if (held.has('e') || held.has('arrowright')) spinGoal += .03;
  transitions();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0f1e'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (introPlaying && (introSkip = (introSkip + 1) % 12)) return;
  if (cur && cur.status === 'ready'){ frameBudget = 4; drawTopic(cur, cam.s, 0); }
  if (winFx) drawWinDoor();

  drawConfetti();
}
function frame(){ try { tick(); } catch (e) { console.error(e); } requestAnimationFrame(frame); }

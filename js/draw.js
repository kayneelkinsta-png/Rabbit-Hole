'use strict';
/* ─────────── drawing ─────────── */
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let W = innerWidth, H = innerHeight, DPR = Math.min(devicePixelRatio || 1, 2);
let CX = 0, CY = 0;
let panX = 0, panY = 0, rawX = 0, rawY = 0, panAt = -1e9, panDrag = false;   // looking around: the view is pulled against a magnet at the centre
function resize(){ W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2); cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px'; placeCentre(); }
// the world sits in the middle of whatever space is free between the title and the controls
let CXt = 0, CYt = 0, AH = 0, SIDE = 0;   // SIDE: width taken by the notebook sidebar on wide screens
function placeCentre(){
  const t = document.getElementById('top'), tr = document.getElementById('trail'), md = document.getElementById('modes');
  let top = t ? t.getBoundingClientRect().bottom : 0, bot = tr ? tr.getBoundingClientRect().top : H;
  if (md && !md.classList.contains('gone')){ const r = md.getBoundingClientRect(); if (r.height && r.top > H * .45) bot = Math.min(bot, r.top - 8); }
  if (bot - top < 200){ top = 0; bot = H; }
  SIDE = W > 760 && document.body.classList.contains('nbopen') ? Math.min(document.getElementById('nb').offsetWidth || 400, W * .92) : 0;
  CXt = (W - SIDE) / 2; CYt = (top + bot) / 2; AH = bot - top;
  if (!CX){ CX = CXt; CY = CYt; }
}
resize(); addEventListener('resize', resize); if (window.visualViewport) visualViewport.addEventListener('resize', resize);
setInterval(placeCentre, 700);
const cam = { s: 1, phi: 0 };
let stack = [], cur = null, frameBudget = 0;
const halfDiag = () => Math.hypot(Math.max(CX, W - CX), Math.max(CY, H - CY));
// for deciding when you've zoomed out of a world: measured from where the world rests, so looking around never counts as zooming out
const restDiag = () => Math.hypot(Math.max(CXt, W - CXt), Math.max(CYt, H - CYt));
function lookAround(dx, dy){
  rawX += dx; rawY += dy;                                   // how far the finger has pulled
  const R = .3 * Math.hypot(W, H), r = Math.hypot(rawX, rawY), k = r ? R * Math.tanh(r / R) / r : 0;   // the further you pull, the harder it pulls back
  panX = rawX * k; panY = rawY * k; panAt = performance.now(); CX = CXt + panX; CY = CYt + panY;
}
const fitS = () => cur && cur.box ? Math.min(W, H) * .17 / 190 : Math.min((W - SIDE) * .86, AH || H) / 2 / (R0 * 1.2);

function strokeSet(set, css){ for (const q of set){ if (q.f && q.f !== 'none'){ ctx.fillStyle = q.f; ctx.fill(q.p); } if (q.s && q.s !== 'none'){ ctx.strokeStyle = q.s; ctx.lineWidth = clamp(q.w * css, .5, 2.4) / css; ctx.stroke(q.p); } } }
function drawTopic(T, s, depth){
  if (GLASS) return drawGlass(T, s, depth);
  // s = css pixels per unit for this topic; the view is always centred on the hole
  const css = s, M = new DOMMatrix().scale(DPR).translate(CX, CY).rotate(-cam.phi * 180 / Math.PI).scale(s);
  ctx.setTransform(M); ctx.lineCap = ctx.lineJoin = 'round';
  const vis = halfDiag() / s;                       // radius of the screen, in this topic's units
  if (T.rim && R0 * s > 4) strokeSet(T.rim, css);
  if (T.name && R0 * s > 60){ arcText(T.name.toUpperCase(), R0 * 1.035, R0 * .055, css, COLOUR && T.setting ? PAL[T.setting].line : INK); if (T.desc && R0 * s > 260) arcText(T.desc, R0 * 1.09, R0 * .03, css, '#777'); }
  const nx = T.jump || (game.on && !T.picked) ? null : T.items[T.next], RHt = T.RH;
  if (T.box) drawBox(css);
  if (T.scene){
    ctx.globalAlpha = COLOUR ? .55 : .4; ctx.strokeStyle = COLOUR ? (PAL[T.setting] || PAL.lab).line : INK;
    for (const d of T.scene){ const px = d.s * s; if (px < 7 || Math.hypot(d.x, d.y) - d.s > vis) continue; const k = d.s / 50; ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.scale(k, k); ctx.translate(-50, -50); ctx.lineWidth = 1.3 / (k * css); ctx.stroke(d.g); ctx.restore(); }
    ctx.globalAlpha = 1; ctx.setTransform(M);
  }
  const vessel = VESSEL[T.setting] || null, pal = PAL[T.setting] || PAL.lab, now = performance.now() / 1000;
  for (let i = 0; i < T.items.length; i++){
    const it = T.items[i], px = it.r * s;
    if (px < 1.2) continue;
    const d = Math.hypot(it.x, it.y); if (d - it.r * 2 > vis) continue;
    if (px < 5){ ctx.fillStyle = COLOUR ? pal.line : INK; ctx.beginPath(); ctx.arc(it.x, it.y, it.r * .5, 0, 7); ctx.fill(); continue; }
    if (px > 8){   // every clickable thing breathes a soft halo; the one under the pointer glows brighter
      const isGoal = game.on && game.glow && game.goal && it.title === game.goal.title, on = it === hovered || isGoal, glow = isGoal ? .8 + .2 * Math.sin(now * 4) : (on ? .95 : .38 + .22 * Math.sin(now * 1.6 + it.phase)) * (COLOUR ? 1 : .6), hr = it.r * (isGoal ? 2.6 : on ? 2.1 : 1.75);
      ctx.globalAlpha = glow; ctx.drawImage(halo(isGoal ? '#f2c14c' : COLOUR ? it.wash : '#9a9a9a'), it.x - hr, it.y - hr, hr * 2, hr * 2); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = COLOUR ? it.wash : '#fff'; ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, 7); ctx.fill();
    if (px > 12){
      if (it.bmp){ ctx.save(); ctx.beginPath(); ctx.arc(it.x, it.y, it.r * .92, 0, 7); ctx.clip(); if (COLOUR) ctx.globalCompositeOperation = 'multiply'; const b = it.bmp, sw = Math.min(b.width, b.height); ctx.drawImage(b, (b.width - sw) / 2, (b.height - sw) / 2, sw, sw, it.x - it.r, it.y - it.r, it.r * 2, it.r * 2); ctx.restore(); ctx.setTransform(M); }
      else { if (px > 22) wantImg(it); ctx.save(); ctx.translate(it.x - it.r * .55, it.y - it.r * .55); ctx.scale(it.r * .011, it.r * .011); ctx.lineWidth = clamp(3 * it.r * .011 * css, .5, 2) / (it.r * .011 * css); ctx.strokeStyle = COLOUR ? pal.line : INK; ctx.stroke(GP[it.kind]); ctx.restore(); ctx.setTransform(M); }
    }
    { const k = it.r / 50; ctx.save(); ctx.translate(it.x, it.y); ctx.scale(k, k); strokeSet(it.ring, css * k); const kv = KV[it.kind]; if (kv && px > 9){ ctx.lineWidth = clamp(1.4 * css * k, .5, 2) / (css * k); if (COLOUR && KFILL[it.kind]){ ctx.fillStyle = KFILL[it.kind]; ctx.fill(kv, 'evenodd'); } ctx.strokeStyle = COLOUR && KLINE[it.kind] ? KLINE[it.kind] : INK; if (COLOUR && KLINE[it.kind]) ctx.lineWidth *= 1.8; ctx.stroke(kv); } if (it.whimsy && px > 9){ ctx.strokeStyle = SPOT; ctx.setLineDash([6, 8]); ctx.lineWidth = 2 / (css * k); ctx.beginPath(); ctx.arc(0, 0, 58, 0, 7); ctx.stroke(); ctx.setLineDash([]); } ctx.restore(); ctx.setTransform(M); }
    if (it === nx){ ctx.strokeStyle = SPOT; ctx.lineWidth = clamp(3.2 * css, 1.4, 3.4) / css; ctx.beginPath(); ctx.arc(it.x, it.y, it.r * 1.12, 0, 7); ctx.stroke(); }
  }
  ctx.textAlign = 'center';
  for (const it of T.items){
    if (it.r * css < 16 || Math.hypot(it.x, it.y) - it.r * 2 > vis) continue;
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(cam.phi);
    let fs = it.r * .3, label = it.title.replace(/ \(.*\)$/, ''); ctx.font = `${fs}px "Patrick Hand"`;
    let w = ctx.measureText(label).width; const maxW = it.r * 2.05;
    if (w > maxW){ fs = Math.max(it.r * .2, fs * maxW / w); ctx.font = `${fs}px "Patrick Hand"`; w = ctx.measureText(label).width; while (w > maxW && label.length > 4){ label = label.slice(0, -2) + '…'; w = ctx.measureText(label).width; } }
    if (fs * css < 6.5){ ctx.restore(); ctx.setTransform(M); continue; }
    const y = it.r * .72, h = fs * 1.3, pad = fs * .35, chosen = it === nx || it === hovered;
    ctx.beginPath(); ctx.moveTo(-w / 2 - pad, y - h / 2); ctx.lineTo(w / 2 + pad, y - h / 2); ctx.lineTo(w / 2 + pad * 1.8, y); ctx.lineTo(w / 2 + pad, y + h / 2); ctx.lineTo(-w / 2 - pad, y + h / 2); ctx.lineTo(-w / 2 - pad * 1.8, y); ctx.closePath();
    ctx.fillStyle = it === nx ? SPOT : '#fff'; ctx.fill(); ctx.lineWidth = (chosen ? 1.8 : 1.1) / css; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = it === nx ? '#fff' : INK; ctx.fillText(label, 0, y + fs * .34); ctx.restore(); ctx.setTransform(M);
  }
  // a dotted thread from the chosen thing down into the hole
  if (nx && nx.r * s > 4){ ctx.strokeStyle = SPOT; ctx.lineWidth = 1.6 / css; ctx.setLineDash([4 / css, 7 / css]); ctx.beginPath(); const d = Math.hypot(nx.x, nx.y); ctx.moveTo(nx.x * (1 - nx.r * 1.12 / d), nx.y * (1 - nx.r * 1.12 / d)); ctx.quadraticCurveTo(nx.x * .35 + nx.y * .25, nx.y * .35 - nx.x * .25, nx.x / d * RHt * 1.1, nx.y / d * RHt * 1.1); ctx.stroke(); ctx.setLineDash([]); }
  // the hole, and the next topic inside it
  const hp = RHt * s;
  if (hp < 2) return;
  { const k = RHt / 100; ctx.save(); ctx.scale(k, k); strokeSet(T.dirt, css * k); ctx.restore(); ctx.setTransform(M); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, RHt, 0, 7); ctx.fill();
  const child = nextOf(T);
  if (child){
    if (hp > 20) want(child);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, RHt, 0, 7); ctx.clip();
    if (child.status === 'ready' && !child.primed){ child.primed = true; child.items.slice(0, 80).forEach(it => { it.lastPx = it.lastPx || .5; it.seen = performance.now(); wantImg(it); }); }
    if (child.status === 'ready' && depth < 4 && frameBudget-- > 0) drawTopic(child, s / T.K, depth + 1);
    else {
      ctx.setTransform(M); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, RHt); g.addColorStop(0, '#111'); g.addColorStop(1, '#555'); ctx.fillStyle = g; ctx.fillRect(-RHt, -RHt, RHt * 2, RHt * 2);
      if (hp > 40){ ctx.save(); ctx.rotate(cam.phi); ctx.fillStyle = '#fff'; ctx.font = `${RHt * .16}px "Patrick Hand"`; ctx.textAlign = 'center'; ctx.fillText('digging to', 0, -RHt * .08); ctx.font = `${RHt * .2}px "Patrick Hand"`; ctx.fillText(child.title.length > 22 ? child.title.slice(0, 21) + '…' : child.title, 0, RHt * .18); ctx.restore(); }
    }
    ctx.restore(); ctx.setTransform(M);
  } else {   // nothing chosen yet: the hole says what it's waiting for
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, RHt); g.addColorStop(0, '#111'); g.addColorStop(1, '#555'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, RHt, 0, 7); ctx.fill();
    if (hp > 26){
      const lines = T.box ? ['search', 'to dig'] : game.on ? ['pick a world', 'to open me'] : ['pick', 'something'];
      ctx.save(); ctx.rotate(cam.phi); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `${RHt * .3}px "Patrick Hand"`;
      ctx.fillText(lines[0], 0, -RHt * .02); ctx.fillText(lines[1], 0, RHt * .32); ctx.restore(); ctx.setTransform(M);
    }
  }
  ctx.strokeStyle = INK; ctx.lineWidth = clamp(3 * css, 1, 3) / css; ctx.beginPath(); ctx.arc(0, 0, RHt, 0, 7); ctx.stroke();
}

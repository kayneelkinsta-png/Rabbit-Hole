'use strict';
/* ─────────── what is Rabbit Hole, and a short tour ─────────── */
const touchy = matchMedia('(pointer:coarse)').matches;
let aboutAuto = false;   // the card opens by itself once per visit; the help button can always reopen it
function showAbout(auto){
  if (introPlaying || tourOn) return;
  if (auto === true){ if (aboutAuto) return; aboutAuto = true; }
  hideFront(); document.body.classList.add('onboard');
  $('#aboutTour').style.display = $('#aboutGame').style.display = game.on ? 'none' : '';
  $('#about').classList.add('on');
}
function closeAbout(){ $('#about').classList.remove('on'); }
// home: back up to the world this trail started from, zoomed out, with the "What is" card, as when the app opens
function goHome(){
  if (tourOn) endTour();
  if (!reader.classList.contains('gone')) closeReader();
  card.classList.remove('on'); $('#rules').classList.remove('on'); $('#result').classList.remove('on'); $('#homeAsk').hidden = true;
  if (game.on) exitGame();
  if (stack.length){ cur = stack[0]; stack = []; }
  falling = diving = false; $('#fall').classList.remove('on'); cam.s = fitS(); moved();
  showAbout();
}
$('#mark').onclick = () => { if (game.on && !game.over) $('#homeAsk').hidden = false; else goHome(); };
$('#mark').onkeydown = e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); $('#mark').click(); } };
$('#homeAsk .keep').onclick = () => $('#homeAsk').hidden = true;
$('#homeAsk .leave').onclick = goHome;
$('#homeAsk').addEventListener('click', e => { if (e.target.id === 'homeAsk') $('#homeAsk').hidden = true; });
function endOnboard(){ closeAbout(); document.body.classList.remove('onboard'); try { localStorage.setItem('rh-about-seen', '1'); } catch (e) {} }
$('#aboutFree').onclick = () => { endOnboard(); hideFront(); };
$('#aboutGame').onclick = () => { endOnboard(); hideFront(); openRules(); };
$('#aboutX').onclick = endOnboard;
$('#aboutTour').onclick = () => { closeAbout(); startTour(); };
$('#aboutIntro').onclick = () => { closeAbout(); document.body.classList.remove('onboard'); startIntro(); };
$('#helpBtn').onclick = () => { if ($('#about').classList.contains('on')) endOnboard(); else if (tourOn) endTour(); else showAbout(); };

// where a bubble in the current world sits on screen
function itemOnScreen(it){
  const c = Math.cos(cam.phi), sn = Math.sin(cam.phi), s = cam.s;
  return { x: CX + s * (it.x * c + it.y * sn), y: CY + s * (-it.x * sn + it.y * c), r: it.r * BUMP() * s };
}
function tourBubble(){
  if (!cur || cur.status !== 'ready') return null;
  let best = null;
  cur.items.forEach((it, i) => {
    if (it.paper) return;
    const p = itemOnScreen(it);
    if (p.r < 16 || p.x < 50 || p.x > W - 50 || p.y < 140 || p.y > H - 210 || Math.hypot(p.x - CX, p.y - CY) < cur.RH * cam.s * 1.3) return;
    if (!best || p.r > best.p.r) best = { h: { T: cur, i, it }, p };
  });
  return best;
}
let tourOn = false, tourI = 0, tourPick = null, tourAnims = [];
const TT = $('#tour'), tourSpot = TT.querySelector('.spot'), tourHand = TT.querySelector('.hand'), tourDots = TT.querySelectorAll('.dot'), tourTip = TT.querySelector('.tip');
function spotAt(x, y, w, h, round = true, lift = 0){
  Object.assign(tourSpot.style, { left: (x - w / 2) + 'px', top: (y - h / 2) + 'px', width: w + 'px', height: h + 'px', borderRadius: round ? '50%' : '22px' });
  // keep the words away from whatever is being shown
  const below = y < H * .52;
  tourTip.style.top = below ? Math.min(H - 190, y + h / 2 + 24) + 'px' : 'auto';
  tourTip.style.bottom = below ? 'auto' : Math.max(96, H - (y - h / 2) + 24 + lift) + 'px';
}
function stopAnims(){ tourAnims.forEach(a => a.cancel()); tourAnims = []; tourHand.style.opacity = 0; tourDots.forEach(d => d.style.opacity = 0); TT.querySelectorAll('.tags span').forEach(t => t.classList.remove('on')); }
const tourLoop = (el, frames, ms) => tourAnims.push(el.animate(frames, { duration: ms, iterations: Infinity, easing: 'ease-in-out' }));
// the hand's fingertip is at (20, 2) in its 46x56 box
const handAt = (x, y) => `translate(${x - 20}px, ${y - 2}px)`;
function showTap(x, y){
  tourHand.style.opacity = 1;
  tourLoop(tourHand, [{ transform: handAt(x + 60, y + 90) + ' scale(1)' }, { transform: handAt(x, y) + ' scale(1)', offset: .45 }, { transform: handAt(x, y) + ' scale(.88)', offset: .55 }, { transform: handAt(x, y) + ' scale(1)', offset: .65 }, { transform: handAt(x + 60, y + 90) + ' scale(1)' }], 2200);
}
function showHold(x, y){
  tourHand.style.opacity = 1;
  tourLoop(tourHand, [{ transform: handAt(x, y) + ' scale(1)' }, { transform: handAt(x, y) + ' scale(.88)', offset: .2 }, { transform: handAt(x, y) + ' scale(.88)', offset: .8 }, { transform: handAt(x, y) + ' scale(1)' }], 2000);
}
function showPinchIn(x, y, r){
  tourDots.forEach(d => d.style.opacity = 1);
  const a = Math.min(r * .35, 40), b = Math.min(r * .95 + 30, 150);
  tourLoop(tourDots[0], [{ transform: `translate(${x - b}px, ${y + b}px)`, opacity: 0 }, { transform: `translate(${x - b}px, ${y + b}px)`, opacity: 1, offset: .15 }, { transform: `translate(${x - a}px, ${y + a}px)`, opacity: 1, offset: .75 }, { transform: `translate(${x - a}px, ${y + a}px)`, opacity: 0 }], 1600);
  tourLoop(tourDots[1], [{ transform: `translate(${x + b}px, ${y - b}px)`, opacity: 0 }, { transform: `translate(${x + b}px, ${y - b}px)`, opacity: 1, offset: .15 }, { transform: `translate(${x + a}px, ${y - a}px)`, opacity: 1, offset: .75 }, { transform: `translate(${x + a}px, ${y - a}px)`, opacity: 0 }], 1600);
}
function showPinch(x, y, r){
  tourDots.forEach(d => d.style.opacity = 1);
  const a = Math.min(r * .35, 40), b = Math.min(r * .95 + 30, 150);
  tourLoop(tourDots[0], [{ transform: `translate(${x - a}px, ${y + a}px)`, opacity: 0 }, { transform: `translate(${x - a}px, ${y + a}px)`, opacity: 1, offset: .15 }, { transform: `translate(${x - b}px, ${y + b}px)`, opacity: 1, offset: .75 }, { transform: `translate(${x - b}px, ${y + b}px)`, opacity: 0 }], 1900);
  tourLoop(tourDots[1], [{ transform: `translate(${x + a}px, ${y - a}px)`, opacity: 0 }, { transform: `translate(${x + a}px, ${y - a}px)`, opacity: 1, offset: .15 }, { transform: `translate(${x + b}px, ${y - b}px)`, opacity: 1, offset: .75 }, { transform: `translate(${x + b}px, ${y - b}px)`, opacity: 0 }], 1900);
}
// little labels on the buttons being shown, in one straight row (above them, or below for things at the top), nudged apart where they'd touch
function tourTags(names, below){
  const box = TT.querySelector('.tags'); box.innerHTML = '';
  const items = [];
  Object.entries(names).forEach(([id, n]) => {
    const el = document.getElementById(id); if (!el) return;
    const e = el.getBoundingClientRect(), tag = document.createElement('span'); tag.textContent = n; box.appendChild(tag);
    items.push({ tag, cx: e.left + e.width / 2, y: below ? e.bottom + 32 : e.top - 10 });
  });
  if (!items.length) return;
  items.sort((p, q) => p.cx - q.cx);
  const gap = 6; items.forEach(it => { it.w = it.tag.offsetWidth; it.x = it.cx - it.w / 2; });
  for (let pass = 0; pass < 30; pass++){
    let moved = false;
    for (let i = 1; i < items.length; i++){ const p = items[i - 1], q = items[i], ov = p.x + p.w + gap - q.x; if (ov > .5){ p.x -= ov / 2; q.x += ov / 2; moved = true; } }
    if (!moved) break;
  }
  const minX = Math.min(...items.map(i => i.x)), maxX = Math.max(...items.map(i => i.x + i.w));
  const shift = minX < 8 ? 8 - minX : maxX > W - 8 ? W - 8 - maxX : 0;
  const y = below ? Math.max(...items.map(i => i.y)) : Math.min(...items.map(i => i.y));
  items.forEach((it, k) => { it.tag.style.left = (it.x + shift + it.w / 2) + 'px'; it.tag.style.top = y + 'px'; setTimeout(() => it.tag.classList.add('on'), 120 + k * 90); });
}
// the tutorial plays itself, like a show-and-tell: the hand really does each thing while a caption explains it
let demo = null, handXY = null;
const DEMO_N = 10;
// the tour moves on when you're ready: Next glows once a step has finished showing itself
const waitNext = () => new Promise((res, rej) => {
  if (!demo || demo.stop) return rej('stop');
  const nx = tourTip.querySelector('.next'); nx.hidden = false; nx.textContent = t('next'); nx.classList.add('glow');
  demo.go = () => { demo.go = demo.cancel = null; nx.classList.remove('glow'); nx.hidden = true; res(); };
  demo.cancel = () => { demo.go = demo.cancel = null; rej('stop'); };
});
const demoWait = async ms => { for (let left = ms; left > 0;){ if (!demo || demo.stop) throw 'stop'; await new Promise(r => setTimeout(r, 60)); if (demo && !demo.paused) left -= 60; } };
function demoCap(i, head, body){
  tourTip.querySelector('.n').textContent = t('tourOf', { i, n: DEMO_N });
  tourTip.querySelector('h3').textContent = t(head); tourTip.querySelector('p').textContent = t(body);
}
function spotEl(el, pad = 10, round = false, lift = 0){ const r = el.getBoundingClientRect(); spotAt(r.left + r.width / 2, r.top + r.height / 2, r.width + pad * 2, r.height + pad * 2, round, lift); return r; }
const spotAll = () => spotAt(W / 2, H / 2, W * 3, H * 3);
async function handTap(x, y){
  tourHand.style.opacity = 1;
  const from = handXY || { x: x + 70, y: y + 110 };
  const mv = tourHand.animate([{ transform: handAt(from.x, from.y) }, { transform: handAt(x, y) }], { duration: 650, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' });
  tourAnims.push(mv); await Promise.race([mv.finished.catch(() => {}), demoWait(900).catch(() => {})]); handXY = { x, y };
  await demoWait(150);
  const pr = tourHand.animate([{ transform: handAt(x, y) + ' scale(1)' }, { transform: handAt(x, y) + ' scale(.84)' }, { transform: handAt(x, y) + ' scale(1)' }], { duration: 320, fill: 'forwards' });
  tourAnims.push(pr); await Promise.race([pr.finished.catch(() => {}), demoWait(500).catch(() => {})]);
}
const handAway = () => { tourHand.style.opacity = 0; handXY = null; };
function zoomTo(target, ms){
  if (document.hidden){ cam.s = target; return Promise.resolve(); }
  return new Promise(res => {
    const guard = setTimeout(() => { cam.s = target; res(); }, ms * 3 + 1500);
    const s0 = cam.s; let el = 0, last = performance.now();
    const step = now => {
      if (!demo || demo.stop) return res();
      if (!demo.paused) el += now - last; last = now;
      const u = Math.min(1, el / ms), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      cam.s = s0 * Math.pow(target / s0, e);
      if (u < 1) requestAnimationFrame(step); else { clearTimeout(guard); res(); }
    };
    requestAnimationFrame(step);
  });
}
// climb back out, the way a pinch would, until you're home in the world you started from
function climbTo(T){
  if (document.hidden){ while (cur !== T && stack.length) pop(); cam.s = fitS(); leadsBack(); return Promise.resolve(); }
  return new Promise(res => {
    let last = performance.now();
    const finish = () => { clearTimeout(guard); if (cur === T) cam.s = Math.max(cam.s, fitS()); res(); };
    const guard = setTimeout(() => { while (cur !== T && stack.length) pop(); cam.s = fitS(); finish(); }, 14000);
    const step = now => {
      if (!demo || demo.stop) return finish();
      const dt = now - last; last = now;
      if (!demo.paused) cam.s *= Math.pow(.94, dt / 16.7);
      if (cur === T && cam.s <= fitS() * 1.01){ cam.s = fitS(); return finish(); }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
async function waitArticle(){ for (let i = 0; i < 70; i++){ if (rArt.querySelector('a[data-t]')) return true; await demoWait(120); } return false; }
async function runDemo(){
  const s0 = cam.s, keep = { T: cur, next: cur.next, jump: cur.jump };
  try {
    // 1. falling in (the camera really dives towards the door, then comes back)
    demoCap(1, 'fallT', touchy ? 'fallTouch' : 'fallMouse');
    const r = clamp(cur.RH * cam.s * 1.25, 46, Math.min(W, H) * .3);
    spotAt(CX, CY, r * 2, r * 2); touchy ? showPinch(CX, CY, r) : showHold(CX, CY);
    await demoWait(900);
    spotAll();
    await zoomTo(Math.max(cam.s, Math.min(cam.s * 2.6, halfDiag() / (cur.RH * 2.3))), 1500);
    await demoWait(600); await zoomTo(s0, 1200);
    stopAnims(); await waitNext();
    const pick = tourBubble();
    if (pick){
      // 2. tapping an orb opens its tile
      demoCap(2, 'tapT', 'tapD');
      const pp = pick.p, d = Math.max(pp.r * 2.7, 60); spotAt(pp.x, pp.y, d, d);
      await demoWait(700); await handTap(pp.x, pp.y);
      choose(pick.h); await demoWait(450); handAway();
      demoCap(2, 'tapT', 'tileD'); spotEl(card, 8);
      await demoWait(600); await waitNext();
      // 3. the whole article, without leaving
      demoCap(3, 'readT', 'readD');
      const rb = spotEl($('#cardWiki'), 10); await demoWait(700);
      await handTap(rb.left + rb.width / 2, rb.top + rb.height / 2);
      openReader(card.querySelector('h2').textContent); handAway(); spotAll();
      await waitArticle(); await demoWait(1000);
      rBody.scrollTo({ top: 240, behavior: 'smooth' }); await demoWait(900); await waitNext();
      // 4. deeper: a link inside the article
      const link = [...rArt.querySelectorAll('a[data-t]')].find(x => { const q = x.getBoundingClientRect(); return q.top > 120 && q.bottom < H - 150 && q.width > 16; });
      if (link){
        demoCap(4, 'deeperT', 'deeperD');
        const lr = spotEl(link, 6); await demoWait(800);
        await handTap(lr.left + Math.min(lr.width / 2, 40), lr.top + lr.height / 2);
        openReader(link.getAttribute('data-t')); handAway(); spotAll();
        await waitArticle(); await demoWait(600); await waitNext();
        // 5. and back out: one article back, then all the way to the world
        demoCap(5, 'backT', 'backD');
        const pb = reader.querySelector('.prev');
        if (!pb.hidden){ const q = spotEl(pb, 8, true); await demoWait(700); await handTap(q.left + q.width / 2, q.top + q.height / 2); pb.click(); await waitArticle(); await demoWait(1300); }
      } else demoCap(5, 'backT', 'backD');
      const hb = reader.querySelector('.home'), q2 = spotEl(hb, 8); await demoWait(700);
      await handTap(q2.left + q2.width / 2, q2.top + q2.height / 2);
      closeReader(); handAway(); await demoWait(500); await waitNext();
      // 6. back in the world, the tile's still there: dive in, through the door, into that orb's own world
      const dg = $('#cardDig');
      if (card.classList.contains('on') && !dg.hidden){
        demoCap(6, 'diveT', 'diveDemo');
        const q3 = spotEl(dg, 8); await demoWait(900);
        await handTap(q3.left + q3.width / 2, q3.top + q3.height / 2);
        handAway(); spotAll();
        const d0 = stack.length; diveNow();
        for (let i = 0; i < 90 && stack.length === d0; i++) await demoWait(100);
        if (stack.length === d0 && nextOf(cur) && nextOf(cur).status === 'ready'){ falling = diving = false; push(); cam.s = halfDiag() / (R0 * .9); }
        await demoWait(1200); await waitNext();
        // 7. every world goes on and on: another orb, another world
        document.getElementById('arrive').classList.remove('on');
        demoCap(7, 'wideT', 'wideD');
        const pick2 = tourBubble();
        if (pick2){
          const p2 = pick2.p, d2 = Math.max(p2.r * 2.7, 60); spotAt(p2.x, p2.y, d2, d2);
          await demoWait(800); await handTap(p2.x, p2.y);
          choose(pick2.h); await demoWait(450); handAway(); spotEl(card, 8);
          await demoWait(600); await waitNext(); card.classList.remove('on');
        } else await waitNext();
        // 8. pinch back out: the door twists shut and you're home
        demoCap(8, 'outT', touchy ? 'outTouch' : 'outMouse');
        spotAll(); showPinchIn(CX, CY, Math.min(W, H) * .22);
        await demoWait(700); await climbTo(keep.T);
        await demoWait(700); stopAnims(); await waitNext();
      } else card.classList.remove('on');
      spotAll(); await demoWait(500);
    }
    // 9. free roam
    demoCap(9, 'tFreeT', 'tFreeD'); spotEl($('#seekWrap'), 12); tourTags({ langBtn: t('tagLang'), seekBtn: t('tagSearch') }, true);
    await demoWait(400); await waitNext(); stopAnims();
    // 10. game play, and the end
    demoCap(10, 'tGameT', 'tGameD');
    const bb = $('#btns').getBoundingClientRect(); spotAt(bb.left + bb.width / 2, bb.top + bb.height / 2, bb.width + 24, bb.height + 20, false, 62);
    tourTags({ gameBtn: t('tagGame'), dice: t('tagRandom'), sound: t('tagSound'), helpBtn: t('tagHelp') });
    demo.done = true;
    tourTip.querySelector('.back').textContent = t('replay');
    const nx = tourTip.querySelector('.next'); nx.hidden = false; nx.textContent = t('startExploring'); nx.classList.add('glow');
  } catch (e) { if (e !== 'stop') console.error(e); }
  finally {
    // back to the beginning: the hole points where it did before the demo
    if (keep.T === cur){ cur.next = keep.next; cur.jump = keep.jump; showNow(); }
  }
}
function demoStart(){
  if (demo) demo.stop = true;
  demo = { stop: false, paused: false, done: false };
  stopAnims(); handAway();
  if (!reader.classList.contains('gone')) closeReader(); card.classList.remove('on');
  tourTip.querySelector('.next').hidden = true;
  const b = tourTip.querySelector('.back'); b.hidden = true;
  runDemo();
}
function startTour(){
  if (game.on) return endOnboard();
  track('tutorial');
  hideFront(); document.body.classList.add('onboard');
  const go = () => { tourOn = true; TT.classList.remove('gone'); demoStart(); };
  if (cur && cur.status === 'ready') go(); else { const w = setInterval(() => { if (cur && cur.status === 'ready'){ clearInterval(w); go(); } }, 150); }
}
function endTour(){
  if (demo && demo.cancel) demo.cancel();
  if (demo) demo.stop = true; demo = null; tourOn = false;
  stopAnims(); handAway(); TT.classList.add('gone');
  if (!reader.classList.contains('gone')) closeReader(); card.classList.remove('on');
  endOnboard();
}
tourTip.querySelector('.next').onclick = () => { if (demo && demo.go) return demo.go(); endTour(); };
tourTip.querySelector('.skip').onclick = endTour;
// Pause / Play while it runs; Replay once it's finished
tourTip.querySelector('.back').onclick = () => {
  if (!demo) return;
  if (demo.done){ tourTip.querySelector('.back').hidden = true; return demoStart(); }
  demo.paused = !demo.paused;
  tourTip.querySelector('.back').textContent = demo.paused ? t('play') : t('pause');
  tourAnims.forEach(x => { try { demo.paused ? x.pause() : x.play(); } catch (e) {} });
};
let seenIntro = false; try { seenIntro = !!localStorage.getItem('rh-intro-seen'); } catch (e) {}
// every start: the intro, then what Rabbit Hole is, then (if chosen) the tour
// a topic link (?w=Octopus) skips the intro and the card and goes straight into that world
if (CHAL || LINK){ dropPre(); aboutAuto = true; }
else startIntro();   // the intro opens every start (it's skippable), then the "What is" card
Promise.race([langReady, new Promise(r => setTimeout(r, 2500))]).then(() => document.fonts.load('20px "Patrick Hand"')).finally(() => {
  if (CHAL){   // a challenge link: land in the start world, then go straight to the goal card
    frame(); openWorld(CHAL.daily ? randomWorld() : topic(CHAL.s)); track(CHAL.daily ? 'daily-link' : 'challenge-link');
    const w = setInterval(() => { if (!cur || cur.status !== 'ready' || document.getElementById('loading').classList.contains('on')) return; clearInterval(w); startGame(CHAL.daily ? { daily: true } : { challenge: CHAL }); }, 150);
  }
  else if (LINK){ frame(); enterWorld(LINK.w); setTimeout(() => prepareRound(false, game.level), 6000); track('topic-link'); }
  else { openWorld(randomWorld()); frame(); }
});
setTimeout(() => $('#hint').classList.add('gone'), 14000);
if (FEEDBACK_URL){
  const fb = $('#aboutFeedback'), sheet = $('#fbSheet'), frame = sheet.querySelector('iframe');
  fb.href = FEEDBACK_URL; fb.hidden = false;
  // the form opens over Rabbit Hole (loaded only when asked for); ctrl/cmd-click still opens it in a new tab
  fb.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); track('feedback');
    if (!frame.src) frame.src = FEEDBACK_URL.replace('/r/', '/embed/') + '?alignLeft=1&hideTitle=0';
    sheet.hidden = false;
  });
  const shut = () => { sheet.hidden = true; };
  sheet.querySelector('.back').onclick = shut; sheet.querySelector('.x').onclick = shut;
  sheet.addEventListener('click', e => { if (e.target === sheet) shut(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) shut(); });
}
if (GOAT && location.protocol === 'https:'){ const sc = document.createElement('script'); sc.async = true; sc.src = 'https://gc.zgo.at/count.js'; sc.dataset.goatcounter = `https://${GOAT}.goatcounter.com/count`; document.head.appendChild(sc); }
window.__rh = { nextRound, prepareRound, isDry, cam, game, get cur(){ return cur; }, get stack(){ return stack; }, topic, tick, run(n){ for (let i = 0; i < n; i++) tick(); return { cur: cur && cur.name, depth: stack.length, s: +cam.s.toFixed(4), next: cur && nextOf(cur) && nextOf(cur).title, status: cur && cur.status }; }, choose, hit };

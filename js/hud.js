'use strict';
/* ─────────── hud ─────────── */
const $ = s => document.querySelector(s);
function moved(){
  $('#hint').classList.add('gone');
  const path = stack.concat(cur), from = Math.max(0, path.length - 6);
  $('#trail').innerHTML = (from ? '… → ' : '') + path.slice(from).map((T, j) => { const i = from + j; return i === path.length - 1 ? `<b>${esc(T.name)}</b>` : `<a data-i="${i}">${esc(T.name)}</a>`; }).join('<span class="chev">›</span>') + ` <span style="color:#6a6a6a">· ${path.length - 1} deep</span>`;
  showNow(); ensurePapers(cur);
}
function showNow(){ const nx = cur && nextOf(cur);
  if (game.on && game.goal){
    const left = game.allowed - game.used, g = `goal: <a class="goal" href="#" onclick="showGoal();return false">${game.clue ? 'a mystery' : esc(game.goal.name)}</a>`;
    $('#now').innerHTML = `<div class="w">${esc(cur.name)}</div><div class="n">${g} · <b>${left}</b> of ${game.allowed} worlds left</div>`;
    return;
  }
  $('#now').innerHTML = !cur ? '' : `<div class="w" dir="auto">${esc(cur.name)}</div>${nx && (cur.chosen || cur.jump) ? `<div class="n">${esc(t('leadsTo'))} <span class="next" dir="auto">${esc(nx.title)}</span></div>` : ''}`; }
function payToClimb(){ if (!game.on || !game.climbCost || game.over || !stack.length) return true; if (game.used >= game.allowed){ openCard(cur.title, 'no worlds left to climb with'); return false; } game.used++; game.picks.push('↑'); return true; }
$('#trail').addEventListener('click', e => { const i = e.target.getAttribute && e.target.getAttribute('data-i'); if (i == null || (game.on && !game.over)) return; if (!payToClimb()) return; cur = stack[+i]; stack = stack.slice(0, +i); cam.s = fitS(); moved(); leadsBack(); });
function hit(mx, my){
  // walk down through the holes to find which topic, and which thing, is under the pointer
  let T = cur, s = cam.s, dx = mx - CX, dy = my - CY; const c = Math.cos(cam.phi), sn = Math.sin(cam.phi);
  let x = (dx * c - dy * sn) / s, y = (dx * sn + dy * c) / s;
  // only the world in front of you can be touched: nothing behind a shut door answers, and once the next world has
  // opened up in front of you (the one you're leaving has greyed out), that one takes over
  const mn = Math.min(W, H);
  for (let d = 0; d < 4; d++){
    const ch = nextOf(T), ahead = ch && ch.status === 'ready' && T.RH * s >= mn * .5;
    if (Math.hypot(x, y) < T.RH){ if (ahead){ x *= T.K; y *= T.K; s /= T.K; T = ch; continue; } return null; }
    if (ahead) return null;
    { let best = -1, bd = 1e9; const reach = 22 / s; for (let i = 0; i < T.items.length; i++){ const it = T.items[i], R = it.r * BUMP(); if (R * s < 3 || (game.on && it.paper)) continue; const d = Math.hypot(x - it.x, y - it.y), lim = Math.max(R * 1.15, reach); if (d < lim && d / lim < bd){ bd = d / lim; best = i; } } if (best >= 0) return { T, i: best, it: T.items[best] }; }
    return null;
  }
  return null;
}
const tip = $('#tip');
let hoverT = 0, hoverFor = null;
function hover(e){ const h = hit(e.clientX, e.clientY); hovered = h ? h.it : null; if (h && hoverFor !== h.it){ hoverFor = h.it; clearTimeout(hoverT); hoverT = setTimeout(() => { if (hovered === h.it && !h.it.paper) wantNow(topic(h.it.title)); }, 350); } cv.classList.toggle('over', !!h); if (!h){ tip.classList.remove('on'); return; } tip.innerHTML = h.it.whimsy && h.it.title !== 'White Rabbit' ? `these aren't real… or are they?<i>click to find out</i>` : `${esc(h.it.title)}<i>${esc(h.it.desc || 'click to send the hole here')}</i>`; tip.style.transform = `translate(${Math.min(e.clientX + 16, W - 310)}px, ${e.clientY + 18}px)`; tip.classList.add('on'); }
const card = $('#card'); let cardTok = 0;
card.querySelector('.x').onclick = () => { card.classList.remove('on'); if (game.on && !game.started) startPlay(); };
let cardDiveT = 0;
function diveNow(){ SFX.enter(); quietPush = true; setTimeout(() => quietPush = false, 4000); clearTimeout(cardDiveT); card.classList.remove('on'); $('#cardDig').classList.remove('counting'); beginDive(); $('#fall').classList.add('on'); }
$('#cardDig').onclick = diveNow;
card.querySelector('.x').addEventListener('click', () => { clearTimeout(cardDiveT); $('#cardDig').classList.remove('counting'); });
function choose(h){
  if (h.it.paper){ if (!game.on) openPaper(h.it); return; }   // a paper opens its tile; it isn't a world, so the hole doesn't move
  if (game.on){
    if (game.over) return;
    if (!game.started) startPlay();
    h.T.picked = true;          // opening tiles is free (that's the homework): only entering a world uses one up
  }
  h.T.next = h.i; h.T.jump = null; h.T.chosen = true; { const nt = topic(h.it.title); digNow(nt); wantNow(nt); } showNow();
  SFX.pick();
  const trail = [...stack, cur]; if (h.T !== cur) trail.push(h.T);
  if (game.on && game.goal && h.it.title === game.goal.title){
    // found it: its tile says so, in gold, and entering its world wins
    openCard(h.it.title, 'your goal is here!', false, trail);
    const dg = $('#cardDig'); dg.hidden = false; dg.classList.add('win'); dg.textContent = t('goalIn');
    return;
  }
  if (game.on){ openCard(h.it.title, 'the hole now leads here', false, trail); return; }
  openCard(h.it.title, h.it.whimsy && h.it.title !== 'White Rabbit' ? 'a legend — or is it? the hole now leads here' : h.T === cur ? t('holeHere') : t('inside', { name: h.T.name }), false, trail);
}
// hide every word of the goal's name inside its own description
function maskName(text){
  const words = game.goal.name.replace(/\s*\(.*\)$/, '').split(/[\s,-]+/).filter(w => w.length > 2).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return words.reduce((t, w) => t.replace(new RegExp('\\b' + w + '\\w*', 'gi'), '▢▢▢'), text || '');
}
async function openClue(){
  $('#cardGo').hidden = true; stopSay(); showPath(); $('#arrive').classList.remove('on');
  const tok = ++cardTok, s = await summary(game.goal.title); if (tok !== cardTok) return;
  card.classList.add('on'); clearTimeout(cardDiveT); $('#cardDig').classList.remove('counting');
  card.querySelector('.k').textContent = 'your goal, a mystery'; card.querySelector('h2').textContent = 'find this';
  card.querySelector('.d').textContent = maskName(s && s.description || game.goal.desc);
  card.querySelector('p').textContent = maskName(s && s.extract ? s.extract.split(/(?<=\.)\s/).slice(0, 2).join(' ') : '');
  const im = card.querySelector('img'); im.classList.add('blur'); im.hidden = game.noPic || !(s && s.thumbnail); if (!im.hidden) im.src = s.thumbnail.source;
  $('#cardDig').hidden = true; $('#cardWiki').hidden = true; $('#cardAlt').hidden = true;
}
// path: the worlds passed through to get here (orb taps only), shown under the kicker
// read aloud: the device's own voice (free, works offline), in the language you're exploring in
const SAY = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window ? window.speechSynthesis : null;
let sayVoice = null;
function pickVoice(){
  if (!SAY) return;
  // never the robotic or novelty voices some systems ship (macOS has "Bubbles", "Zarvox"…)
  const NOVELTY = /espeak|\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|kathy|organ|princess|ralph|superstar|trinoids|whisper|wobble|zarvox|fred|grandma|grandpa|rocko|shelley|sandy|flo|eddy|reed)\b/i;
  const mine = SAY.getVoices().filter(v => (v.lang || '').toLowerCase().startsWith(LANG) && !NOVELTY.test(v.name));
  // the most natural-sounding voice the device has: Microsoft's online "Natural" voices, Apple's Premium/Enhanced Siri voices, Google's online voices
  const rank = v => (/online.*natural|natural.*online/i.test(v.name) ? 8 : 0) + (/premium/i.test(v.name) ? 7 : 0) + (/enhanced|neural|natural|siri/i.test(v.name) ? 5 : 0)
    + (/google/i.test(v.name) ? 3 : 0) + (/samantha|daniel|karen|serena|moira|arthur|martha|microsoft/i.test(v.name) ? 2 : 0) + (!v.localService ? 1 : 0) + (LANG === 'en' && /en-gb/i.test(v.lang) ? 1 : 0);
  sayVoice = mine.sort((a, b) => rank(b) - rank(a))[0] || null;
}
if (SAY){ pickVoice(); if (SAY.addEventListener) SAY.addEventListener('voiceschanged', pickVoice); $('#cardSay').hidden = false; }
function stopSay(){ if (SAY) SAY.cancel(); const b = $('#cardSay'); b.classList.remove('on'); b.setAttribute('aria-label', t('readAloud')); b.title = t('readAloud'); }
function sayCard(){
  if (!SAY) return;
  const b = $('#cardSay'); if (b.classList.contains('on')) return stopSay();
  const text = [card.querySelector('h2').textContent, card.querySelector('.d').textContent, card.querySelector('p').textContent]
    .map(x => (x || '').replace(/▢▢▢/g, t('mystery')).trim()).filter(x => x && x !== t('lookingUp')).join('. ');
  if (!text) return;
  SAY.cancel();
  // a sentence at a time: some browsers cut a single long utterance off part-way
  const parts = text.replace(/\s+/g, ' ').split(/(?<=[.!?。])\s+/).filter(Boolean);
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part);
    if (sayVoice){ u.voice = sayVoice; u.lang = sayVoice.lang; } else u.lang = LANG;
    u.rate = .95; u.pitch = 1;
    if (i === parts.length - 1) u.onend = () => stopSay();
    u.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled') stopSay(); };
    SAY.speak(u);
  });
  b.classList.add('on'); b.setAttribute('aria-label', t('stopReading')); b.title = t('stopReading'); track('read-aloud');
}
$('#cardSay').onclick = sayCard;
// closing the tile, or opening another, stops the voice
new MutationObserver(() => { if (!card.classList.contains('on')) stopSay(); }).observe(card, { attributes: true, attributeFilter: ['class'] });
function showPath(path){
  const el = card.querySelector('.path'), names = (path || []).map(T => T.name || T.title);
  el.hidden = !names.length; if (!names.length) return;
  const shown = names.length > 4 ? ['…', ...names.slice(-3)] : names;
  el.innerHTML = shown.map((n, i) => i === shown.length - 1 ? `<b>${esc(n)}</b>` : esc(n)).join(' › ') + ' ›';
}
function openPaper(it){
  const p = it.paper; cardTok++; cardCtx = { kind: 'paper', lang: LANG, title: p.title, url: p.doi || p.url, authors: p.authors, more: p.more, year: p.year, venue: p.venue, doi: p.doi, desc: '', trail: trailNames() }; $('#cardPin').hidden = false; nbMarks(); stopSay(); showPath(); $('#arrive').classList.remove('on'); clearTimeout(cardDiveT);
  $('#cardLink').hidden = true; $('#cardGo').hidden = true; $('#cardDig').hidden = true; card.querySelector('img').hidden = true; card.querySelector('img').classList.remove('blur');
  card.classList.add('on'); card.querySelector('.k').textContent = t('paperKicker'); card.querySelector('h2').textContent = p.title;
  card.querySelector('.d').textContent = [authorLine(p), p.year, p.venue].filter(Boolean).join(' · ');
  const b = card.querySelector('.badges'); b.hidden = false; b.replaceChildren();
  const tag = (txt, cls) => { const x = document.createElement('span'); x.textContent = txt; if (cls) x.className = cls; b.append(x); };
  if (p.review) tag(t('review'), 'rv'); tag(t('cites', { n: p.cites.toLocaleString() })); if (p.oa) tag(t('openAccess'), 'oa');
  card.querySelector('p').textContent = p.abs ? p.abs + (p.abs.length >= 1600 ? '…' : '') : '';
  for (const tp of p.topics || []){ const x = document.createElement('span'); x.textContent = tp; x.className = 'tp'; b.append(x); }
  const a = $('#cardWiki'); a.hidden = false; a.href = p.url; a.textContent = (p.oa ? t('readPaper') : t('viewPaper')) + ' ↗';
  const g = $('#cardAlt'); g.hidden = false; g.href = 'https://scholar.google.com/scholar?q=' + encodeURIComponent(p.title); g.textContent = t('scholar') + ' ↗';   // a way in when a publisher's page won't load
  track('paper');
}
// topic links: the address of a world is ?w=<title>&l=<language>, so it can be shared, bookmarked or embedded
const topicUrl = title => (!window.Capacitor && /^(localhost|127\.0\.0\.1|)$/.test(location.hostname) ? location.href.split(/[?#]/)[0] : SITE) + '?' + new URLSearchParams({ w: title, l: LANG });
function syncUrl(T){ if (game.on || chalHold || !T || T.box || !T.title) return; try { history.replaceState(null, '', '?' + new URLSearchParams({ w: T.title, l: LANG })); } catch (e) {} }
$('#cardLink').onclick = async () => {
  const b = $('#cardLink'), title = $('#card h2').textContent || b.dataset.title, url = topicUrl(b.dataset.title || title);
  try { if (navigator.share && matchMedia('(pointer:coarse)').matches) await navigator.share({ title, url }); else await navigator.clipboard.writeText(url); } catch (e) { return; }
  track('link'); b.classList.add('done'); b.title = b.ariaLabel = t('linkCopied'); setTimeout(() => { b.classList.remove('done'); b.title = b.ariaLabel = t('copyLink'); }, 1600);
};
async function openCard(title, kicker, autoDive, path){
  cardCtx = { kind: 'article', lang: LANG, title, url: wikiUrl(title), trail: (path || stack.concat(cur)).filter(T => T && !T.box).map(T => T.name || T.title) }; $('#cardPin').hidden = game.on; nbMarks();
  $('#cardLink').hidden = game.on; $('#cardLink').dataset.title = title; card.querySelector('.badges').hidden = true; $('#cardWiki').textContent = t('read');
  $('#cardGo').hidden = true; $('#cardDig').classList.remove('win'); stopSay(); showPath(path); $('#arrive').classList.remove('on');   // a tile always takes over from the welcome card
  card.querySelector('img').classList.remove('blur'); $('#cardWiki').hidden = false; $('#cardAlt').hidden = true;
  const tok = ++cardTok, dig = $('#cardDig');
  clearTimeout(cardDiveT); dig.classList.remove('counting');
  card.classList.add('on'); card.querySelector('.k').textContent = kicker; dig.hidden = kicker === 'your goal' || kicker === t('randomWorld') || /no clicks left/.test(kicker); dig.textContent = t('diveIn');
  if (autoDive){ void dig.offsetWidth; dig.classList.add('counting'); cardDiveT = setTimeout(diveNow, 4500); } card.querySelector('h2').textContent = title; card.querySelector('.d').textContent = ''; card.querySelector('p').textContent = t('lookingUp'); card.querySelector('img').hidden = true;
  $('#cardWiki').href = WIKI() + '/wiki/' + encodeURIComponent(title.replace(/ /g, '_'));
  let s = await summary(title); if (tok !== cardTok) return;
  if (!s){ await sleep(1500); if (tok !== cardTok) return; s = await summary(title); if (tok !== cardTok) return; }
  if (!s){ card.querySelector('p').textContent = t('noEntry'); return; }
  card.querySelector('h2').textContent = s.title; card.querySelector('.d').textContent = s.description || ''; card.querySelector('p').textContent = s.extract || '';
  if (s.thumbnail){ const im = card.querySelector('img'); im.src = s.thumbnail.source; im.hidden = false; }
  if (s.content_urls) $('#cardWiki').href = s.content_urls.desktop.page;
  cardCtx.title = s.title || title; cardCtx.desc = s.description || ''; if (s.content_urls) cardCtx.url = s.content_urls.desktop.page; nbMarks();
}

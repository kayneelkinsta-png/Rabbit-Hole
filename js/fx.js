'use strict';
/* ─────────── falling ─────────── */
/* ─────────── arriving: the world's name floats in ─────────── */
let arriveT = 0;
// the welcome card never sits on top of an open tile (like the game's goal); it waits until the tile closes
let arriveLater = null;
new MutationObserver(() => {
  if (!arriveLater || document.getElementById('card').classList.contains('on')) return;
  const [T, k] = arriveLater; arriveLater = null;
  if (T === cur) setTimeout(() => arrive(T, k), 250);
}).observe(document.getElementById('card'), { attributes: true, attributeFilter: ['class'] });
function arrive(T, kicker = t('welcome')){
  if (!T || T.box) return;
  syncUrl(T);
  if (document.getElementById('card').classList.contains('on')){ arriveLater = [T, kicker]; return; }
  const a = document.getElementById('arrive');
  a.querySelector('.k').textContent = kicker;
  a.querySelector('.t').textContent = T.name;
  const d = T.desc || ''; a.querySelector('.d').textContent = d ? d.charAt(0).toUpperCase() + d.slice(1) : '';
  a.classList.remove('on'); void a.offsetWidth; a.classList.add('on');
  clearTimeout(arriveT); arriveT = setTimeout(() => a.classList.remove('on'), 3600);
}
/* ─────────── sound: recorded effects (ElevenLabs) where we have them, synthesised ones as the fallback ─────────── */
const SFX = (() => {
  let ac = null, on = true;
  try { on = localStorage.getItem('rh-sound') !== 'off'; } catch (e) {}
  const A = () => { if (!ac){ try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (ac.state === 'suspended') ac.resume(); return ac; };
  function tone(f, t0, dur, type = 'sine', vol = .16){ const a = A(); if (!a || !on) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0; o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .05); }
  function whoosh(){ const a = A(); if (!a || !on) return; const n = Math.floor(a.sampleRate * .75), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime; src.buffer = buf; f.type = 'bandpass'; f.Q.value = 1.1; f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(2400, t + .28); f.frequency.exponentialRampToValueAtTime(380, t + .7); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.2, t + .14); g.gain.exponentialRampToValueAtTime(.0001, t + .72); src.connect(f).connect(g).connect(a.destination); src.start(t); }
  // recordings: fetched quietly after the page settles, decoded on the first tap (browsers allow sound only after one),
  // trimmed of silence, and matched in loudness so no sound jumps out
  // [file, loudness it's matched to, longest it may run]: the tap is just its click (the file's tail is hiss that boosting turned into fuzz)
  const FILES = { tap: ['sounds/tap.mp3', .1, .12], fall: ['sounds/whoosh-short.mp3', .42], enter: ['sounds/whoosh-cinematic.mp3', .48], intro: ['sounds/intro.mp3', .5] };
  const raw = {}, rec = {}; let decoded = false;
  const fetchRec = k => fetch(FILES[k][0]).then(r => r.ok ? r.arrayBuffer() : null).then(b => { if (b){ raw[k] = b; if (ac) decode(); } }).catch(() => {});
  fetchRec('intro');   // the intro's music straight away; the rest once the page has settled
  setTimeout(() => ['tap', 'fall', 'enter'].forEach(fetchRec), 2500);
  function decode(){
    const a = ac; if (!a) return;
    for (const k in raw){ const b = raw[k]; delete raw[k];
      a.decodeAudioData(b).then(buf => {
        let st = buf.length, en = 0, peak = 0;
        for (let c = 0; c < buf.numberOfChannels; c++){ const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++){ const v = Math.abs(d[i]); if (v > peak) peak = v; } }
        const gate = peak * .02;
        for (let c = 0; c < buf.numberOfChannels; c++){ const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > gate){ if (i < st) st = i; if (i > en) en = i; } }
        st = Math.max(0, st - 64); en = Math.min(buf.length, en + Math.round(buf.sampleRate * .06));
        if (FILES[k][2]) en = Math.min(en, st + Math.round(buf.sampleRate * FILES[k][2]));
        const n = Math.max(1, en - st), fadeIn = Math.min(n, Math.round(buf.sampleRate * .002)), fadeOut = Math.min(n, Math.round(buf.sampleRate * (FILES[k][2] ? .04 : .03)));
        const out = a.createBuffer(buf.numberOfChannels, n, buf.sampleRate), rev = a.createBuffer(buf.numberOfChannels, n, buf.sampleRate);
        for (let c = 0; c < buf.numberOfChannels; c++){
          const seg = Float32Array.from(buf.getChannelData(c).subarray(st, en));
          for (let i = 0; i < fadeIn; i++) seg[i] *= i / fadeIn;                      // no click at the start
          for (let i = 0; i < fadeOut; i++) seg[n - 1 - i] *= i / fadeOut;            // and a clean ending, rather than cutting off mid-hiss
          out.copyToChannel(seg, c); rev.copyToChannel(seg.slice().reverse(), c);
        }
        rec[k] = { buf: out, rev, gain: Math.min(24, FILES[k][1] / Math.max(peak, 1e-4)) };
      }).catch(() => {});
    }
  }
  function play(k, { vol = 1, rate = 1, reverse = false, from = 0 } = {}){
    const r = rec[k], a = A(); if (!r || !a || !on || from >= r.buf.duration) return null;
    const src = a.createBufferSource(), g = a.createGain(), t = a.currentTime; src.buffer = reverse ? r.rev : r.buf; src.playbackRate.value = rate;
    if (from > 0){ g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(r.gain * vol, t + .15); } else g.gain.value = r.gain * vol;   // joining part-way in: a quick fade rather than a click
    src.connect(g).connect(a.destination); src.start(t, from); return { src, g };
  }
  let music = null;
  let lastTap = 0, lastOut = 0;
  const tap = () => { if (!on) return; const n = performance.now(); if (n - lastTap < 70) return; lastTap = n; if (!play('tap')){ tone(880, 0, .14, 'triangle', .1); tone(1320, .035, .12, 'sine', .05); } };
  return {
    unlock(){ const a = A(); if (a && !decoded){ decoded = true; decode(); } return a; },
    // falling through into the next world; the bigger, cinematic one for arriving somewhere new (dice, search, enter world)
    whoosh(){ if (!play('fall')) whoosh(); },
    enter(){ if (!play('enter')) whoosh(); },
    // climbing back out: the same whoosh played backwards, as the door twists shut behind you
    out(){ const n = performance.now(); if (n - lastOut < 350) return; lastOut = n; play('fall', { reverse: true, vol: .7 }); },
    tap, pick: tap,
    // the intro's music, from wherever the intro has got to, and a gentle fade if the intro is skipped
    music(from = 0){ if (music) return true; music = play('intro', { from }); if (music) music.src.onended = () => { music = null; }; return !!music; },
    musicOut(){ if (!music || !ac) return; const t = ac.currentTime; music.g.gain.cancelScheduledValues(t); music.g.gain.setValueAtTime(music.g.gain.value, t); music.g.gain.linearRampToValueAtTime(0, t + .6); music.src.stop(t + .65); music = null; },
    get ready(){ return !!(ac && ac.state === 'running' && rec.intro); },
    get loaded(){ return Object.fromEntries(Object.entries(rec).map(([k, r]) => [k, { secs: +r.buf.duration.toFixed(2), gain: +r.gain.toFixed(1) }])); },
    chime(){ [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * .09, 1.1, 'sine', .14)); },
    sad(){ tone(392, 0, .4, 'triangle', .12); tone(311.1, .24, .6, 'triangle', .12); },
    get on(){ return on; }, set on(v){ on = v; try { localStorage.setItem('rh-sound', v ? 'on' : 'off'); } catch (e) {} }
  };
})();
['pointerdown', 'keydown', 'wheel'].forEach(ev => addEventListener(ev, () => { if (!SFX.on) return; SFX.unlock(); introMusic(); }, { once: true, passive: true }));
// start the intro's music in step with the intro, as soon as the browser allows sound (it needs a tap first)
function introMusic(){
  let n = 0; const w = setInterval(() => {
    if (!introPlaying || window.rhSkipIntro || ++n > 60){ clearInterval(w); return; }
    if (window.__intro && SFX.ready){ clearInterval(w); if (window.__intro.t < 6) SFX.music(window.__intro.t); }
  }, 100);
}
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button, a, [role=button]')) SFX.tap(); }, true);
let quietPush = false;   // the "enter world" button already played its own whoosh
function push(){ welcomeFor = null; const T = nextOf(cur); if (cur.box) rabbit.state = 'gone'; cam.s /= cur.K; stack.push(cur); cur = T; want(nextOf(cur)); if (diving){ diving = false; falling = false; $('#fall').classList.remove('on'); } moved(); arrive(cur); if (quietPush) quietPush = false; else SFX.whoosh();
  if (game.on && !game.over){ if (!game.started) startPlay(); game.used++; game.picks.push(cur.title); showNow(); settleUntil = performance.now() + 1600; checkGame(); } }

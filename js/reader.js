'use strict';
/* ─────────── reading an article inside Rabbit Hole, with a way back and a way down ─────────── */
const reader = $('#reader'), rBody = reader.querySelector('.body'), rArt = reader.querySelector('article');
const READ = new Map(); let readHist = [];
const wikiUrl = x => WIKI() + '/wiki/' + encodeURIComponent(x.replace(/ /g, '_'));
async function fetchArticle(title){
  if (READ.has(title)) return READ.get(title);
  const j = await q({ action: 'parse', page: title, prop: 'text|displaytitle', redirects: '1', disableeditsection: '1', disabletoc: '1', mobileformat: '1' });
  if (!j.parse) return null;
  const doc = new DOMParser().parseFromString(j.parse.text, 'text/html');
  doc.querySelectorAll('style,link,script,.navbox,.navbox-styles,.mw-editsection,.metadata,.ambox,.sistersitebox,.side-box,.noprint,.reference,.mw-references-wrap,.reflist,.refbegin,.portalbox,.authority-control,.mw-empty-elt,.shortdescription,.hatnote,.mbox-small,.gallery-text').forEach(e => e.remove());
  const cut = [...doc.querySelectorAll('h2')].find(h => h !== doc.querySelector('h2#See_also') && CUT_RE.test(h.textContent.trim()) && !/^(See also|Véase también|Voir aussi|Siehe auch|Ver também|Voci correlate|Zie ook|Zobacz też)/i.test(h.textContent.trim()));
  if (cut){ let n = cut.closest('.mw-heading') || cut.closest('section') || cut; if (n.tagName === 'SECTION'){ let x = n; while (x){ const nx = x.nextElementSibling; x.remove(); x = nx; } } else { while (n.nextSibling) n.nextSibling.remove(); n.remove(); } }
  doc.querySelectorAll('img').forEach(i => { const src = i.getAttribute('src') || ''; if (src.startsWith('//')) i.src = 'https:' + src; const ss = i.getAttribute('srcset'); if (ss) i.setAttribute('srcset', ss.replace(/(^|,\s*)\/\//g, '$1https://')); i.removeAttribute('width'); i.removeAttribute('height'); i.loading = 'lazy'; });
  doc.querySelectorAll('a').forEach(a => {
    const h = a.getAttribute('href') || '';
    if (h.startsWith('/wiki/')){
      let t = ''; try { t = decodeURIComponent(h.slice(6).split('#')[0]).replace(/_/g, ' '); } catch (e) {}
      if (!t || t.includes(':') || a.classList.contains('new')){ a.replaceWith(...a.childNodes); return; }
      a.setAttribute('data-t', t); a.setAttribute('href', wikiUrl(t));
    } else if (/^https?:/.test(h) || h.startsWith('//')){ a.target = '_blank'; a.rel = 'noopener'; if (h.startsWith('//')) a.href = 'https:' + h; }
    else a.replaceWith(...a.childNodes);
  });
  doc.querySelectorAll('iframe,object,embed,form,base,meta,input,button,textarea').forEach(e => e.remove());
  doc.querySelectorAll('*').forEach(e => { for (const at of [...e.attributes]) if (/^on/i.test(at.name) || /^\s*javascript:/i.test(at.value)) e.removeAttribute(at.name); });
  const out = { title: j.parse.title, html: doc.body.innerHTML };
  READ.set(title, out); return out;
}
async function openReader(title, push = true){
  if (push) readHist.push(title);
  reader.classList.remove('gone'); requestAnimationFrame(() => reader.classList.add('on'));
  reader.querySelector('.prev').hidden = readHist.length < 2;
  reader.querySelector('.t').textContent = title;
  reader.querySelector('.ext').href = wikiUrl(title);
  reader.querySelector('.dive').hidden = game.on;
  rArt.innerHTML = `<div class="spin">${esc(t('openingArticle'))}</div>`; rBody.scrollTop = 0;
  const [a, sm] = await Promise.all([fetchArticle(title).catch(() => null), summary(title).catch(() => null)]);
  if (readHist[readHist.length - 1] !== title) return;
  if (!a){ rArt.innerHTML = `<div class="spin">${esc(t('readerFail'))}</div>`; return; }
  reader.querySelector('.t').textContent = a.title;
  reader.dataset.title = a.title;
  rArt.innerHTML = `<h1>${esc(a.title)}</h1>${sm && sm.description ? `<p class="lede">${esc(sm.description)}</p>` : ''}` + a.html;
  reader.querySelector('.credit').innerHTML = t('credit', { wiki: `<a href="${wikiUrl(a.title)}" target="_blank" rel="noopener">${t('wiki')}</a>`, lic: '<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>' });
}
function closeReader(){ reader.classList.remove('on'); readHist = []; setTimeout(() => { if (!reader.classList.contains('on')) reader.classList.add('gone'); }, 380); }
reader.querySelector('.home').onclick = closeReader;
reader.querySelector('.prev').onclick = () => { readHist.pop(); if (readHist.length) openReader(readHist[readHist.length - 1], false); else closeReader(); };
reader.querySelector('.dive').onclick = () => { const t = reader.dataset.title || readHist[readHist.length - 1]; closeReader(); card.classList.remove('on'); if (t) start(t); };
// links inside the article open the next article here too
let gameLink = null;
rArt.addEventListener('click', e => {
  const a = e.target.closest('a[data-t]'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault();
  // mid-game, links in articles don't count as moves: say so, and let the player choose
  if (game.on && !game.over){ gameLink = a.getAttribute('data-t'); reader.querySelector('.gamenote').hidden = false; return; }
  openReader(a.getAttribute('data-t'));
});
reader.querySelector('.gback').onclick = () => { reader.querySelector('.gamenote').hidden = true; gameLink = null; closeReader(); };
reader.querySelector('.gend').onclick = () => { reader.querySelector('.gamenote').hidden = true; exitGame(); reader.querySelector('.dive').hidden = false; if (gameLink) openReader(gameLink); gameLink = null; };
addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!reader.classList.contains('gone')) closeReader(); else if ($('#rules').classList.contains('on')) $('#rules').classList.remove('on'); else if ($('#about').classList.contains('on')) endOnboard(); });
$('#cardWiki').addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey || (typeof cardCtx !== 'undefined' && cardCtx && cardCtx.kind === 'paper')) return;   // a paper's link goes to the paper itself, not into the Wikipedia reader
  e.preventDefault(); openReader(card.querySelector('h2').textContent); });

'use strict';
/* ─────────── the notebook: pin things, keep passages and your own words, with the trail that led there ─────────── */
/* Saved on this device only (no account). An entry is one source (a Wikipedia article or a paper), optionally one passage
   from it, your interpretation, your question, and the worlds you passed through to reach it. */
const NB_KEY = 'rh-notebook';
let NB = { v: 1, q: '', style: 'apa', items: [] };
try { const v = JSON.parse(localStorage.getItem(NB_KEY) || 'null'); if (v && Array.isArray(v.items)) NB = { v: 1, q: v.q || '', style: ['apa', 'mla', 'harvard'].includes(v.style) ? v.style : 'apa', items: v.items }; } catch (e) {}
let nbSaveT = 0;
function nbSave(now){
  clearTimeout(nbSaveT);
  const go = () => { try { localStorage.setItem(NB_KEY, JSON.stringify(NB)); } catch (e) { nbToast(t('nbFull')); } };
  if (now) go(); else nbSaveT = setTimeout(go, 250);
}
addEventListener('pagehide', () => nbSave(true));

// what the tile on screen is about (set by openCard and openPaper), so "add to notebook" knows what to keep
let cardCtx = null;
const trailNames = () => stack.concat(cur).filter(T => T && !T.box).map(T => T.name || T.title);

function nbToast(msg, open){
  const el = $('#nbToast'); el.replaceChildren(document.createTextNode(msg));
  if (open){ const b = document.createElement('button'); b.type = 'button'; b.textContent = ' · ' + t('nbOpen'); b.style.cssText = 'all:unset;cursor:pointer;font-weight:700;text-decoration:underline'; b.onclick = () => { el.classList.remove('on'); nbOpen(open === true ? null : open); }; el.append(b); }
  el.style.pointerEvents = open ? 'auto' : 'none'; el.classList.add('on'); clearTimeout(nbToast.t); nbToast.t = setTimeout(() => el.classList.remove('on'), 3600);
}

// the passage the person has selected inside a given element (tile or reader), if any
function nbSelection(root){
  const s = window.getSelection && getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return '';
  const a = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
  if (!a || !root.contains(a)) return '';
  return s.toString().replace(/\s+/g, ' ').trim().slice(0, 1500);
}

const nbSameSource = (it, c) => it.kind === c.kind && it.lang === c.lang && it.title.toLowerCase() === c.title.toLowerCase();
function nbHas(c){ return !!c && NB.items.some(it => nbSameSource(it, c)); }

// pin something: c is { kind, title, url, lang, authors, more, year, venue, doi, desc }
function nbPin(c, quote){
  if (!c || game.on) return null;
  const dup = NB.items.find(it => nbSameSource(it, c) && (it.quote || '') === (quote || ''));
  if (dup){ nbToast(t('nbAgain'), dup.id); return dup; }
  const first = !NB.items.length;
  const e = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(), kind: c.kind, lang: c.lang, title: c.title, url: c.url, desc: c.desc || '', authors: c.authors || [], more: !!c.more, year: c.year || '', venue: c.venue || '', doi: c.doi || '',
    quote: quote || '', note: '', question: '', trail: c.trail || trailNames() };
  NB.items.unshift(e); nbSave(true); nbCount(); nbMarks();
  nbToast(quote || !first ? t('nbSaved') : t('nbSavedTip'), e.id);
  track('notebook-pin');
  if (document.body.classList.contains('nbopen')) nbRender(e.id);
  return e;
}

/* ─────────── citations (APA 7, MLA 9, Harvard). Generated from what we know: a starting point, not a substitute for checking ─────────── */
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const eh = esc;
const nameParts = n => { const p = String(n).trim().split(/\s+/); const family = p.length > 1 ? p.pop() : p[0]; return { family, given: p.join(' ') }; };
const initials = g => g.split(/[\s-]+/).filter(Boolean).map(x => x[0].toUpperCase() + '.').join(' ');
function nbAuthorText(it, style){
  const L = (it.authors || []).map(nameParts); if (!L.length) return '';
  if (style === 'apa'){ const s = L.map(a => a.given ? `${eh(a.family)}, ${eh(initials(a.given))}` : eh(a.family)); let out = s.length === 1 ? s[0] : s.slice(0, -1).join(', ') + (it.more ? ', … ' : ', & ') + s[s.length - 1]; if (it.more) out = s.join(', ') + ', et al.'; return out; }
  if (style === 'mla'){ if (L.length >= 3 || it.more) return `${eh(L[0].family)}, ${eh(L[0].given)}, et al.`.replace(', ,', ','); const f = `${eh(L[0].family)}, ${eh(L[0].given)}`.replace(/, $/, ''); return L.length === 1 ? f : `${f}, and ${eh(L[1].given)} ${eh(L[1].family)}`.replace('  ', ' '); }
  const s = L.map(a => a.given ? `${eh(a.family)}, ${eh(initials(a.given).replace(/\. /g, '.'))}` : eh(a.family)); return it.more ? s.slice(0, 3).join(', ') + ' et al.' : s.length === 1 ? s[0] : s.slice(0, -1).join(', ') + ' and ' + s[s.length - 1];
}
// returns HTML (with <i> for italics); nbPlain() strips it
function nbCite(it, style = NB.style){
  const d = new Date(it.at), day = d.getDate(), mon = MONTH[d.getMonth()], yr = d.getFullYear(), mon3 = mon.slice(0, 3);
  const url = it.doi || it.url || '', link = url ? eh(url) : '';
  const wiki = it.kind !== 'paper', wname = it.lang && it.lang !== 'en' ? `Wikipedia (${eh((LANGS.find(l => l[0] === it.lang) || [0, it.lang])[1])})` : 'Wikipedia';
  const title = eh(it.title), dotted = /[.?!]$/.test(it.title) ? title : title + '.', bare = title.replace(/\.$/, '');   // titles that already end in a full stop don't get a second
  if (wiki){
    if (style === 'apa') return `${wname} contributors. (n.d.). ${dotted} In <i>${wname}</i>. Retrieved ${mon} ${day}, ${yr}, from ${link}`;
    if (style === 'mla') return `“${dotted}” <i>${wname}</i>, Wikimedia Foundation, ${link}. Accessed ${day} ${mon3}. ${yr}.`;
    return `${wname} (n.d.) <i>${bare}</i>. Available at: ${link} (Accessed: ${day} ${mon} ${yr}).`;
  }
  const au = nbAuthorText(it, style), yrp = it.year || 'n.d.', ven = it.venue ? `<i>${eh(it.venue)}</i>` : '';
  if (style === 'apa') return `${au ? au + ' ' : ''}(${yrp}). ${dotted} ${ven ? ven + '. ' : ''}${link}`.trim();
  if (style === 'mla') return `${au ? au.replace(/\.$/, '') + '. ' : ''}“${dotted}” ${ven ? ven + ', ' : ''}${it.year ? it.year + ', ' : ''}${link}.`.replace(/\.\.$/, '.');
  return `${au ? au + ' ' : ''}(${yrp}) ‘${bare}’${ven ? ', ' + ven : ''}. Available at: ${link} (Accessed: ${day} ${mon} ${yr}).`;
}
const nbPlain = h => h.replace(/<\/?i>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
// one reference per source, in alphabetical order
function nbRefs(style = NB.style){
  const seen = new Set(), out = [];
  for (const it of NB.items){ const k = it.kind + '|' + it.lang + '|' + it.title.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(nbCite(it, style)); }
  return out.sort((a, b) => nbPlain(a).localeCompare(nbPlain(b)));
}
// in-text hint shown under each source: (Family, Year)
function nbInText(it){ const a = (it.authors || []).map(nameParts); if (!a.length) return it.kind === 'paper' ? it.title : 'Wikipedia'; return a.length > 2 || it.more ? `${a[0].family} et al.` : a.length === 2 ? `${a[0].family} & ${a[1].family}` : a[0].family; }

/* ─────────── the panel ─────────── */
const nb = $('#nb');
function nbCount(){ const n = NB.items.length; $('#nbBtn .bdg').textContent = n ? (n > 99 ? '99+' : n) : ''; nb.querySelector('.cnt').textContent = n ? t('nbN', { n }) : ''; nb.querySelectorAll('.acts button').forEach(b => b.disabled = !n); }
function nbMarks(){   // the pin buttons show whether what's on screen is already in the notebook
  const c = cardCtx, on = nbHas(c), b = $('#cardPin');
  b.classList.toggle('on', on); b.querySelector('span').textContent = on ? t('nbPinned') : t('nbPin');
  const r = $('#reader .pin'), rt = reader.dataset.title; r.classList.toggle('on', !!rt && nbHas({ kind: 'article', lang: LANG, title: rt }));
}
function nbEl(tag, props, ...kids){ const e = document.createElement(tag); Object.assign(e, props || {}); for (const k of kids) if (k != null) e.append(k); return e; }
function nbRender(flashId){
  const list = nb.querySelector('.list'); list.replaceChildren();
  if (!NB.items.length){ list.append(nbEl('p', { className: 'empty', textContent: t('nbEmpty') })); }
  for (const it of NB.items){
    const wrap = nbEl('div', { className: 'item ' + (it.kind === 'paper' ? 'paper' : 'article') });
    wrap.dataset.id = it.id;
    wrap.append(nbEl('button', { className: 'rm', type: 'button', title: t('nbRemove'), textContent: '×', onclick: () => { if (!confirm(t('nbConfirm'))) return; NB.items = NB.items.filter(x => x.id !== it.id); nbSave(true); nbCount(); nbMarks(); nbRender(); } }));
    wrap.append(nbEl('span', { className: 'kind', textContent: it.kind === 'paper' ? t('paperKicker') : t('nbArticle') }));
    const h = nbEl('h3'); const a = nbEl('a', { href: it.url || '#', target: '_blank', rel: 'noopener', textContent: it.title }); h.append(a); wrap.append(h);
    const meta = it.kind === 'paper' ? [authorLine(it), it.year, it.venue].filter(Boolean).join(' · ') : it.desc; if (meta) wrap.append(nbEl('div', { className: 'meta', textContent: meta, dir: 'auto' }));
    if (it.quote) wrap.append(nbEl('blockquote', { textContent: it.quote, dir: 'auto' }));
    for (const [key, label] of [['note', 'nbInterp'], ['question', 'nbQ']]){
      const id = 'nb-' + key + '-' + it.id;
      wrap.append(nbEl('label', { htmlFor: id, textContent: t(label) }));
      const ta = nbEl('textarea', { id, value: it[key] || '', rows: 2, dir: 'auto' });
      ta.addEventListener('input', () => { it[key] = ta.value; nbSave(); });
      wrap.append(ta);
    }
    if (it.trail && it.trail.length) wrap.append(nbEl('div', { className: 'trail', textContent: t('nbFound') + ': ' + it.trail.slice(-4).join(' › '), dir: 'auto' }));
    list.append(wrap);
  }
  if (flashId){ const w = list.querySelector(`[data-id="${flashId}"]`); if (w){ w.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); w.classList.add('flash'); } }
}
function nbOpen(flashId){
  document.body.classList.add('nbopen'); nb.classList.add('on'); nb.setAttribute('aria-hidden', 'false');
  nbRender(flashId); nbStyleBtns(); setTimeout(placeCentre, 30); track('notebook-open');
}
function nbClose(){ document.body.classList.remove('nbopen'); nb.classList.remove('on'); nb.setAttribute('aria-hidden', 'true'); setTimeout(placeCentre, 30); }
const nbToggle = () => nb.classList.contains('on') ? nbClose() : nbOpen();
function nbStyleBtns(){ nb.querySelectorAll('.style button').forEach(b => b.classList.toggle('on', b.dataset.s === NB.style)); }

/* ─────────── exporting ─────────── */
function nbDocHtml(forFile){
  const style = NB.style, parts = [`<h1>${eh(t('nbDoc'))}</h1>`];
  if (NB.q.trim()) parts.push(`<p><b>${eh(t('nbTopQ'))}</b><br>${eh(NB.q).replace(/\n/g, '<br>')}</p>`);
  for (const it of NB.items.slice().reverse()){
    parts.push(`<h2>${eh(it.title)}</h2><p style="color:#555;font-size:90%">${eh(it.kind === 'paper' ? [authorLine(it), it.year, it.venue].filter(Boolean).join(' · ') : (it.desc || t('nbArticle')))}</p>`);
    if (it.quote) parts.push(`<blockquote style="margin:8px 0 8px 12px;padding-left:10px;border-left:3px solid #bbb"><i>${eh(it.quote)}</i> (${eh(nbInText(it))}${it.year ? ', ' + eh(it.year) : ''})</blockquote>`);
    if (it.note.trim()) parts.push(`<p><b>${eh(t('nbInterp'))}:</b> ${eh(it.note).replace(/\n/g, '<br>')}</p>`);
    if (it.question.trim()) parts.push(`<p><b>${eh(t('nbQ'))}:</b> ${eh(it.question).replace(/\n/g, '<br>')}</p>`);
    if (it.trail && it.trail.length) parts.push(`<p style="color:#777;font-size:85%">${eh(t('nbFound'))}: ${eh(it.trail.slice(-4).join(' › '))}</p>`);
  }
  parts.push(`<h2>${eh(t('nbRefs'))} (${style === 'apa' ? 'APA 7' : style === 'mla' ? 'MLA 9' : 'Harvard'})</h2>`, ...nbRefs(style).map(r => `<p style="margin:0 0 8px 28px;text-indent:-28px">${r}</p>`));
  const body = parts.join('\n');
  return forFile ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${eh(t('nbDoc'))}</title><style>body{font-family:Calibri,Arial,sans-serif;line-height:1.45}h1{font-size:22pt}h2{font-size:14pt;margin-top:18pt}</style></head><body>${body}</body></html>` : body;
}
async function nbCopy(text, html, btn){
  try {
    if (html && window.ClipboardItem && navigator.clipboard.write) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
    else await navigator.clipboard.writeText(text);
  } catch (e) { nbToast('⚠ ' + (e && e.message || 'copy failed')); return; }
  const old = btn.textContent; btn.textContent = t('nbCopied') + ' ✓'; setTimeout(() => btn.textContent = old, 1500);
}
nb.querySelector('.cx').onclick = nbClose;
nb.querySelector('.grab').onclick = nbClose;
$('#nbBtn').onclick = nbToggle;
addEventListener('keydown', e => { if (e.key === 'Escape' && nb.classList.contains('on') && !$('#reader').classList.contains('on')) nbClose(); });
nb.querySelector('.topq').value = NB.q;
nb.querySelector('.topq').addEventListener('input', e => { NB.q = e.target.value; nbSave(); });
nb.querySelectorAll('.style button').forEach(b => b.onclick = () => { NB.style = b.dataset.s; nbSave(true); nbStyleBtns(); });
nb.querySelector('.copyrefs').onclick = e => { const r = nbRefs(); nbCopy(r.map(nbPlain).join('\n\n'), r.map(x => `<p>${x}</p>`).join(''), e.currentTarget); track('notebook-refs'); };
nb.querySelector('.copydoc').onclick = e => { const body = nbDocHtml(false); nbCopy(body.replace(/<br>/g, '\n').replace(/<\/(p|h1|h2|blockquote)>/g, '\n\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"), body, e.currentTarget); track('notebook-copydoc'); };
nb.querySelector('.word').onclick = () => {
  const a = nbEl('a', { href: URL.createObjectURL(new Blob(['﻿', nbDocHtml(true)], { type: 'application/msword' })), download: 'rabbit-hole-notes.doc' });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); track('notebook-word');
};
nb.querySelector('.print').onclick = () => {
  const f = nbEl('iframe', { style: 'position:fixed;width:0;height:0;border:0;right:0;bottom:0' }); document.body.append(f);
  f.srcdoc = nbDocHtml(true); f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 60000); }; track('notebook-pdf');
};

// the pin buttons: on a tile, and in the article reader
const cardPin = $('#cardPin');
cardPin.addEventListener('mousedown', e => e.preventDefault());   // keep the person's text selection
cardPin.onclick = () => {
  if (!cardCtx) return;
  const q = nbSelection($('#card'));
  if (!q && nbHas(cardCtx)){ const e = NB.items.find(it => nbSameSource(it, cardCtx)); nbOpen(e && e.id); return; }
  nbPin(cardCtx, q); nbMarks();
};
const readerPin = $('#reader .pin');
readerPin.addEventListener('mousedown', e => e.preventDefault());
readerPin.onclick = () => {
  const title = reader.dataset.title; if (!title) return;
  const c = { kind: 'article', lang: LANG, title, url: wikiUrl(title), desc: ($('#reader .lede') || {}).textContent || '' };
  const q = nbSelection(rArt);
  if (!q && nbHas(c)){ const e = NB.items.find(it => nbSameSource(it, c)); nbOpen(e && e.id); return; }
  nbPin(c, q); nbMarks();
};
// the strings follow the language
const nbApply = applyStrings;
applyStrings = function(){ nbApply.apply(this, arguments); nb.querySelector('.topq').placeholder = t('nbTopQ'); nbCount(); nbMarks(); };
nb.querySelector('.topq').placeholder = t('nbTopQ');
nbCount(); nbMarks();

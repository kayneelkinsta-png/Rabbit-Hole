'use strict';
/* ─────────── the notebook: pin things, keep passages and your own words, with the trail that led there ─────────── */
/* Saved on this device only (no account). An entry is one source (a Wikipedia article or a paper), optionally one passage
   from it, your interpretation, your question, and the worlds you passed through to reach it. */
const NB_KEY = 'rh-notebook';
// folders: each holds its own notes and its own question; "All" shows everything. (Version 1 had one list, which becomes the first folder.)
const NB_ALL = 'all';
let NB = { v: 2, style: 'apa', folders: [{ id: 'f0', name: '', q: '' }], active: 'f0', pinTo: 'f0', items: [] };
try {
  const v = JSON.parse(localStorage.getItem(NB_KEY) || 'null');
  if (v && Array.isArray(v.items)){
    const folders = Array.isArray(v.folders) && v.folders.length ? v.folders.map(f => ({ id: String(f.id), name: String(f.name || '').slice(0, 40), q: String(f.q || '') })) : [{ id: 'f0', name: '', q: v.q || '' }];
    const ids = new Set(folders.map(f => f.id));
    NB = { v: 2, style: ['apa', 'mla', 'harvard'].includes(v.style) ? v.style : 'apa', folders, active: v.active === NB_ALL || ids.has(v.active) ? v.active : folders[0].id, pinTo: ids.has(v.pinTo) ? v.pinTo : folders[0].id,
      items: v.items.map(it => ({ ...it, folder: ids.has(it.folder) ? it.folder : folders[0].id })) };
  }
} catch (e) {}
const nbFolder = id => NB.folders.find(f => f.id === id);
const nbFolderName = f => f.name || t('nbFolderDefault');
const nbScope = () => NB.active === NB_ALL ? NB.items : NB.items.filter(it => it.folder === NB.active);
const nbPinFolder = () => nbFolder(NB.active) ? NB.active : (nbFolder(NB.pinTo) ? NB.pinTo : NB.folders[0].id);
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
  const folder = nbPinFolder();
  const dup = NB.items.find(it => it.folder === folder && nbSameSource(it, c) && (it.quote || '') === (quote || ''));
  if (dup){ nbToast(t('nbAgain'), dup.id); return dup; }
  const first = !NB.items.length;
  const e = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(), kind: c.kind, lang: c.lang, title: c.title, url: c.url, desc: c.desc || '', authors: c.authors || [], more: !!c.more, year: c.year || '', venue: c.venue || '', doi: c.doi || '',
    quote: quote || '', note: '', question: '', trail: c.trail || trailNames(), folder };
  NB.items.unshift(e); nbSave(true); nbCount(); nbMarks();
  nbToast(first ? t('nbSavedTip') : NB.folders.length > 1 ? t('nbAddedTo', { name: nbFolderName(nbFolder(folder)) }) : t('nbSaved'), e.id);
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
  for (const it of nbScope()){ const k = it.kind + '|' + it.lang + '|' + it.title.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(nbCite(it, style)); }
  return out.sort((a, b) => nbPlain(a).localeCompare(nbPlain(b)));
}
// in-text hint shown under each source: (Family, Year)
function nbInText(it){ const a = (it.authors || []).map(nameParts); if (!a.length) return it.kind === 'paper' ? it.title : 'Wikipedia'; return a.length > 2 || it.more ? `${a[0].family} et al.` : a.length === 2 ? `${a[0].family} & ${a[1].family}` : a[0].family; }

/* ─────────── the panel ─────────── */
const nb = $('#nb');
function nbCount(){ const all = NB.items.length, n = nbScope().length; $('#nbBtn .bdg').textContent = all ? (all > 99 ? '99+' : all) : ''; nb.querySelector('.cnt').textContent = n ? t('nbN', { n }) : ''; nb.querySelectorAll('.acts button').forEach(b => b.disabled = !n); }
function nbMarks(){   // the pin buttons show whether what's on screen is already in the notebook
  const c = cardCtx, on = nbHas(c), b = $('#cardPin');
  b.classList.toggle('on', on); b.querySelector('span').textContent = on ? t('nbPinned') : t('nbPin');
  const r = $('#reader .pin'), rt = reader.dataset.title; r.classList.toggle('on', reader.dataset.kind === 'paper' ? nbHas(c) : !!rt && nbHas({ kind: 'article', lang: LANG, title: rt }));
}
function nbEl(tag, props, ...kids){ const e = document.createElement(tag); Object.assign(e, props || {}); for (const k of kids) if (k != null) e.append(k); return e; }
// the folder tabs: All, each folder, and a + for a new one; rename and delete for the folder in view
function nbTabs(){
  const bar = nb.querySelector('.tabs'); bar.replaceChildren();
  const tab = (id, label) => { const b = nbEl('button', { type: 'button', textContent: label, title: label }); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(NB.active === id)); b.classList.toggle('on', NB.active === id); b.onclick = () => nbSelect(id); bar.append(b); return b; };
  tab(NB_ALL, t('nbAll'));
  for (const f of NB.folders) tab(f.id, nbFolderName(f));
  const add = nbEl('button', { type: 'button', className: 'add', textContent: '+', title: t('nbNewFolder') }); add.setAttribute('aria-label', t('nbNewFolder')); add.onclick = nbNewFolder; nb.querySelectorAll('.tabrow .add').forEach(x => x.remove()); nb.querySelector('.tabrow').insertBefore(add, nb.querySelector('.fedit'));
  const fe = nb.querySelector('.fedit'); fe.hidden = NB.active === NB_ALL;
  for (const [c, k] of [['.ren', 'nbRenameFolder'], ['.del', 'nbDeleteFolder']]){ const b = fe.querySelector(c); b.title = t(k); b.setAttribute('aria-label', t(k)); }
  const on = bar.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function nbSyncQ(){ const q = nb.querySelector('.topq'), f = nbFolder(NB.active); q.hidden = !f; q.value = f ? f.q : ''; }
function nbSelect(id){ NB.active = id; if (nbFolder(id)) NB.pinTo = id; nbSave(true); nbTabs(); nbSyncQ(); nbCount(); nbRender(); }
function nbNewFolder(){
  const name = (prompt(t('nbFolderPrompt'), '') || '').trim().slice(0, 40); if (!name) return;
  const f = { id: 'f' + Date.now().toString(36), name, q: '' }; NB.folders.push(f); track('notebook-folder'); nbSelect(f.id);
}
function nbRenameFolder(){
  const f = nbFolder(NB.active); if (!f) return;
  const name = (prompt(t('nbFolderPrompt'), nbFolderName(f)) || '').trim().slice(0, 40); if (!name) return;
  f.name = name; nbSave(true); nbTabs(); nbRender();
}
function nbDeleteFolder(){
  const f = nbFolder(NB.active); if (!f) return;
  if (NB.folders.length < 2){ nbToast(t('nbLastFolder')); return; }
  const rest = NB.folders.filter(x => x.id !== f.id), n = NB.items.filter(it => it.folder === f.id).length;
  if (n && !confirm(t('nbDelConfirm', { n, name: nbFolderName(rest[0]) }))) return;
  NB.items.forEach(it => { if (it.folder === f.id) it.folder = rest[0].id; });
  NB.folders = rest; if (NB.pinTo === f.id) NB.pinTo = rest[0].id; nbSelect(rest[0].id); nbMarks();
}
function nbRender(flashId){
  const list = nb.querySelector('.list'); list.replaceChildren();
  const items = nbScope();
  if (!items.length){ list.append(nbEl('p', { className: 'empty', textContent: t('nbEmpty') })); }
  for (const it of items){
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
    if (NB.folders.length > 1){   // move this note to another folder
      const sel = nbEl('select', { id: 'nb-move-' + it.id, title: t('nbMove') }); sel.setAttribute('aria-label', t('nbMove'));
      for (const f of NB.folders) sel.append(nbEl('option', { value: f.id, textContent: (f.id === it.folder ? '' : t('nbMove') + ' ') + nbFolderName(f), selected: f.id === it.folder }));
      sel.onchange = () => { it.folder = sel.value; NB.pinTo = nbFolder(it.folder) ? it.folder : NB.pinTo; nbSave(true); nbCount(); nbRender(); };
      const row = nbEl('div', { className: 'where' }, sel); wrap.append(row);
    }
    list.append(wrap);
  }
  if (flashId){ const w = list.querySelector(`[data-id="${flashId}"]`); if (w){ w.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); w.classList.add('flash'); } }
}
function nbOpen(flashId){
  const hit = flashId && NB.items.find(it => it.id === flashId);
  if (hit && NB.active !== NB_ALL && NB.active !== hit.folder){ NB.active = hit.folder; NB.pinTo = hit.folder; nbSave(true); }
  document.body.classList.add('nbopen'); nb.classList.add('on'); nb.setAttribute('aria-hidden', 'false');
  nbTabs(); nbSyncQ(); nbCount(); nbRender(flashId); nbStyleBtns(); setTimeout(placeCentre, 30); track('notebook-open');
}
function nbClose(){ document.body.classList.remove('nbopen'); nb.classList.remove('on'); nb.setAttribute('aria-hidden', 'true'); setTimeout(placeCentre, 30); }
const nbToggle = () => nb.classList.contains('on') ? nbClose() : nbOpen();
function nbStyleBtns(){ nb.querySelectorAll('.style button').forEach(b => b.classList.toggle('on', b.dataset.s === NB.style)); }

/* ─────────── exporting ─────────── */
function nbDocHtml(forFile){
  const style = NB.style, fol = nbFolder(NB.active), parts = [`<h1>${eh(t('nbDoc'))}${fol ? ' · ' + eh(nbFolderName(fol)) : ''}</h1>`];
  if (fol && fol.q.trim()) parts.push(`<p><b>${eh(t('nbTopQ'))}</b><br>${eh(fol.q).replace(/\n/g, '<br>')}</p>`);
  if (!fol) for (const f of NB.folders) if (f.q.trim()) parts.push(`<p><b>${eh(nbFolderName(f))}:</b> ${eh(f.q).replace(/\n/g, '<br>')}</p>`);
  for (const it of nbScope().slice().reverse()){
    parts.push(`<h2>${eh(it.title)}</h2>${fol ? '' : `<p style="color:#777;font-size:85%">${eh(nbFolderName(nbFolder(it.folder) || NB.folders[0]))}</p>`}<p style="color:#555;font-size:90%">${eh(it.kind === 'paper' ? [authorLine(it), it.year, it.venue].filter(Boolean).join(' · ') : (it.desc || t('nbArticle')))}</p>`);
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
nb.querySelector('.topq').addEventListener('input', e => { const f = nbFolder(NB.active); if (f){ f.q = e.target.value; nbSave(); } });
nb.querySelector('.fedit .ren').onclick = nbRenameFolder;
nb.querySelector('.fedit .del').onclick = nbDeleteFolder;
nb.querySelectorAll('.style button').forEach(b => b.onclick = () => { NB.style = b.dataset.s; nbSave(true); nbStyleBtns(); });
nb.querySelector('.copyrefs').onclick = e => { const r = nbRefs(); nbCopy(r.map(nbPlain).join('\n\n'), r.map(x => `<p>${x}</p>`).join(''), e.currentTarget); track('notebook-refs'); };
nb.querySelector('.copydoc').onclick = e => { const body = nbDocHtml(false); nbCopy(body.replace(/<br>/g, '\n').replace(/<\/(p|h1|h2|blockquote)>/g, '\n\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"), body, e.currentTarget); track('notebook-copydoc'); };
nb.querySelector('.word').onclick = () => {
  const a = nbEl('a', { href: URL.createObjectURL(new Blob(['﻿', nbDocHtml(true)], { type: 'application/msword' })), download: 'rabbit-hole-' + (nbFolder(NB.active) ? nbFolderName(nbFolder(NB.active)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'notes' : 'notes') + '.doc' });
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
  if (reader.dataset.kind === 'paper'){   // a paper's page: keep the paper, or the passage selected in its full text
    if (!cardCtx || cardCtx.kind !== 'paper') return;
    const q = nbSelection(rArt);
    if (!q && nbHas(cardCtx)){ const e = NB.items.find(it => nbSameSource(it, cardCtx)); nbOpen(e && e.id); return; }
    nbPin(cardCtx, q); nbMarks(); return;
  }
  const title = reader.dataset.title; if (!title) return;
  const c = { kind: 'article', lang: LANG, title, url: wikiUrl(title), desc: ($('#reader .lede') || {}).textContent || '' };
  const q = nbSelection(rArt);
  if (!q && nbHas(c)){ const e = NB.items.find(it => nbSameSource(it, c)); nbOpen(e && e.id); return; }
  nbPin(c, q); nbMarks();
};
// the strings follow the language
const nbApply = applyStrings;
applyStrings = function(){ nbApply.apply(this, arguments); nb.querySelector('.topq').placeholder = t('nbTopQ'); nbTabs(); nbCount(); nbMarks(); };
nb.querySelector('.topq').placeholder = t('nbTopQ');
nbTabs(); nbSyncQ(); nbCount(); nbMarks();

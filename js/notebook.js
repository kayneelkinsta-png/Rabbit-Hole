'use strict';
/* ─────────── the notebook: pin things, keep passages and your own words, with the trail that led there ─────────── */
/* Saved on this device only (no account). An entry is one source (a Wikipedia article or a paper), optionally one passage
   from it, your interpretation, your question, and the worlds you passed through to reach it. */
const NB_KEY = 'rh-notebook';
// folders: each holds its own notes and its own question; "All" shows everything. (Version 1 had one list, which becomes the first folder.)
const NB_ALL = 'all';
let NB = { v: 2, style: 'apa', folders: [{ id: 'f0', name: '', q: '', draft: '' }], active: 'f0', pinTo: 'f0', items: [] };
try {
  const v = JSON.parse(localStorage.getItem(NB_KEY) || 'null');
  if (v && Array.isArray(v.items)){
    const folders = Array.isArray(v.folders) && v.folders.length ? v.folders.map(f => ({ id: String(f.id), name: String(f.name || '').slice(0, 40), q: String(f.q || ''), draft: String(f.draft || '') })) : [{ id: 'f0', name: '', q: v.q || '', draft: '' }];
    const ids = new Set(folders.map(f => f.id));
    NB = { v: 2, style: ['apa', 'mla', 'harvard'].includes(v.style) ? v.style : 'apa', folders, active: v.active === NB_ALL || ids.has(v.active) ? v.active : folders[0].id, pinTo: ids.has(v.pinTo) ? v.pinTo : folders[0].id,
      items: v.items.map(it => ({ ...it, folder: ids.has(it.folder) ? it.folder : folders[0].id })) };
  }
} catch (e) {}
const nbFolder = id => NB.folders.find(f => f.id === id);
const nbFolderName = f => f.name || t('nbFolderDefault');
const nbScope = () => NB.active === NB_ALL ? NB.items : NB.items.filter(it => it.folder === NB.active);
// finding things in a long notebook: a search box and a filter by type (kept in memory only)
let nbFind = '', nbType = 'all';
const nbIsMine = it => it.kind === 'note' || it.kind === 'web';
const nbSite = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const nbHay = it => [it.title, it.quote, it.note, it.question, it.desc, (it.authors || []).join(' '), it.venue, (it.trail || []).join(' '), NB.active === NB_ALL ? nbFolderName(nbFolder(it.folder) || NB.folders[0]) : ''].join(' ').toLowerCase();
function nbShown(){
  const words = nbFind.toLowerCase().split(/\s+/).filter(Boolean);
  return nbScope().filter(it => (nbType === 'all' || (nbType === 'mine' ? nbIsMine(it) : it.kind === nbType)) && words.every(w => nbHay(it).includes(w)));
}
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
function nbPin(c, quote, folderId){
  if (!c || game.on) return null;
  const folder = nbFolder(folderId) ? folderId : nbPinFolder(); NB.pinTo = folder;
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
  const wiki = it.kind === 'article', wname = it.lang && it.lang !== 'en' ? `Wikipedia (${eh((LANGS.find(l => l[0] === it.lang) || [0, it.lang])[1])})` : 'Wikipedia';
  const title = eh(it.title), dotted = /[.?!]$/.test(it.title) ? title : title + '.', bare = title.replace(/\.$/, '');   // titles that already end in a full stop don't get a second
  if (it.kind === 'web'){   // a page the person added themselves: title, site and address, as accessed on the day it was saved
    const site = eh(nbSite(it.url));
    if (style === 'apa') return `<i>${title}</i>. (n.d.). ${site}. Retrieved ${mon} ${day}, ${yr}, from ${link}`;
    if (style === 'mla') return `“${dotted}” ${site}, ${link}. Accessed ${day} ${mon3}. ${yr}.`;
    return `${site} (n.d.) <i>${bare}</i>. Available at: ${link} (Accessed: ${day} ${mon} ${yr}).`;
  }
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
  for (const it of nbScope().filter(x => x.kind !== 'note')){ const k = it.kind + '|' + it.lang + '|' + it.title.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(nbCite(it, style)); }
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
const nbKindLabel = it => it.kind === 'paper' ? t('paperKicker') : it.kind === 'article' ? t('nbArticle') : it.kind === 'web' ? t('nbWebKind') : t('nbNoteKind');
function nbGrow(ta){ ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, Math.round(innerHeight * .45)) + 'px'; }   // a note box grows as you write
// the search row and the type filter
function nbTools(){
  const sc = nbScope(), n = { all: sc.length, paper: sc.filter(i => i.kind === 'paper').length, article: sc.filter(i => i.kind === 'article').length, mine: sc.filter(nbIsMine).length };
  if (nbType !== 'all' && !n[nbType]) nbType = 'all';
  const row = nb.querySelector('.findrow'), box = nb.querySelector('.types'); box.replaceChildren();
  for (const [k, label] of [['all', 'nbAll'], ['paper', 'nbTypePapers'], ['article', 'nbTypeArticles'], ['mine', 'nbTypeMine']]){
    if (k !== 'all' && !n[k]) continue;
    const b = nbEl('button', { type: 'button', textContent: t(label) + ' ' + n[k] }); b.classList.toggle('on', nbType === k); b.onclick = () => { nbType = k; nbRender(); }; box.append(b);
  }
  row.hidden = n.all < 2 && !nbFind;
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
function nbSyncQ(){
  const q = nb.querySelector('.topq'), f = nbFolder(NB.active), od = nb.querySelector('.outline'), dr = nb.querySelector('.draft');
  q.hidden = !f; q.value = f ? f.q : ''; od.hidden = !f; dr.value = f ? (f.draft || '') : ''; od.open = !!(f && f.draft);
  setTimeout(() => { nbGrow(q); if (od.open) nbGrow(dr); }, 0);
}
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
  nbTools(); const items = nbShown();
  if (!items.length){ list.append(nbEl('p', { className: 'empty', textContent: nbScope().length ? t('nbNoMatch') : t('nbEmpty') })); }
  for (const it of items){
    const wrap = nbEl('div', { className: 'item ' + (it.kind === 'paper' ? 'paper' : it.kind === 'article' ? 'article' : 'mine') });
    wrap.dataset.id = it.id;
    wrap.append(nbEl('button', { className: 'rm', type: 'button', title: t('nbRemove'), textContent: '×', onclick: () => { if (!confirm(t('nbConfirm'))) return; NB.items = NB.items.filter(x => x.id !== it.id); nbSave(true); nbCount(); nbMarks(); nbRender(); } }));
    wrap.append(nbEl('span', { className: 'kind', textContent: nbKindLabel(it) + (NB.active === NB_ALL ? ' · ' + nbFolderName(nbFolder(it.folder) || NB.folders[0]) : '') }));
    if (it.kind === 'note'){ if (it.title) wrap.append(nbEl('h3', { textContent: it.title, dir: 'auto' })); }
    else { const h = nbEl('h3'); const a = nbEl('a', { href: it.url || '#', target: '_blank', rel: 'noopener', textContent: it.title }); h.append(a); wrap.append(h); }
    const meta = it.kind === 'paper' ? [authorLine(it), it.year, it.venue].filter(Boolean).join(' · ') : it.kind === 'web' ? nbSite(it.url) : it.kind === 'note' ? '' : it.desc; if (meta) wrap.append(nbEl('div', { className: 'meta', textContent: meta, dir: 'auto' }));
    if (it.quote) wrap.append(nbEl('blockquote', { textContent: it.quote, dir: 'auto' }));
    for (const [key, label] of [['note', nbIsMine(it) ? 'nbNoteBody' : 'nbInterp'], ['question', 'nbQ']]){
      const id = 'nb-' + key + '-' + it.id;
      wrap.append(nbEl('label', { htmlFor: id, textContent: t(label) }));
      const ta = nbEl('textarea', { id, value: it[key] || '', rows: key === 'note' && nbIsMine(it) ? 4 : 2, dir: 'auto' });
      ta.addEventListener('input', () => { it[key] = ta.value; nbSave(); nbGrow(ta); }); setTimeout(() => nbGrow(ta), 0);
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
  if (fol && (fol.draft || '').trim()) parts.push(`<h2>${eh(t('nbOutline'))}</h2><p>${eh(fol.draft).replace(/\n/g, '<br>')}</p>`);
  for (const it of nbScope().slice().reverse()){
    parts.push(`<h2>${eh(it.title || t('nbNoteKind'))}</h2>${fol ? '' : `<p style="color:#777;font-size:85%">${eh(nbFolderName(nbFolder(it.folder) || NB.folders[0]))}</p>`}<p style="color:#555;font-size:90%">${eh(it.kind === 'paper' ? [authorLine(it), it.year, it.venue].filter(Boolean).join(' · ') : it.kind === 'web' ? nbSite(it.url) : it.kind === 'note' ? t('nbNoteKind') : (it.desc || t('nbArticle')))}</p>`);
    if (it.quote) parts.push(`<blockquote style="margin:8px 0 8px 12px;padding-left:10px;border-left:3px solid #bbb"><i>${eh(it.quote)}</i> (${eh(nbInText(it))}${it.year ? ', ' + eh(it.year) : ''})</blockquote>`);
    if (it.note.trim()) parts.push(`<p><b>${eh(nbIsMine(it) ? t('nbNoteBody') : t('nbInterp'))}:</b> ${eh(it.note).replace(/\n/g, '<br>')}</p>`);
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
{
  const foot = nb.querySelector('footer'), tg = foot.querySelector('.citetoggle'), panel = foot.querySelector('.citepanel');
  tg.onclick = () => { const open = panel.hidden; panel.hidden = !open; foot.classList.toggle('open', open); tg.setAttribute('aria-expanded', String(open)); if (open) setTimeout(() => panel.scrollIntoView({ block: 'nearest' }), 30); };
}
nb.querySelector('.cx').onclick = nbClose;
nb.querySelector('.grab').onclick = nbClose;
$('#nbBtn').onclick = nbToggle;
addEventListener('keydown', e => { if (e.key === 'Escape' && nb.classList.contains('on') && !$('#reader').classList.contains('on')) nbClose(); });
nb.querySelector('.topq').addEventListener('input', e => { const f = nbFolder(NB.active); if (f){ f.q = e.target.value; nbSave(); nbGrow(e.target); } });
nb.querySelector('.draft').addEventListener('input', e => { const f = nbFolder(NB.active); if (f){ f.draft = e.target.value; nbSave(); nbGrow(e.target); } });
nb.querySelector('.outline').addEventListener('toggle', e => { if (e.target.open) nbGrow(nb.querySelector('.draft')); });
// search
nb.querySelector('.find').addEventListener('input', e => { nbFind = e.target.value; nbRender(); });
// your own note or link
{
  const form = nb.querySelector('.addbox'), err = form.querySelector('.o-err');
  nb.querySelector('.addown').onclick = () => { form.hidden = !form.hidden; err.textContent = ''; if (!form.hidden) form.querySelector('.o-title').focus(); };
  form.querySelector('.o-cancel').onclick = () => { form.hidden = true; form.reset(); err.textContent = ''; };
  form.addEventListener('input', () => { err.textContent = ''; });
  form.onsubmit = e => {
    e.preventDefault();
    const title = form.querySelector('.o-title').value.trim().slice(0, 200), text = form.querySelector('.o-text').value.trim().slice(0, 20000); let link = form.querySelector('.o-link').value.trim();
    if (!title && !link && !text){ err.textContent = t('nbOwnEmpty'); return; }
    if (link){ if (!/^https?:\/\//i.test(link)) link = 'https://' + link; try { new URL(link); } catch (x) { err.textContent = t('nbOwnBadLink'); return; } }
    const it = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(), kind: link ? 'web' : 'note', lang: LANG, title: title || (link ? nbSite(link) : ''), url: link, desc: '', authors: [], more: false, year: '', venue: '', doi: '',
      quote: '', note: text, question: '', trail: [], folder: nbPinFolder() };
    NB.items.unshift(it); nbSave(true); nbCount(); form.hidden = true; form.reset(); nbType = 'all'; nbFind = ''; nb.querySelector('.find').value = ''; nbRender(it.id); track('notebook-own');
  };
}
// a wider notebook for long sessions on a laptop
{
  let wide = false; try { wide = localStorage.getItem('rh-nbwide') === '1'; } catch (e) {}
  const apply = () => { nb.classList.toggle('wide', wide); document.body.classList.toggle('nbwide', wide); setTimeout(placeCentre, 40); };
  nb.querySelector('.widebtn').onclick = () => { wide = !wide; try { localStorage.setItem('rh-nbwide', wide ? '1' : '0'); } catch (e) {} apply(); };
  apply();
}
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

// the folder picker: opens beside the "Add to notebook" button; the last folder used comes first
let nbPickEl = null;
function nbPickOutside(e){ if (nbPickEl && !nbPickEl.contains(e.target)) nbPickClose(); }
function nbPickClose(){ if (nbPickEl){ nbPickEl.remove(); nbPickEl = null; } document.removeEventListener('pointerdown', nbPickOutside, true); }
function nbPick(anchor, onPick){
  nbPickClose();
  const box = nbEl('div', { className: 'nbpick' }); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', t('nbAddTo'));
  box.append(nbEl('div', { className: 'pt', textContent: t('nbAddTo') }));
  const last = nbPinFolder();
  for (const f of [...NB.folders].sort((a, b) => (b.id === last) - (a.id === last))){
    const n = NB.items.filter(i => i.folder === f.id).length;
    const b = nbEl('button', { type: 'button', className: f.id === last ? 'on' : '' }, nbEl('span', { textContent: nbFolderName(f) }), nbEl('small', { textContent: String(n) }));
    b.onclick = () => { nbPickClose(); onPick(f.id); }; box.append(b);
  }
  const row = nbEl('div', { className: 'newf' }), inp = nbEl('input', { type: 'text', maxLength: 40, placeholder: t('nbFolderPrompt') }), go = nbEl('button', { type: 'button', textContent: t('nbCreateAdd') });
  inp.setAttribute('aria-label', t('nbNewFolder'));
  const make = () => { const name = inp.value.trim().slice(0, 40); if (!name){ inp.focus(); return; } const f = { id: 'f' + Date.now().toString(36), name, q: '', draft: '' }; NB.folders.push(f); nbSave(true); nbTabs(); nbPickClose(); onPick(f.id); track('notebook-folder'); };
  go.onclick = make; inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); make(); } if (e.key === 'Escape'){ e.stopPropagation(); nbPickClose(); } });
  row.append(inp, go); box.append(row);
  document.body.append(box); nbPickEl = box;
  const r = anchor.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;   // below the button, or above it when there's no room; always on screen
  let y = r.bottom + 6; if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 6);
  box.style.left = Math.min(Math.max(8, r.left), innerWidth - w - 8) + 'px'; box.style.top = y + 'px';
  setTimeout(() => document.addEventListener('pointerdown', nbPickOutside, true), 0);
}
addEventListener('keydown', e => { if (e.key === 'Escape' && nbPickEl){ e.stopPropagation(); nbPickClose(); } }, true);

// the pin buttons: on a tile, and in the article reader
const cardPin = $('#cardPin');
cardPin.addEventListener('mousedown', e => e.preventDefault());   // keep the person's text selection
cardPin.onclick = () => {
  if (!cardCtx) return;
  const q = nbSelection($('#card'));
  if (!q && nbHas(cardCtx)){ const e = NB.items.find(it => nbSameSource(it, cardCtx)); nbOpen(e && e.id); return; }
  const ctx = cardCtx; nbPick(cardPin, folder => { nbPin(ctx, q, folder); nbMarks(); });   // the passage is taken now; the folder is chosen next
};
const readerPin = $('#reader .pin');
readerPin.addEventListener('mousedown', e => e.preventDefault());
readerPin.onclick = () => {
  if (reader.dataset.kind === 'paper'){   // a paper's page: keep the paper, or the passage selected in its full text
    if (!cardCtx || cardCtx.kind !== 'paper') return;
    const q = nbSelection(rArt);
    if (!q && nbHas(cardCtx)){ const e = NB.items.find(it => nbSameSource(it, cardCtx)); nbOpen(e && e.id); return; }
    const ctx = cardCtx; nbPick(readerPin, folder => { nbPin(ctx, q, folder); nbMarks(); }); return;
  }
  const title = reader.dataset.title; if (!title) return;
  const c = { kind: 'article', lang: LANG, title, url: wikiUrl(title), desc: ($('#reader .lede') || {}).textContent || '' };
  const q = nbSelection(rArt);
  if (!q && nbHas(c)){ const e = NB.items.find(it => nbSameSource(it, c)); nbOpen(e && e.id); return; }
  nbPick(readerPin, folder => { nbPin(c, q, folder); nbMarks(); });
};
// the strings follow the language
const nbApply = applyStrings;
applyStrings = function(){ nbApply.apply(this, arguments); nb.querySelector('.topq').placeholder = t('nbTopQ'); nb.querySelector('.widebtn').title = t('nbWide'); nbTabs(); nbCount(); nbMarks(); };
nb.querySelector('.topq').placeholder = t('nbTopQ');
nbTabs(); nbSyncQ(); nbCount(); nbMarks();

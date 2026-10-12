'use strict';
/* ─────────── a page for a research paper, inside Rabbit Hole ─────────── */
/* Publishers won't let their own pages be shown inside another site, so this page is built from what we can legally read here:
   the paper's details and abstract (OpenAlex, CC0), and, when it's open access in Europe PMC (free to fetch from any site), its
   full text. Everything else is a clear list of places to read it. */
let paperOpenTok = 0;
const EPMC = 'https://www.ebi.ac.uk/europepmc/webservices/rest';

// JATS (the XML open-access articles come in) → safe DOM. Built with createElement and textContent only, never innerHTML
function jatsNode(n, depth, out){
  if (n.nodeType === 3){ out.append(document.createTextNode(n.nodeValue)); return; }
  if (n.nodeType !== 1) return;
  const tag = n.localName, kids = (to) => { for (const c of n.childNodes) jatsNode(c, depth, to); return to; };
  const el = (name, to = out) => { const e = document.createElement(name); to.append(e); return e; };
  switch (tag){
    case 'abstract': case 'back': case 'ref-list': case 'ack': case 'fn-group': case 'permissions': case 'journal-meta': case 'label': case 'object-id': case 'graphic': case 'media': case 'supplementary-material': case 'tex-math': case 'mml:math': case 'math': return;
    case 'sec': { const s = el('section'); for (const c of n.childNodes) jatsNode(c, depth + 1, s); return; }
    case 'title': { const h = el(depth <= 1 ? 'h2' : 'h3'); kids(h); return; }
    case 'p': kids(el('p')); return;
    case 'italic': case 'i': kids(el('i')); return;
    case 'bold': case 'b': kids(el('b')); return;
    case 'sup': kids(el('sup')); return;
    case 'sub': kids(el('sub')); return;
    case 'list': { const l = el(n.getAttribute('list-type') === 'order' ? 'ol' : 'ul'); kids(l); return; }
    case 'list-item': kids(el('li')); return;
    case 'disp-quote': kids(el('blockquote')); return;
    case 'ext-link': { const h = n.getAttribute('xlink:href') || n.getAttribute('href') || ''; if (/^https?:/i.test(h)){ const a = el('a'); a.href = h; a.target = '_blank'; a.rel = 'noopener'; kids(a); } else kids(out); return; }
    case 'fig': { const cap = n.querySelector('caption'), lab = n.querySelector('label'); const p = el('p'); p.className = 'figcap'; p.append(document.createTextNode([lab && lab.textContent, cap && cap.textContent.trim()].filter(Boolean).join(' ') || '')); if (!p.textContent) p.remove(); return; }
    case 'table-wrap': { const cap = n.querySelector('caption'), lab = n.querySelector('label'); if (cap || lab){ const p = el('p'); p.className = 'figcap'; p.textContent = [lab && lab.textContent, cap && cap.textContent.trim()].filter(Boolean).join(' '); } const tb = n.querySelector('table'); if (tb){ const w = el('div'); w.className = 'tbl'; jatsNode(tb, depth, w); } return; }
    case 'table': { const t = el('table'); kids(t); return; }
    case 'thead': kids(el('thead')); return;
    case 'tbody': kids(el('tbody')); return;
    case 'tr': kids(el('tr')); return;
    case 'th': case 'td': { const c = el(tag); const cs = parseInt(n.getAttribute('colspan'), 10); if (cs > 1) c.colSpan = Math.min(cs, 12); kids(c); return; }
    case 'inline-formula': case 'disp-formula': out.append(document.createTextNode(n.textContent.replace(/\s+/g, ' ').trim())); return;
    default: kids(out);   // xref, named-content, styled-content, sc… keep their words
  }
}
async function epmcFullText(p){
  let pmcid = p.pmcid;
  if (!pmcid && p.doi){
    const doi = String(p.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    const j = await fetch(`${EPMC}/search?query=${encodeURIComponent('DOI:"' + doi + '"')}&format=json&resultType=lite`).then(r => r.ok ? r.json() : null).catch(() => null);
    const hit = j && j.resultList && j.resultList.result && j.resultList.result[0];
    if (hit && hit.pmcid && hit.isOpenAccess === 'Y') pmcid = hit.pmcid;
  }
  if (!pmcid) return null;
  const r = await fetch(`${EPMC}/${pmcid}/fullTextXML`).catch(() => null);
  if (!r || !r.ok) return null;   // Europe PMC answers with an error for papers whose text isn't in its open set
  const doc = new DOMParser().parseFromString(await r.text(), 'application/xml');
  if (doc.querySelector('parsererror')) return null;
  const body = doc.querySelector('article > body'); if (!body || body.textContent.trim().length < 800) return null;
  const box = document.createElement('div'); for (const c of body.childNodes) jatsNode(c, 1, box);
  const lic = doc.querySelector('article-meta permissions license'), href = lic && (lic.getAttribute('xlink:href') || lic.getAttribute('href') || (lic.querySelector('ext-link') && lic.querySelector('ext-link').getAttribute('xlink:href'))) || '';
  const m = /creativecommons\.org\/(licenses|publicdomain)\/([a-z-]+)\/?([\d.]*)/i.exec(href);
  return { box, pmcid, license: m ? ('CC ' + m[2].toUpperCase() + (m[3] ? ' ' + m[3] : '')) : '', licenseUrl: href };
}
const paperEl = (tag, props, ...kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); for (const k of kids) if (k != null) e.append(k); return e; };
const paperLink = (href, label) => paperEl('a', { href, target: '_blank', rel: 'noopener', textContent: label + ' ↗' });

async function openPaperPage(p){
  const tok = ++paperOpenTok;
  readHist = []; reader.dataset.kind = 'paper'; reader.dataset.title = '';
  reader.classList.remove('gone'); requestAnimationFrame(() => reader.classList.add('on'));
  reader.querySelector('.prev').hidden = true; reader.querySelector('.dive').hidden = true;
  reader.querySelector('.t').textContent = t('paperKicker');
  const ext = reader.querySelector('.ext'); ext.href = p.url; ext.textContent = t('fullPaper') + ' ↗';
  rArt.replaceChildren();
  rArt.append(paperEl('h1', { textContent: p.title, dir: 'auto' }), paperEl('p', { className: 'lede', textContent: [authorLine(p), p.year, p.venue].filter(Boolean).join(' · '), dir: 'auto' }));
  const chips = paperEl('div', { className: 'chips' });
  if (p.review) chips.append(paperEl('span', { className: 'rv', textContent: t('review') }));
  chips.append(paperEl('span', { textContent: t('cites', { n: p.cites.toLocaleString() }) }));
  if (p.oa) chips.append(paperEl('span', { className: 'oa', textContent: t('openAccess') }));
  for (const tp of p.topics || []) chips.append(paperEl('span', { className: 'tp', textContent: tp }));
  rArt.append(chips);
  if (p.abs) rArt.append(paperEl('h2', { textContent: t('abstractH') }), paperEl('p', { textContent: p.abs, dir: 'auto' }));
  const ft = paperEl('div', { className: 'ft' }, paperEl('p', { className: 'spin', textContent: t('ftLooking') })); rArt.append(ft);
  // the ways to read it elsewhere
  const ul = paperEl('ul', { className: 'ways' }), li = (...k) => ul.append(paperEl('li', null, ...k));
  if (p.doi) li(paperLink(p.doi, t('publisherPage')));
  if (p.url && p.url !== p.doi && !(p.where || []).some(w => w.u === p.url)) li(paperLink(p.url, t('fullPaper')));   // the page the tile's link goes to, when it isn't one of the above
  for (const w of p.where || []) li(paperLink(w.u, (w.s || t('openCopy')) + ' · ' + t('openAccess')));
  if (p.pmcid) li(paperLink('https://europepmc.org/article/PMC/' + p.pmcid.replace(/^PMC/i, ''), 'Europe PMC'));
  if (p.pmid) li(paperLink('https://pubmed.ncbi.nlm.nih.gov/' + p.pmid + '/', 'PubMed'));
  li(paperLink('https://scholar.google.com/scholar?q=' + encodeURIComponent(p.title), 'Google Scholar'));
  li(paperLink(p.id, t('openalexRecord')));
  rArt.append(paperEl('h2', { textContent: t('moreWays') }), ul);
  reader.querySelector('.credit').textContent = t('paperCredit');
  rBody.scrollTop = 0; track('paper-page'); if (typeof nbMarks === 'function') nbMarks();
  // then the full text, if Europe PMC has it
  const full = await epmcFullText(p).catch(() => null);
  if (tok !== paperOpenTok || reader.dataset.kind !== 'paper') return;
  ft.replaceChildren();
  if (!full){ ft.append(paperEl('p', { className: 'ftnone', textContent: t('ftNone') })); return; }
  ft.append(paperEl('h2', { textContent: t('fullTextH') }), full.box,
    paperEl('p', { className: 'ftnote' }, document.createTextNode(t('ftFrom') + (full.license ? ' · ' + full.license : '') + ' '), paperLink('https://europepmc.org/article/PMC/' + full.pmcid.replace(/^PMC/i, ''), 'Europe PMC')));
  track('paper-fulltext');
}

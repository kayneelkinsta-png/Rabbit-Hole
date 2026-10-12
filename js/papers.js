'use strict';
const PAPER_AT = [2, 6, 11, 17, 24, 32, 41, 51];
/* ─────────── research papers: a second kind of orb, from OpenAlex (free, no key, CORS open, data CC0) ─────────── */
const OA = 'https://api.openalex.org/works';
let oaOff = false;
const authorLine = p => (p.authors || []).slice(0, 3).join(', ') + ((p.more || (p.authors || []).length > 3) ? ' et al.' : '');
const abstractOf = ix => { if (!ix) return ''; const w = []; for (const k in ix) for (const p of ix[k]) w[p] = k; return w.join(' ').trim(); };
async function fetchPapers(T){
  const term = (T.name || T.title).replace(/\s*\(([^)]*)\)/g, ' $1').trim(), ck = 'rh-p4:' + LANG + ':' + term;
  try { const c = JSON.parse(localStorage.getItem(ck) || 'null'); if (c && Date.now() - c.at < 3 * 864e5) return c.list; } catch (e) {}
  const u = OA + '?' + new URLSearchParams({ search: term, filter: 'cited_by_count:>5,has_abstract:true,type:article|review', 'per-page': '25', select: 'id,title,publication_year,cited_by_count,open_access,type,doi,authorships,primary_location,abstract_inverted_index' });
  if (oaOff) return [];
  const r = await fetch(u); if (r.status === 429){ oaOff = true; return []; }   // keyless daily allowance used up: no more papers this visit
  if (!r.ok) throw new Error('openalex ' + r.status);
  const j = await r.json(); const words = term.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const rows = (j.results || []).filter(w => w.title).map(w => ({ id: w.id, title: w.title.replace(/<[^>]+>/g, ''), year: w.publication_year, cites: w.cited_by_count, review: w.type === 'review',
    oa: !!(w.open_access && w.open_access.is_oa), url: (w.open_access && w.open_access.is_oa && w.open_access.oa_url && !/\.pdf($|\?)|\/pdf\//i.test(w.open_access.oa_url) && w.open_access.oa_url) || w.doi || (w.open_access && w.open_access.is_oa && w.open_access.oa_url) || (w.primary_location && w.primary_location.landing_page_url) || w.id, doi: w.doi,   // full text if it's open, else the DOI (which always resolves), else the publisher's own page
    authors: (w.authorships || []).slice(0, 8).map(a => a.author.display_name), more: (w.authorships || []).length > 8, venue: w.primary_location && w.primary_location.source ? w.primary_location.source.display_name : '',
    abs: abstractOf(w.abstract_inverted_index).slice(0, 700) }));
  const inTitle = p => words.length && words.some(x => p.title.toLowerCase().includes(x));
  const list = [...rows.filter(inTitle), ...rows.filter(p => !inTitle(p))].filter((p, i, a) => a.findIndex(x => x.title.toLowerCase() === p.title.toLowerCase()) === i).slice(0, PAPER_AT.length);
  try { localStorage.setItem(ck, JSON.stringify({ at: Date.now(), list })); } catch (e) {}
  return list;
}
// when a world becomes the one you're in, fetch its papers (once) and fill its reserved places
function ensurePapers(T){
  if (!T || T.box || T.papers || game.on || T.status !== 'ready' || !T.items.some(it => it.paper === 'slot')) return;
  T.papers = 'loading';
  fetchPapers(T).then(list => {
    const slots = T.items.filter(it => it.paper === 'slot');
    list.forEach((p, k) => { const it = slots[k]; if (!it) return; it.paper = p; it.title = p.title; it.desc = [p.year, p.venue].filter(Boolean).join(' · '); it.r = it.r0; it.gl = null; it.shown = performance.now(); });
    T.extB = null; T.papers = list;
  }).catch(() => { T.papers = []; });
}

'use strict';
// a topic link: ?w=Octopus (&l=es for that language's Wikipedia)
const LINK = (() => { try { const u = new URLSearchParams(location.search); const w = (u.get('w') || '').trim().slice(0, 200); const l = (u.get('l') || '').toLowerCase(); return w ? { w, l: LANGS.some(x => x[0] === l) ? l : '' } : null; } catch (e) { return null; } })();
// a challenge link: ?daily=1 plays today's challenge; ?s=Start&g=Goal&d=4[&m=1][&t=1][&b=3] replays a round (d: depth 1-10, m: mystery, t: timed, b: the best to beat)
const CHAL = (() => { try {
  const u = new URLSearchParams(location.search), l = (u.get('l') || '').toLowerCase(), lang = LANGS.some(x => x[0] === l) ? l : '';
  if (u.get('daily')) return { daily: true, l: lang };
  const s = (u.get('s') || '').trim().slice(0, 200), g = (u.get('g') || '').trim().slice(0, 200); if (!s || !g || s === g) return null;
  const d = Math.min(10, Math.max(1, parseInt(u.get('d'), 10) || 4)), b = parseInt(u.get('b'), 10);
  return { s, g, d, l: lang, m: u.get('m') === '1', t: u.get('t') === '1', b: b > 0 && b < 99 ? b : 0 };
} catch (e) { return null; } })();
let chalHold = !!CHAL;   // while a challenge link's game is on, the address keeps the challenge (see syncUrl)
let LANG = (() => {
  if (CHAL && CHAL.l) return CHAL.l;
  if (LINK && LINK.l) return LINK.l;
  try { const v = localStorage.getItem('rh-lang'); if (v && LANGS.some(l => l[0] === v)) return v; } catch (e) {}
  const nav = (navigator.languages || [navigator.language || 'en']).map(x => String(x).slice(0, 2).toLowerCase());
  return nav.find(c => LANGS.some(l => l[0] === c)) || 'en';
})();
const WIKI = () => `https://${LANG}.wikipedia.org`;
const t = (k, v = {}) => ((STR[LANG] && STR[LANG][k]) || STR.en[k] || k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
// where an article's own links end: "See also", "References"… in each language
const CUT_RE = /^(See also|References|Notes|Further reading|External links|Bibliography|Sources|Citations|Footnotes|Véase también|Referencias|Notas|Bibliografía|Enlaces externos|Voir aussi|Notes et références|Références|Bibliographie|Liens externes|Articles connexes|Siehe auch|Literatur|Weblinks|Einzelnachweise|Anmerkungen|Ver também|Referências|Ligações externas|Links externos|Voci correlate|Note|Collegamenti esterni|Altri progetti|Zie ook|Externe links|Bronnen|Referenties|Zobacz też|Przypisy|Linki zewnętrzne|Ayrıca bakınız|Kaynakça|Dış bağlantılar|Lihat pula|Referensi|Pranala luar|См\. также|Примечания|Литература|Ссылки|Див\. також|Примітки|Посилання|انظر أيضًا|انظر أيضا|المراجع|مراجع|وصلات خارجية|इन्हें भी देखें|सन्दर्भ|संदर्भ|बाहरी कड़ियाँ|参见|參見|参考文献|參考文獻|外部链接|外部連結|关联项目|関連項目|脚注|出典|外部リンク|같이 보기|각주|참고 문헌|외부 링크)/i;
let API = WIKI() + '/w/api.php';
// Wikipedia sometimes asks us to slow down (429) or hiccups: wait a moment and ask again, rather than giving up
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(url){
  for (let k = 0; ; k++){
    let r = null; try { r = await fetch(url); } catch (e) {}
    if (r && r.ok) return r.json();
    if (r && r.status === 404) return null;
    if (k === 3) throw new Error('wikipedia ' + (r ? r.status : 'offline'));
    await sleep(700 * 2 ** k + Math.random() * 500);
  }
}
const q = p => getJSON(API + '?' + new URLSearchParams({ ...p, format: 'json', formatversion: '2', origin: '*' }));
const memo = new Map();
// remember answers, but never a failure: the next ask tries again
const once = (k, f) => { if (!memo.has(k)) memo.set(k, f().catch(() => { memo.delete(k); return null; })); return memo.get(k); };
// a tile's text: the article's opening, a paragraph or two, long enough to be worth reading and short enough for a tile
// pronunciation and native-script asides "(… [ɕoːɡɯɴ] …)" are noise on a tile: drop any bracket holding one
function dropAsides(p){
  let out = '', i = 0;
  while (i < p.length){
    if (p[i] === '('){
      let d = 0, j = i; for (; j < p.length; j++){ if (p[j] === '(') d++; else if (p[j] === ')' && --d === 0) break; }
      if (j < p.length && /\[|\/[^\s\/]{2,}\/|pronounced|pronunciation|listen|IPA\b|ə|^\(\s*[,;]/i.test(p.slice(i, j + 1))){ out = out.replace(/\s+$/, ''); i = j + 1; continue; }
    }
    out += p[i++];
  }
  return out.replace(/\s+([,.;:])/g, '$1').replace(/ {2,}/g, ' ');
}
function trimLead(text){
  const ps = String(text || '').split(/\n+/).map(x => dropAsides(x.replace(/\s*\(\s*[;,]?\s*\)/g, '')).trim()).filter(Boolean);
  let out = ps[0] || '';
  for (let i = 1; i < ps.length && out.length < 380; i++) out += '\n\n' + ps[i];
  if (out.length > 820){ const cut = Math.max(out.lastIndexOf('. ', 820), out.lastIndexOf('。', 820)); if (cut > 250) out = out.slice(0, cut + 1); }
  return out;
}
// every tile comes from Wikipedia's main API (it takes bursts in its stride); the quick-summary service is only a fallback
const summary = t => once('s:' + LANG + ':' + t, async () => {
  const j = await q({ action: 'query', titles: t, prop: 'extracts|pageimages|description|info', exintro: '1', explaintext: '1', redirects: '1', piprop: 'thumbnail', pithumbsize: '640', inprop: 'url' }).catch(() => null);
  const pg = j && j.query && j.query.pages && j.query.pages[0];
  if (pg && pg.missing) return null;
  if (pg && pg.extract) return { title: pg.title, description: pg.description || '', extract: trimLead(pg.extract), thumbnail: pg.thumbnail ? { source: pg.thumbnail.source } : null, content_urls: { desktop: { page: pg.fullurl || WIKI() + '/wiki/' + encodeURIComponent(pg.title.replace(/ /g, '_')) } } };
  return getJSON(WIKI() + '/api/rest_v1/page/summary/' + encodeURIComponent(t.replace(/ /g, '_')));
});
const GENERIC = new Set(['Species', 'Genus', 'Family (biology)', 'Order (biology)', 'Class (biology)', 'Phylum', 'Taxonomy (biology)', 'Binomial nomenclature', 'Common name', 'Mass', 'Weight', 'Length', 'Kilogram', 'Metre', 'Kilometre', 'Mile', 'English language', 'Latin', 'Ancient Greek', 'Wikipedia', 'Human', 'Population', 'Synonym', 'ISBN (identifier)', 'Doi (identifier)', 'JSTOR (identifier)', 'PMID (identifier)', 'S2CID (identifier)', 'Bibcode (identifier)', 'OCLC (identifier)', 'ISSN (identifier)', 'Hdl (identifier)', 'PMC (identifier)', 'ArXiv (identifier)']);
const DULL = /^(Topics referred to|Amount of|Basic unit|SI unit|Unit of|Wikimedia|Disambiguation|Identifier)/i;
// every link in the article, in the order a reader meets them
async function allLinks(t){
  const j = await q({ action: 'parse', page: t, prop: 'text', redirects: '1', disableeditsection: '1', disabletoc: '1' });
  if (!j.parse) return { title: t, links: [] };
  const doc = new DOMParser().parseFromString(j.parse.text, 'text/html');
  doc.querySelectorAll('.navbox,.hatnote,.reference,.reflist,.mw-references-wrap,.metadata,style,.sistersitebox,.side-box,.refbegin,.portalbox,.authority-control').forEach(e => e.remove());
  const cut = [...doc.querySelectorAll('h2')].find(h => CUT_RE.test(h.textContent.trim()));
  if (cut){ let n = cut.closest('.mw-heading') || cut; while (n.nextSibling) n.nextSibling.remove(); n.remove(); }
  const out = [], seen = new Set([j.parse.title]);
  doc.querySelectorAll('a[href^="/wiki/"]').forEach(a => {
    const h = a.getAttribute('href').slice(6).split('#')[0]; if (!h || h.includes(':')) return;
    let ti; try { ti = decodeURIComponent(h).replace(/_/g, ' '); } catch { return; }
    if (/^\d+s?$|^List of|century$|\(disambiguation\)|^\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December)$/i.test(ti) || GENERIC.has(ti) || seen.has(ti)) return;
    seen.add(ti); out.push(ti);
  });
  return { title: j.parse.title, links: out.slice(0, 700) };
}
async function pageInfo(titles){
  const chunks = []; for (let i = 0; i < titles.length; i += 50) chunks.push(titles.slice(i, i + 50));
  const got = await Promise.all(chunks.map(chunk => q({ action: 'query', titles: chunk.join('|'), prop: 'description|pageimages', piprop: 'thumbnail', pithumbsize: '250', redirects: '1' }).catch(() => null)));
  const res = [];
  got.forEach((j, n) => {
    if (!j || !j.query) return;
    const map = {}, hop = {};
    (j.query.pages || []).forEach(p => map[p.title] = p); (j.query.normalized || []).concat(j.query.redirects || []).forEach(r => hop[r.from] = r.to);
    chunks[n].forEach(t => { let x = t; for (let k = 0; hop[x] && k < 3; k++) x = hop[x]; const p = map[x]; if (p && !p.missing) res.push(p); });
  });
  return res;
}
function kindOf(d = ''){
  d = d.toLowerCase();
  if (/\b(novelist|writer|poet|author|actor|actress|painter|artist|politician|scientist|philosopher|singer|musician|composer|king|queen|emperor|president|explorer|engineer|inventor|mathematician|physicist|chemist|biologist|journalist|born|\(\d{4}[–-]\d{2,4}\))/.test(d)) return 'person';
  if (/\b(species|genus|family of|order of|plant|tree|animal|bird|insect|mammal|fish|fungus|crustacean|reptile)\b/.test(d)) return 'nature';
  if (/\b(sea|ocean|bay|gulf|river|lake|strait|island)\b/.test(d)) return 'water';
  if (/\b(city|town|country|state|village|mountain|region|capital|county|province|continent)\b/.test(d)) return 'place';
  if (/\b(planet|star|moon|galaxy|comet|asteroid|satellite|spacecraft|orbit)\b/.test(d)) return 'sky';
  if (/\b(novel|book|poem|film|album|song|magazine|newspaper|play|painting|opera|series)\b/.test(d)) return 'work';
  if (/\b(war|battle|revolution|treaty|election|disaster|event|festival)\b/.test(d)) return 'event';
  if (/\b(company|organi[sz]ation|university|museum|church|agency|brand|team)\b/.test(d)) return 'org';
  if (/\b(ship|car|aircraft|vehicle|train|boat|rocket)\b/.test(d)) return 'vehicle';
  if (/\b(food|dish|drink|wine|beer|fruit|vegetable|cuisine)\b/.test(d)) return 'food';
  return 'idea';
}
// small ink glyphs for things that have no picture (drawn in a 100×100 box)
const GLYPH = {
  person: 'M50 22a14 14 0 1 0 .1 0M22 88C24 64 36 56 50 56S76 64 78 88',
  nature: 'M50 88V40M50 60C30 56 22 40 26 26C42 28 50 42 50 60M50 50C66 44 76 30 74 18C58 20 50 34 50 50',
  water: 'M10 40q10-8 20 0t20 0t20 0t20 0M10 60q10-8 20 0t20 0t20 0t20 0M10 80q10-8 20 0t20 0t20 0t20 0',
  place: 'M14 84V52H28V42H38V52H46V34L56 22L66 34V52H86V84ZM48 84V70Q56 62 64 70V84',
  sky: 'M50 16L58 40L84 42L64 58L72 84L50 68L28 84L36 58L16 42L42 40Z',
  work: 'M50 30C40 24 24 24 14 28V76C24 72 40 72 50 78C60 72 76 72 86 76V28C76 24 60 24 50 30ZM50 30V78',
  event: 'M18 18L78 78M82 18L22 78M68 60L60 68M32 60L40 68',
  org: 'M14 38L50 18L86 38ZM20 38V76M35 38V76M50 38V76M65 38V76M80 38V76M12 76H88',
  vehicle: 'M20 64H80L72 44H34ZM30 64a8 8 0 1 0 .1 0M70 64a8 8 0 1 0 .1 0',
  food: 'M14 70H86M22 70C22 42 78 42 78 70M50 42V36',
  paper: 'M26 14H58L76 32V86H26ZM58 14V32H76M36 48H66M36 60H66M36 72H56',
  idea: 'M50 14C32 14 22 28 24 42C26 54 36 58 38 70H62C64 58 74 54 76 42C78 28 68 14 50 14ZM40 80H60M42 88H58'
};
const GP = Object.fromEntries(Object.entries(GLYPH).map(([k, d]) => [k, new Path2D(d)]));
// the setting a topic lives in, sketched faintly around its links at every depth
const DOODLE = {
  sprout: 'M50 90V50M50 62C36 60 28 50 30 38C42 40 50 48 50 62M50 56C62 52 72 42 70 30C58 32 50 42 50 56',
  tomato: 'M26 58a24 22 0 1 0 48 0a24 22 0 1 0 -48 0M38 38L50 30L62 38M44 34L50 40L56 34M50 30V18',
  can: 'M20 50H62V86H20ZM62 58L88 38M84 34L92 42M20 58Q6 60 8 70Q10 78 20 76',
  fence: 'M12 90V32L18 24L24 32V90M42 90V32L48 24L54 32V90M72 90V32L78 24L84 32V90M6 48H92M6 72H92',
  bee: 'M36 56a16 11 0 1 0 32 0a16 11 0 1 0 -32 0M46 46V66M56 46V66M44 46Q34 26 50 34M60 46Q72 26 56 34M68 56L76 56',
  furrow: 'M4 60Q50 42 96 60M4 76Q50 58 96 76M4 92Q50 74 96 92',
  worm: 'M10 70Q22 54 34 70T58 70T82 70M82 70a4 4 0 1 0 .1 0',
  wave: 'M4 56q11-12 23 0t23 0t23 0t23 0M14 76q11-10 22 0t22 0t22 0',
  fish: 'M14 50C30 30 62 30 78 50C62 70 30 70 14 50ZM78 50L94 36V64ZM28 46a3 3 0 1 0 .1 0',
  boat: 'M16 62H84L72 80H28ZM50 62V16L76 54H50',
  shell: 'M18 80Q50 8 82 80ZM50 80V30M34 80L44 36M66 80L56 36',
  star: 'M50 14L58 40L86 42L64 58L72 86L50 70L28 86L36 58L14 42L42 40Z',
  planet: 'M28 50a22 22 0 1 0 44 0a22 22 0 1 0 -44 0M10 60Q50 28 90 42',
  moon: 'M62 18A33 33 0 1 0 62 82A25 25 0 1 1 62 18Z',
  comet: 'M64 34a9 9 0 1 0 .1 0M58 40L14 84M66 44L28 90M56 32L10 72',
  house: 'M14 86V52H28V42H38V52H46V34L56 22L66 34V52H86V86ZM48 86V70Q56 62 64 70V86',
  tree: 'M50 90V58M50 18C30 18 22 38 28 50C34 62 66 62 72 50C78 38 70 18 50 18Z',
  road: 'M8 92Q40 52 50 50T92 8M20 92Q48 60 58 58T92 22',
  hill: 'M4 88L38 34L58 62L72 46L96 88Z',
  book: 'M50 30C40 24 24 24 14 28V76C24 72 40 72 50 78C60 72 76 72 86 76V28C76 24 60 24 50 30ZM50 30V78',
  candle: 'M42 44H58V90H42ZM50 44V36M50 34Q43 24 50 12Q57 24 50 34',
  quill: 'M18 88L70 20Q88 8 82 30Q62 62 22 88M40 62L52 60',
  frame: 'M16 16H84V84H16ZM26 26H74V74H26Z',
  stack: 'M14 82H86V92H14ZM18 68H82V82H18ZM24 54H76V68H24Z',
  note: 'M34 74a10 8 0 1 0 .1 0M44 74V22L70 30V40L44 32',
  flag: 'M24 92V12M24 14H80L68 28L80 42H24',
  tent: 'M8 86L50 18L92 86ZM50 18V86M40 86L50 60L60 86',
  sword: 'M22 82L74 30M70 22L82 34M28 70L36 78M16 88L24 80',
  tower: 'M26 92V30H74V92M26 30V18H36V26H46V18H56V26H66V18H74V30M44 92V74Q50 66 56 74V92',
  building: 'M18 92V16H58V92M58 40H84V92M28 28H36M44 28H52M28 44H36M44 44H52M28 60H36M44 60H52M66 52H76M66 68H76',
  gear: 'M32 50a18 18 0 1 0 36 0a18 18 0 1 0 -36 0M44 50a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M50 20V30M50 70V80M20 50H30M70 50H80M29 29L36 36M64 64L71 71M71 29L64 36M36 64L29 71',
  wrench: 'M18 84L58 44M58 44A15 15 0 1 1 72 24L62 32L70 40L78 30A15 15 0 0 1 58 44',
  wheel: 'M20 50a30 30 0 1 0 60 0a30 30 0 1 0 -60 0M44 50a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M50 20V80M20 50H80',
  pot: 'M20 44H80V78Q80 88 68 88H32Q20 88 20 78ZM10 44H90M36 44V36H64V44M40 26q-6-8 0-14M56 26q-6-8 0-14',
  knife: 'M12 72L68 26L84 28L30 80ZM12 72L4 80',
  plate: 'M14 50a36 36 0 1 0 72 0a36 36 0 1 0 -72 0M26 50a24 24 0 1 0 48 0a24 24 0 1 0 -48 0',
  flask: 'M40 14H60M44 14V42L22 86H78L56 42V14M30 68H70',
  atom: 'M44 50a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M12 50a38 14 0 1 0 76 0a38 14 0 1 0 -76 0',
  bulb: 'M50 12C32 12 22 26 24 40C26 52 36 56 38 68H62C64 56 74 52 76 40C78 26 68 12 50 12ZM40 78H60M42 86H58',
  castle: 'M14 90V40H26V30H34V40H44V24H56V40H66V30H74V40H86V90ZM44 90V70Q50 62 56 70V90',
  mushroom: 'M20 52Q20 22 50 20Q80 22 80 52ZM40 52V82H60V52M34 38a4 4 0 1 0 .1 0M58 32a5 5 0 1 0 .1 0'
};
const DP = Object.fromEntries(Object.entries(DOODLE).map(([k, d]) => [k, new Path2D(d)]));
const SETTINGS = {
  garden: ['sprout', 'tomato', 'can', 'fence', 'bee', 'furrow', 'worm', 'sprout', 'tree', 'mushroom'],
  sea: ['wave', 'wave', 'fish', 'boat', 'shell', 'fish'],
  sky: ['star', 'star', 'planet', 'moon', 'comet'],
  city: ['house', 'tree', 'road', 'hill', 'building', 'tower'],
  study: ['book', 'candle', 'quill', 'frame', 'stack'],
  library: ['book', 'stack', 'note', 'quill', 'frame', 'castle', 'mushroom'],
  field: ['flag', 'tent', 'sword', 'tower', 'hill', 'castle'],
  workshop: ['gear', 'wrench', 'wheel', 'gear'],
  kitchen: ['pot', 'knife', 'plate', 'tomato', 'can'],
  lab: ['flask', 'atom', 'bulb', 'gear', 'star']
};
function settingOf(d = ''){
  d = d.toLowerCase();
  if (/\b(dish|food|cuisine|drink|sauce|beverage|wine|beer|bread|cheese|cooking|recipe|soup|pasta|pizza|dessert|cake)\b/.test(d)) return 'kitchen';
  if (/\b(plants?|fruits?|berry|berries|vegetables?|flowers?|flowering|trees?|herbs?|crops?|garden|seeds?|grass|leaf|botan|insects?|butterfl|moths?|beetles?|bees?|spiders?|birds?|frogs?|amphibians?|reptiles?|mammals?|animals?)/.test(d)) return 'garden';
  if (/\b(sea|ocean|marine|fish|whale|island|coast|crustacean|lobster|shark|boat|ship|harbou?r|bay|river|lake)\b/.test(d)) return 'sea';
  if (/\b(planet|star|moon|galaxy|space|orbit|comet|asteroid|satellite|astronom|solar|universe)/.test(d)) return 'sky';
  if (/\b(war|battle|revolution|army|military|empire|treaty|knight|castle)\b/.test(d)) return 'field';
  if (/\b(machine|engine|vehicle|car|aircraft|technology|tool|computer|device|train|robot|software)\b/.test(d)) return 'workshop';
  if (/\b(novel|book|poem|literature|film|album|song|play|magazine|writing|story|tale|fairy)\b/.test(d)) return 'library';
  if (/\b(novelist|writer|poet|author|actor|painter|artist|politician|scientist|philosopher|musician|composer|king|queen|emperor|president|explorer|inventor|mathematician)\b/.test(d)) return 'study';
  if (/\b(city|town|country|state|capital|village|region|county|building|street|district)\b/.test(d)) return 'city';
  return 'lab';
}
// how each setting dresses its links: fruit on the vine, portholes, planets, windows, flasks…
const VESSEL = (() => {
  const v = {}, P = () => new Path2D();
  v.garden = P(); v.garden.addPath(new Path2D('M0 -50C-12 -66 -30 -64 -36 -54C-22 -46 -10 -48 0 -50C10 -48 22 -46 36 -54C30 -64 12 -66 0 -50M0 -50V-66'));
  v.sea = P(); for (let i = 0; i < 10; i++){ const a = i / 10 * Math.PI * 2; v.sea.moveTo(Math.cos(a) * 58 + 3, Math.sin(a) * 58); v.sea.arc(Math.cos(a) * 58, Math.sin(a) * 58, 3, 0, 7); } v.sea.moveTo(62, 0); v.sea.arc(0, 0, 62, 0, 7);
  v.sky = P(); v.sky.ellipse(0, 0, 82, 16, -.3, .05 * Math.PI, .95 * Math.PI);
  v.city = P(); v.city.addPath(new Path2D('M-46 -38L0 -76L46 -38M22 -58V-72H32V-50'));
  v.library = P(); v.library.addPath(new Path2D('M-66 48Q-32 36 0 50Q32 36 66 48M-66 48V58Q-32 46 0 60Q32 46 66 58V48M0 50V60'));
  v.lab = P(); v.lab.addPath(new Path2D('M-12 -48V-68H12V-48M-17 -68H17'));
  v.kitchen = P(); v.kitchen.arc(0, 0, 62, 0, 7);
  v.field = P(); v.field.addPath(new Path2D('M-60 -54H60V0Q60 46 0 70Q-60 46 -60 0Z'));
  v.study = P(); v.study.ellipse(0, 0, 58, 66, 0, 0, 7);
  v.workshop = P(); for (let i = 0; i < 12; i++){ const a = i / 12 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); v.workshop.moveTo(c * 50 - sn * 6, sn * 50 + c * 6); v.workshop.lineTo(c * 62 - sn * 6, sn * 62 + c * 6); v.workshop.lineTo(c * 62 + sn * 6, sn * 62 - c * 6); v.workshop.lineTo(c * 50 + sn * 6, sn * 50 - c * 6); }
  return v;
})();
// colour: each setting has its own washes, a line colour for its doodles, and a colour for its vessels
let COLOUR = true, GLASS = false, THEME = 'colour';
const THEMES = ['colour', 'glass', 'ink'];
function setTheme(t){ THEME = t; COLOUR = t !== 'ink'; GLASS = t === 'glass'; document.body.classList.toggle('glass', GLASS); }
// glass: each setting glows in its own deep, luminous colours [deep, mid, light]
const GBG = {
  garden: ['#0b2a1f', '#1f6b4a', '#9be39a'], sea: ['#041c33', '#0e5e86', '#66dff0'], sky: ['#0a0a2a', '#3a2476', '#c2a8ff'],
  city: ['#261420', '#9a4a4a', '#ffb884'], study: ['#221507', '#7a5226', '#f5c983'], library: ['#1c1130', '#6b3c8f', '#f5aee0'],
  field: ['#280e0e', '#8a3b24', '#f6bb66'], workshop: ['#12171b', '#3f4d57', '#a8dcff'], kitchen: ['#2b1107', '#b3522a', '#ffd382'],
  lab: ['#05232a', '#127a78', '#86f5de'], box: ['#110c2c', '#27408b', '#e98be0']
};
const PAL = {
  garden:   { wash: ['#f4a08c', '#f7cf6e', '#b5dc9a', '#ef8a6f', '#d8ecb8'], line: '#4f8a3c', vessel: '#6aa84f' },
  sea:      { wash: ['#a6dce6', '#7cc3d6', '#cfeef2', '#9fd8c8'], line: '#2a7391', vessel: '#caa56a' },
  sky:      { wash: ['#9fb4ec', '#c3cdf6', '#f7dd7a', '#b9a6e8'], line: '#3b4a9a', vessel: '#e5b53f' },
  city:     { wash: ['#f5cf9e', '#e9a88f', '#d4e1b0', '#f0dcc0'], line: '#8a5a3c', vessel: '#c65a43' },
  study:    { wash: ['#efdcb2', '#d9b894', '#f3e7c9'], line: '#7a5230', vessel: '#b58a45' },
  library:  { wash: ['#d7b8e6', '#f6bccb', '#b9d3ff', '#f3e1a8'], line: '#6b4a8a', vessel: '#8e5a9c' },
  field:    { wash: ['#e8c170', '#d38e75', '#bcc98c', '#efd9a6'], line: '#7c4a2d', vessel: '#b53f3f' },
  workshop: { wash: ['#c9d3da', '#f5c55a', '#aebcc4', '#e6ebee'], line: '#51606b', vessel: '#d98e04' },
  kitchen:  { wash: ['#f8b48f', '#f5dc84', '#b5dc9a', '#f6c6b6'], line: '#b5542f', vessel: '#d9534f' },
  lab:      { wash: ['#b8ebdf', '#cfe5fd', '#ffe0b8', '#e2d4f5'], line: '#2e7d7a', vessel: '#4aa3a0' }
};
const FILL_VESSEL = new Set(['garden', 'city', 'lab']);
// a soft halo, pre-drawn once per colour, so every clickable thing can breathe a little light
const HALO = new Map();
function halo(col){
  if (HALO.has(col)) return HALO.get(col);
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, col); gr.addColorStop(.55, col + '88'); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); HALO.set(col, c); return c;
}
let hovered = null;
// the game: get from a start topic to a goal topic within a budget of clicks
const game = { on: false, over: false, level: 2, style: { mystery: false, timed: false }, glow: false, goal: null, start: null, route: [], par: 0, allowed: 0, used: 0 };
// one slider, easy to crazy: how far away the goal hides and how many worlds you get to find it
const DEPTHS = [null,
  { par: 3, spare: 4, glow: true, kids: true },                   // 1 easy: friendly topics, the goal glows
  { par: 4, spare: 3 },                                           // 2 steady (today's challenge)
  { par: 6, spare: 3, rank: [4, 18] },                            // 3 tricky
  { par: 10, spare: 3, rank: [8, 28] },                           // 4 deep
  { par: 16, spare: 5, rank: [10, 34] }                           // 5 crazy
];
const DEPTH_NAMES = [, 'Easy', 'Steady', 'Tricky', 'Deep', 'Crazy'];
const GAME_LEVELS = {}; DEPTHS.forEach((d, i) => { if (d) GAME_LEVELS[i] = d; }); GAME_LEVELS.adventurer = DEPTHS[2];
// the timed challenge: a countdown that grows with the distance
const limitFor = c => 30 + 45 * c.par;
const clock = sec => { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
function depthNote(c, st = {}){
  const bits = [`Your goal is ${c.par} worlds away, and you can enter ${c.par + c.spare}. Reading tiles and articles is free.`];
  if (c.kids) bits.push('Every stop is something you can picture, like animals, fruit, food and films.');
  if (c.glow && !st.mystery) bits.push('The goal glows gold whenever it is on screen.');
  if (c.rank) bits.push('It will be something less famous.');
  if (st.mystery) bits.push(c.par >= 10 ? 'Mystery: just a clue, no picture.' : 'Mystery: just a clue and a blurred picture.');
  if (st.timed) bits.push(`Timed: find it within ${clock(limitFor(c))}.`);
  if (c.par >= 10) bits.push('A goal this deep takes a moment to hide.');
  return bits.join(' ');
}
const SEEDS = ['Tomato', 'Moon', 'Octopus', 'Volcano', 'Chocolate', 'Jazz', 'Ancient Egypt', 'Bicycle', 'Honey bee', 'Piracy', 'Tea', 'Lighthouse', 'Dinosaur', 'Castle', 'Coffee', 'Samurai', 'Rainforest', 'Penguin', 'Pizza', 'Telescope', 'Vikings', 'Coral reef', 'Hot air balloon', 'Origami', 'Chess', 'Circus', 'Cheese', 'Glacier', 'Printing press', 'Butterfly'];
const WORLDS = [...new Set([...SEEDS, 'Aurora', 'Black hole', 'Great Barrier Reef', 'Mount Everest', 'Amazon rainforest', 'Honey', 'Saturn', 'Tardigrade', 'Silk Road', 'Leonardo da Vinci', 'Machu Picchu', 'Great Wall of China', 'Venice', 'Kite', 'Mushroom', 'Rainbow', 'Mars', 'Tyrannosaurus', 'Blue whale', 'Sushi', 'Maple syrup', 'Bread', 'Violin', 'Piano', 'Ballet', 'Lego', 'Robot', 'Submarine', 'Steam engine', 'Paper', 'Silk', 'Salt', 'Spice trade', 'Potato', 'Banana', 'Owl', 'Elephant', 'Giraffe', 'Jellyfish', 'Cave', 'Desert', 'Tornado', 'Lightning', 'Snowflake', 'Earthquake', 'Sphinx', 'Colosseum', 'Stonehenge', 'Ice cream', 'Dragonfly', 'Sunflower', 'Bamboo', 'Chameleon', 'Hummingbird', 'Wolf', 'Bonsai', 'Kimono', 'Totem pole', 'Hieroglyph', 'Compass'])];
// explorer rounds start somewhere a young player knows: fruit, animals, food, films, toys
const KID_SEEDS = ['Banana', 'Strawberry', 'Apple', 'Watermelon', 'Pineapple', 'Mango', 'Chocolate', 'Ice cream', 'Pizza', 'Pancake', 'Cheese', 'Honey', 'Popcorn', 'Elephant', 'Lion', 'Tiger', 'Giraffe', 'Penguin', 'Dolphin', 'Octopus', 'Shark', 'Butterfly', 'Honey bee', 'Giant panda', 'Red fox', 'Owl', 'Horse', 'Cat', 'Dog', 'Dinosaur', 'Tyrannosaurus', 'Circus', 'Lego', 'Kite', 'Toy Story', 'Frozen (2013 film)', 'The Lion King', 'Finding Nemo', 'Pokémon'];
let WORLDS_L = WORLDS, SEEDS_L = SEEDS, KIDS_L = KID_SEEDS;
// the same starting topics, as that language's Wikipedia names them
async function localiseWorlds(){
  if (LANG === 'en'){ WORLDS_L = WORLDS; SEEDS_L = SEEDS; KIDS_L = KID_SEEDS; return; }
  const all = [...new Set([...WORLDS, ...KID_SEEDS])], map = {}, chunks = []; for (let i = 0; i < all.length; i += 50) chunks.push(all.slice(i, i + 50));
  await Promise.all(chunks.map(c => fetch('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', titles: c.join('|'), prop: 'langlinks', lllang: LANG, lllimit: 'max', redirects: '1', format: 'json', formatversion: '2', origin: '*' }))
    .then(r => r.json()).then(j => { const hop = {}; (j.query.redirects || []).concat(j.query.normalized || []).forEach(x => hop[x.to] = x.from); (j.query.pages || []).forEach(pg => { const ll = pg.langlinks && pg.langlinks[0]; if (ll) map[hop[pg.title] || pg.title] = ll.title; }); }).catch(() => {})));
  const w = WORLDS.map(x => map[x]).filter(Boolean), sd = SEEDS.map(x => map[x]).filter(Boolean);
  WORLDS_L = w.length > 10 ? w : WORLDS; SEEDS_L = sd.length > 8 ? sd : WORLDS_L;
  const kd = KID_SEEDS.map(x => map[x]).filter(Boolean); KIDS_L = kd.length > 10 ? kd : SEEDS_L;
}
const langReady = localiseWorlds();
const randomWorld = () => topic(WORLDS_L[Math.floor(Math.random() * WORLDS_L.length)]);
const HUBS = /^(United States|United Kingdom|England|France|Germany|China|India|Japan|Italy|Spain|Europe|Asia|Africa|North America|South America|World War I|World War II|Christianity|Roman Empire|London|New York City|Paris|Canada|Australia|Russia|Earth|Water|Human|Science)$/;
// each link is dressed by what it is: a roof for a place, a portrait frame for a person, leaves for living things…
const KV = (() => {
  const v = {}, P = d => new Path2D(d);
  v.nature = P('M0 -50C-12 -66 -30 -64 -36 -54C-22 -46 -10 -48 0 -50C10 -48 22 -46 36 -54C30 -64 12 -66 0 -50ZM0 -50V-66');
  v.place = P('M-48 -36L0 -78L48 -36ZM22 -56V-74H32V-47');
  v.event = P('M34 -44V-94M34 -94H72L63 -82L72 -70H34Z');
  v.org = P('M-56 -40L0 -74L56 -40ZM-44 -40V-34M-22 -40V-34M0 -40V-34M22 -40V-34M44 -40V-34');
  v.vehicle = new Path2D(); v.vehicle.arc(-28, 52, 12, 0, 7); v.vehicle.moveTo(40, 52); v.vehicle.arc(28, 52, 12, 0, 7);
  v.work = P('M-66 48Q-32 36 0 50Q32 36 66 48V58Q32 46 0 60Q-32 46 -66 58ZM0 50V60');
  v.water = new Path2D(); for (let i = 0; i < 10; i++){ const a = i / 10 * Math.PI * 2; v.water.moveTo(Math.cos(a) * 58 + 3, Math.sin(a) * 58); v.water.arc(Math.cos(a) * 58, Math.sin(a) * 58, 3, 0, 7); } v.water.moveTo(62, 0); v.water.arc(0, 0, 62, 0, 7);
  v.sky = new Path2D(); v.sky.ellipse(0, 0, 82, 16, -.3, .05 * Math.PI, .95 * Math.PI);
  v.food = new Path2D(); v.food.arc(0, 0, 62, 0, 7); v.food.moveTo(-8, -70); v.food.lineTo(-8, -56); v.food.moveTo(8, -70); v.food.lineTo(8, -56);
  v.person = new Path2D(); v.person.ellipse(0, 0, 62, 69, 0, 0, Math.PI * 2); v.person.moveTo(53, 0); v.person.ellipse(0, 0, 53, 59, 0, 0, Math.PI * 2, true); v.person.moveTo(-18, 71); v.person.lineTo(18, 71); v.person.lineTo(14, 81); v.person.lineTo(-14, 81); v.person.closePath();
  v.idea = new Path2D(); for (let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2 + .2; v.idea.moveTo(Math.cos(a) * 58, Math.sin(a) * 58); v.idea.lineTo(Math.cos(a) * 72, Math.sin(a) * 72); }
  return v;
})();
const KFILL = { nature: '#6aa84f', place: '#c65a43', event: '#d1462f', org: '#e4dccd', vehicle: '#3b3b3b', work: '#9b6bb0', person: '#d7b46a' };
const KLINE = { water: '#b08a4a', sky: '#e5b53f', food: '#8fa0aa', idea: '#e5b53f' };
// a legend lurks in every world
const LEGENDS = ['Unicorn', 'Dragon', 'Kraken', 'Mermaid', 'Griffin', 'Phoenix (mythology)', 'Yeti', 'Loch Ness Monster', 'Jackalope', 'Bigfoot', 'Sea serpent', 'Pegasus'];

/* photos redrawn as pen and hatching so everything reads as one sketch */
function loadImg(src){ return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function sketchImage(src, maxW){
  const img = await loadImg(src);
  const w = Math.max(8, Math.min(maxW, img.naturalWidth)), h = Math.max(8, Math.round(img.naturalHeight * w / img.naturalWidth));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
  c.raw = img;
  let d; try { d = g.getImageData(0, 0, w, h); } catch (e) { g.filter = 'grayscale(1) contrast(1.5)'; g.drawImage(img, 0, 0, w, h); return c; }
  const px = d.data, L = new Float32Array(w * h), B = new Float32Array(w * h), M = new Float32Array(w * h), hist = [];
  for (let i = 0; i < w * h; i++) L[i] = (px[i * 4] * .3 + px[i * 4 + 1] * .59 + px[i * 4 + 2] * .11) / 255;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++){ let s = 0; for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) s += L[(y + j) * w + x + k]; B[y * w + x] = s / 9; }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++){ const i = y * w + x; const gx = B[i - w + 1] + 2 * B[i + 1] + B[i + w + 1] - B[i - w - 1] - 2 * B[i - 1] - B[i + w - 1]; const gy = B[i + w - 1] + 2 * B[i + w] + B[i + w + 1] - B[i - w - 1] - 2 * B[i - w] - B[i - w + 1]; M[i] = Math.hypot(gx, gy); if ((x + y) % 5 === 0) hist.push(M[i]); }
  hist.sort((a, b) => a - b); const T = Math.max(.12, hist[Math.floor(hist.length * .86)] || .2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const i = y * w + x, l = B[i] || L[i];
    const ink = M[i] > T || (l < .18 && ((x + y) % 3 === 0 || (x - y + 3000) % 3 === 0)) || (l < .34 && (x + y) % 4 === 0) || (l < .52 && (x + y) % 7 === 0);
    const v = ink ? 22 : 255; px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v; px[i * 4 + 3] = 255;
  }
  g.putImageData(d, 0, 0); return c;
}

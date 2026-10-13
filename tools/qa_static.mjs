// Static checks: every text key the code uses exists in all six app languages, every script/style file is present, JS parses.
import fs from 'node:fs';
import vm from 'node:vm';
const src = fs.readFileSync('js/strings.js', 'utf8');
const body = src.slice(src.indexOf('const STR = ') + 'const STR = '.length, src.indexOf('\n', src.indexOf('const STR = ')));
const STR = vm.runInNewContext('(' + body.replace(/;\s*$/, '') + ')');
const langs = Object.keys(STR), en = Object.keys(STR.en);
const code = fs.readdirSync('js').filter(f => f.endsWith('.js') && f !== 'strings.js').map(f => fs.readFileSync('js/' + f, 'utf8')).join('\n') + fs.readFileSync('index.html', 'utf8');
const used = new Set([...code.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)].map(m => m[1]));
for (const m of code.matchAll(/data-(?:i|ph)="([A-Za-z0-9_]+)"/g)) used.add(m[1]);
for (const m of code.matchAll(/\[\s*'([A-Za-z0-9_]+)'\s*,\s*'(nb[A-Za-z]+)'\s*\]/g)) used.add(m[2]);
for (const m of code.matchAll(/\['[a-z]+', '(nb[A-Za-z]+)'\]/g)) used.add(m[1]);
const missingEn = [...used].filter(k => !STR.en[k]);
const gaps = {}; for (const l of langs) { const miss = en.filter(k => !STR[l][k]); if (miss.length) gaps[l] = miss; }
console.log('languages with their own wording:', langs.join(', '), '| keys in English:', en.length, '| keys used by the code:', used.size);
console.log('used but missing in English:', missingEn.length ? missingEn : 'none');
for (const l of langs.filter(x => x !== 'en')) console.log(l, 'is missing', (gaps[l] || []).length, 'of the English keys', (gaps[l] || []).length ? '(first: ' + gaps[l].slice(0, 6).join(', ') + ')' : '');
// placeholder parity ({n}, {name}…)
let badPh = 0; for (const k of en) for (const l of langs) { if (!STR[l][k]) continue; const a = (STR.en[k].match(/\{\w+\}/g) || []).sort().join(), b = (STR[l][k].match(/\{\w+\}/g) || []).sort().join(); if (a !== b){ badPh++; console.log('placeholder mismatch', l, k, a, '|', b); } }
console.log('placeholder mismatches:', badPh);
// files referenced by index.html
const html = fs.readFileSync('index.html', 'utf8'); let missingFiles = 0;
for (const m of html.matchAll(/(?:src|href)="((?!https?:|data:|#|mailto:)[^"]+)"/g)){ const f = m[1].split('?')[0]; if (!fs.existsSync(f)){ missingFiles++; console.log('MISSING FILE', f); } }
console.log('files referenced by index.html but missing:', missingFiles);
const sw = fs.readFileSync('sw.js', 'utf8'); const shell = [...sw.matchAll(/'([^']+\.(?:js|css|html|webmanifest|png))'/g)].map(m => m[1]); const swMissing = shell.filter(f => !fs.existsSync(f)); console.log('service worker lists', shell.length, 'files; missing:', swMissing.length ? swMissing : 'none');
const jsOnDisk = fs.readdirSync('js').map(f => 'js/' + f), unlisted = jsOnDisk.filter(f => !shell.includes(f)); console.log('js files not in the service worker list:', unlisted.length ? unlisted : 'none');
const days = fs.readdirSync('daily').filter(f => /^\d{4}-\d\d-\d\d\.json$/.test(f)).map(f => f.slice(0, 10)).sort(); const today = new Date().toISOString().slice(0, 10), ahead = days.filter(d => d >= today);
const bad = days.filter(d => { try { const r = JSON.parse(fs.readFileSync(`daily/${d}.json`, 'utf8')).route; return !Array.isArray(r) || r.length !== 5; } catch (e) { return true; } });
const gapsAhead = []; for (let i = 0; i < 14; i++){ const d = new Date(Date.now() + i * 864e5).toISOString().slice(0, 10); if (!days.includes(d)) gapsAhead.push(d); }
console.log('daily routes on disk:', days.length, '| from today on:', ahead.length, '| malformed:', bad.length ? bad : 'none', '| next 14 days with no file:', gapsAhead.length ? gapsAhead : 'none');

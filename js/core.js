'use strict';
/* Each topic is a disc of radius R0. Its links spiral inward toward a hole of radius RH at the centre,
   big and prominent on the outside, smaller and deeper toward the middle. The hole holds the next topic,
   shrunk by K, so its own outer ring carries straight on from this one's inner ring. */
const R0 = 480, K = 20, RH = R0 / K, MAXN = 500, PER_FOLD = 70, INK = '#161616', SPOT = '#d1462f';
const gen = rough.generator();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hash(s){ let h = 2166136261; for (const c of s){ h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = d => gen.toPaths(d).map(p => ({ p: new Path2D(p.d), s: p.stroke, w: p.strokeWidth, f: p.fill }));

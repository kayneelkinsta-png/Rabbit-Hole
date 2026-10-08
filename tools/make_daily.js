// Builds the published daily routes (daily/<date>.json), so everyone gets the same challenge each day.
// Used two ways:
//  - automatically, every night, by .github/workflows/daily.yml (through tools/make_daily_ci.mjs), which keeps the next
//    two weeks of routes filled in;
//  - by hand: open the app on localhost (python -m http.server 5178) in English (?w=Octopus&l=en), paste this file in the
//    browser console, then run  makeDaily(['2026-10-05', '2026-10-06']).then(r => console.log(JSON.stringify(r)))
// and save each entry as daily/<date>.json containing {"route": [...titles]}.
// Quality rules: the goal must be something you can picture (a person, animal, place, vehicle, food, work, organisation,
// sea or sky object), never an idea or an event; at most one idea among the stops in between; the start world can't
// repeat within 10 days; no goal repeats; no politics, religion or violence as the goal or running through the route;
// no taxa or abstractions as the goal. Failing routes are rebuilt from another seed (up to 20 tries; if none
// passes, the day is left without a file (the app then builds that day's route itself from a seed) and the next run tries again).
// Go gently: one route at a time with pauses, because Wikipedia answers 429 if it is hammered.
// Other languages are translated at play time through Wikipedia's language links, so only English titles are stored.
async function makeDaily(days, existing = {}, log = () => {}){
  const GOOD = new Set(['person', 'nature', 'place', 'vehicle', 'food', 'work', 'org', 'water', 'sky']);
  const BAD_GOAL = /extinction|collapse|unicode|atomic|^list of|index$|president of|theorem|equation|syndrome|disease|^(early|middle|late) |\(biology\)|^provinces? of|party$|engineering$|dwarf planet|polymorphism|^city status|paleomap|apsis/i;
  // a daily for everyone (schools included): no politics, religion or violence as the goal, and not threaded through them; no taxa or abstractions as the goal
  const SENSITIVE = /\b(religio\w*|politic\w*|president|prime minister|election|party|war|genocide|nazi\w*|terror\w*|massacre|slave\w*|faith|buddh\w*|christian\w*|islam\w*|muslim|jew\w*|hindu\w*|baha\w*|b[aá]b\w*|prophet|god|church|bishop|pope|astrolog\w*)\b/i;
  const ABSTRACT = /\b(genus|order of|family of|class of|taxon|species of|subfamily|clade|geologic\w*|epoch|period|province|dwarf planet|branch of|field of|study of|process|concept|astronom\w*|mathemat\w*|politician|engineering|speaker of)\b/i;
  const out = {}, all = () => Object.assign({}, existing, out);
  const cfg = GAME_LEVELS.adventurer, kind = T => kindOf((T.desc || '') + ' ' + T.title);
  const near = day => Object.entries(all()).filter(([d, r]) => r && Math.abs(new Date(d) - new Date(day)) <= 10 * 864e5);
  // the goal must be well known: at least 15,000 page views in the last 30 days
  const views = async title => { const j = await q({ action: 'query', prop: 'pageviews', pvipdays: '30', titles: title }).catch(() => null); const p = j && j.query && j.query.pages && j.query.pages[0]; return p && p.pageviews ? Object.values(p.pageviews).reduce((a, b) => a + (b || 0), 0) : 0; };
  const fine = async (route, day) => {
    const goal = route[route.length - 1], mid = route.slice(1, -1);
    if (!GOOD.has(kind(goal)) || BAD_GOAL.test(goal.title) || isDry({ title: goal.title, desc: goal.desc })) return false;
    if (SENSITIVE.test(goal.title + ' ' + (goal.desc || '')) || ABSTRACT.test(goal.desc || '')) return false;
    if (mid.filter(T => SENSITIVE.test(T.title + ' ' + (T.desc || ''))).length > 1) return false;
    if (mid.filter(T => kind(T) === 'idea').length > 1) return false;
    if (near(day).some(([, r]) => r[0] === route[0].title)) return false;
    if (Object.values(all()).some(r => r && r[r.length - 1] === goal.title)) return false;
    return (await views(goal.title)) >= 15000;
  };
  for (const day of days){
    let best = null;
    for (let n = 0; n < 20; n++){
      await sleep(2500);
      let r = null; try { r = await buildRound(cfg, rng(hash('rabbit-hole|' + day + '|' + n))); } catch (e) { log(day + ' error ' + e.message); }
      if (!r) continue;
      if (await fine(r, day)){ best = r; log(day + ' ok after ' + (n + 1)); break; }
    }
    out[day] = best ? best.map(T => T.title) : null;
    log(day + ': ' + (out[day] ? out[day].join(' > ') : 'FAILED'));
  }
  return out;
}

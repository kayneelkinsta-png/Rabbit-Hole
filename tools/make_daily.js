// Builds the published daily routes (daily/<date>.json), so everyone gets the same challenge each day.
// How to use: open the app on localhost (python -m http.server 5178) in English (?w=Octopus&l=en), paste this in the
// browser console, set FROM and DAYS, keep the tab in front, wait for `window.__dailyFinished`, then save each entry of
// `window.__daily` as daily/<date>.json containing {"route": [...titles]}, and read through the list.
// Quality rules: the goal must be something you can picture (a person, animal, place, vehicle, food, work, organisation,
// sea or sky object), never an idea or an event; at most one idea among the stops in between; the start world can't
// repeat within 10 days; no goal repeats. Failing routes are rebuilt from another seed (up to 10 tries).
// Other languages are translated at play time through Wikipedia's language links, so only English titles are stored.
(() => {
  const FROM = '2026-10-05', DAYS = 70, GOOD = new Set(['person', 'nature', 'place', 'vehicle', 'food', 'work', 'org', 'water', 'sky']);
  const BAD_GOAL = /extinction|collapse|unicode|atomic|^list of|index$|president of|theorem|equation|syndrome|disease/i;
  window.__daily = {}; window.__dailyLog = [];
  const start = new Date(FROM + 'T00:00:00Z'), days = [];
  for (let i = 0; i < DAYS; i++) days.push(new Date(start.getTime() + i * 864e5).toISOString().slice(0, 10));
  const cfg = GAME_LEVELS.adventurer, kind = T => kindOf((T.desc || '') + ' ' + T.title);
  const near = day => Object.entries(window.__daily).filter(([d, r]) => r && Math.abs(new Date(d) - new Date(day)) <= 10 * 864e5);
  const fine = (route, day) => {
    const goal = route[route.length - 1], mid = route.slice(1, -1);
    if (!GOOD.has(kind(goal)) || BAD_GOAL.test(goal.title) || isDry({ title: goal.title, desc: goal.desc })) return false;
    if (mid.filter(T => kind(T) === 'idea').length > 1) return false;
    if (near(day).some(([, r]) => r[0] === route[0].title)) return false;
    return !Object.values(window.__daily).some(r => r && r[r.length - 1] === goal.title);
  };
  let idx = 0;
  async function worker(){
    while (idx < days.length){
      const day = days[idx++]; let best = null;
      for (let n = 0; n < 10; n++){
        let r = null; try { r = await buildRound(cfg, rng(hash('rabbit-hole|' + day + '|' + n))); } catch (e) { window.__dailyLog.push(day + ' err ' + e.message); }
        if (!r) continue;
        if (!best) best = r;
        if (fine(r, day)){ best = r; window.__dailyLog.push(day + ' ok after ' + (n + 1)); break; }
      }
      window.__daily[day] = best ? best.map(T => T.title) : null;
    }
  }
  window.__dailyDone = Promise.all([worker(), worker(), worker()]).then(() => { window.__dailyFinished = true; });
})();

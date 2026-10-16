'use strict';
/* ─────────── 3D view (prototype): every world as a real bowl you look down into ───────────
   Open with ?3d, the "3D" button, or the 3 key. It only reads the same state the 2D view uses (cur, cam, nextOf, choose),
   so diving, climbing, the card, the notebook and the game all keep working. The 2D canvas is hidden while this is on.
   The camera never moves: the dive is the whole scene growing by K^t around the hole, with the next world already
   sitting in the hole at 1/K size, which is the same trick the 2D view plays. */
(function(){
const START = /[?&]3d\b/.test(location.search);
let THREE = null, loading = null, R = null, active = false, fx = null;
const lg = { theta: .5, phi: 1.0, dTheta: 0, dragging: false };   // orbit: azimuth and angle down from straight above
const groups = new Map();           // topic → built bowl
const lab = [];                     // pooled labels
let root, curRoot, holder, scene, cam3, c3, labBox, hoverIt = null, ringMesh, motes, stars, lastT = 0, spin = 0, curBuilt = null, childBuilt = null, imgT = 0;
const DEPTH = .55 * R0, hAt = rho => -DEPTH * Math.pow(Math.max(0, 1 - rho / R0), 1.6);

async function load(){
  if (loading) return loading;
  return loading = (async () => {
    THREE = await import('three');
    let EC, RP, UB, OP;
    try { [EC, RP, UB, OP] = await Promise.all(['postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/UnrealBloomPass.js', 'postprocessing/OutputPass.js'].map(f => import('three/addons/' + f))); } catch (e) { EC = null; }
    c3 = document.createElement('canvas'); c3.id = 'c3'; c3.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;display:none';
    cv.after(c3);
    labBox = document.createElement('div'); labBox.id = 'l3'; labBox.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;display:none;font:15px "Patrick Hand",system-ui,sans-serif';
    c3.after(labBox);
    R = new THREE.WebGLRenderer({ canvas: c3, antialias: true, powerPreference: 'high-performance' });
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.15;
    scene = new THREE.Scene(); scene.background = new THREE.Color('#0b0f1e'); scene.fog = null;
    cam3 = new THREE.PerspectiveCamera(40, 1, 1, 1e6);
    scene.add(new THREE.AmbientLight('#b8c4ff', .35));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(-R0, R0 * 1.6, R0 * .8); scene.add(sun);
    scene.add(new THREE.HemisphereLight('#a9b8ff', '#1a1030', .9));
    root = new THREE.Group(); scene.add(root);
    // far stars (don't scale with the dive) and dust circling the mouth of the bowl
    { const n = 1400, p = new Float32Array(n * 3); for (let i = 0; i < n; i++){ const u = Math.random() * 2 - 1, a = Math.random() * 6.283, s = Math.sqrt(1 - u * u), r = R0 * (14 + Math.random() * 10); p[i * 3] = s * Math.cos(a) * r; p[i * 3 + 1] = u * r; p[i * 3 + 2] = s * Math.sin(a) * r; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd8ff', size: 4, sizeAttenuation: false, transparent: true, opacity: .8, depthWrite: false, map: dot(), alphaTest: .02 })); scene.add(stars); }
    { const n = 420, p = new Float32Array(n * 3), cl = new Float32Array(n * 3), c = new THREE.Color();
      for (let i = 0; i < n; i++){ const r = R0 * (1.03 + 1.5 * Math.pow(Math.random(), 1.8)), a = Math.random() * 6.283; p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = (Math.random() - .5) * R0 * .12 * (r / R0); p[i * 3 + 2] = Math.sin(a) * r; c.set(Math.random() < .12 ? '#ffd9a0' : Math.random() < .2 ? '#bff3ff' : '#c9d6ff'); cl.set([c.r, c.g, c.b], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
      motes = new THREE.Points(g, new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: .9, depthWrite: false, map: dot(), alphaTest: .02, blending: THREE.AdditiveBlending })); root.add(motes); }
    // the red ring round the orb the hole currently leads to
    ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1, .06, 10, 48), new THREE.MeshBasicMaterial({ color: SPOT, transparent: true, opacity: .95, depthTest: false })); ringMesh.renderOrder = 5; ringMesh.visible = false;
    if (EC){
      fx = new EC.EffectComposer(R); fx.addPass(new RP.RenderPass(scene, cam3));
      fx.bloom = new UB.UnrealBloomPass(new THREE.Vector2(256, 256), (.32), .6, .9); fx.addPass(fx.bloom); fx.addPass(new OP.OutputPass());
    }
    resize3(); addEventListener('resize', resize3); if (window.visualViewport) visualViewport.addEventListener('resize', resize3);
    wire();
  })();
}

function resize3(){
  if (!R) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  R.setPixelRatio(dpr); R.setSize(innerWidth, innerHeight, false); cam3.aspect = innerWidth / innerHeight; cam3.updateProjectionMatrix();
  if (fx){ fx.setPixelRatio(dpr); fx.setSize(innerWidth, innerHeight); }
}

/* ── building a world ── */
const glowTex = new Map();
let dotTex = null;
function dot(){ if (!dotTex) dotTex = glowFor('#ffffff'); return dotTex; }
function glowFor(col){
  if (glowTex.has(col)) return glowTex.get(col);
  let tx; try { tx = new THREE.CanvasTexture(glowDot(/^#[0-9a-f]{6}$/i.test(col) ? col : '#c9d6ff')); tx.colorSpace = THREE.SRGBColorSpace; } catch (e) { tx = null; }
  glowTex.set(col, tx); return tx;
}
let shellGeo = null;
function palette(T){ const p = GBG[T.setting] || GBG.lab; return p.map(c => new THREE.Color(c)); }

function build(T){
  const g = new THREE.Group(), [deep, mid, light] = palette(T), RHt = T.RH;
  // the bowl: a lathe of the funnel profile with the hole cut out of the middle
  const pts = []; for (let i = 0; i <= 72; i++){ const rho = RHt + (R0 * 1.06 - RHt) * Math.pow(i / 72, 1.6); pts.push(new THREE.Vector2(rho, hAt(rho))); }
  const bg = new THREE.LatheGeometry(pts, 120), pos = bg.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++){ const u = Math.min(1, Math.hypot(pos.getX(i), pos.getZ(i)) / R0); (u < .5 ? c.copy(deep).lerp(mid, u / .5) : c.copy(mid).lerp(light, (u - .5) / .5)).multiplyScalar(.3 + .55 * u); col.set([c.r, c.g, c.b], i * 3); }
  bg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const bowl = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .15, side: THREE.DoubleSide, emissive: mid, emissiveIntensity: .12 }));
  g.add(bowl);
  const grid = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: light, wireframe: true, transparent: true, opacity: .035, depthWrite: false })); g.add(grid);
  // the lip of the hole, glowing
  const lip = new THREE.Mesh(new THREE.TorusGeometry(RHt, RHt * .07, 8, 72), new THREE.MeshBasicMaterial({ color: light })); lip.rotation.x = Math.PI / 2; lip.position.y = hAt(RHt); g.add(lip);
  { const gt = glowFor('#9fb4ff'); if (gt){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: .55 })); s.scale.setScalar(RHt * 4); s.position.y = hAt(RHt); g.add(s); } }
  // until the next world is ready it's a dark hole, as in 2D
  const hole = new THREE.Mesh(new THREE.CircleGeometry(RHt * 1.02, 48), new THREE.MeshBasicMaterial({ color: '#05060e' })); hole.rotation.x = -Math.PI / 2; hole.position.y = hAt(RHt) - RHt * .02; g.add(hole);
  if (!shellGeo) shellGeo = new THREE.SphereGeometry(1, 28, 18);
  const orbs = [];
  T.items.forEach((it, i) => {
    if (!(it.r > 0)) return;
    const rho = Math.hypot(it.x, it.y), r = it.r * .92, y = hAt(rho) + r * 1.15;
    const og = new THREE.Group(); og.position.set(it.x, y, it.y);
    const shell = new THREE.Mesh(shellGeo, new THREE.MeshPhysicalMaterial({ color: it.wash, roughness: .12, metalness: 0, clearcoat: 1, clearcoatRoughness: .1, transparent: true, opacity: .62, emissive: it.wash, emissiveIntensity: .22, depthWrite: false }));
    shell.scale.setScalar(r); shell.renderOrder = 1; shell.userData.i = i; og.add(shell);
    const gt = glowFor(it.wash); let glow = null;
    if (gt){ glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: .45 })); glow.scale.setScalar(r * 3.6); glow.renderOrder = 0; og.add(glow); }
    g.add(og); orbs.push({ it, i, og, shell, glow, photo: null, r, phase: it.phase || 0 });
  });
  return { T, g, orbs, hole, shells: orbs.map(o => o.shell), K: T.K };
}

// a round photo inside the glass, facing the viewer
function addPhoto(o){
  const it = o.it, b = it.bmp && it.bmp.raw; if (!b || o.photo) return;
  const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), sw = Math.min(b.width, b.height);
  g.beginPath(); g.arc(80, 80, 78, 0, 7); g.clip(); try { g.drawImage(b.raw || b, (b.width - sw) / 2, (b.height - sw) / 2, sw, sw, 0, 0, 160, 160); } catch (e) { o.photo = false; return; }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, toneMapped: false })); s.scale.setScalar(o.r * 1.62); s.renderOrder = 2; o.og.add(s); o.photo = s;
}

function dispose(b){
  b.g.traverse(o => { if (o.geometry && o.geometry !== shellGeo) o.geometry.dispose(); const m = o.material; if (m){ if (m.map && m.map !== glowTex.get(m.map)) m.map.dispose?.(); m.dispose(); } });
}
function builtFor(T){
  if (!T || T.status !== 'ready' || !T.items || !T.items.length && !T.box) return null;
  let b = groups.get(T);
  if (!b){ b = build(T); groups.set(T, b); if (groups.size > 10){ const [k, v] = groups.entries().next().value; if (v !== curBuilt && v !== childBuilt){ groups.delete(k); dispose(v); } } }
  return b;
}

/* ── labels ── */
function label(n){
  while (lab.length <= n){ const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;padding:3px 11px;border-radius:99px;background:rgba(14,18,40,.68);color:#eef1ff;border:1px solid rgba(190,205,255,.35);backdrop-filter:blur(4px);transform-origin:0 0;will-change:transform'; labBox.appendChild(d); lab.push(d); }
  return lab[n];
}

/* ── input ── */
function wire(){
  const ptrs = new Map(); let moved = 0, pinch = 0, ray = new THREE.Raycaster(), v = new THREE.Vector2();
  const pick = (x, y) => {
    if (!curBuilt) return null;
    v.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(v, cam3);
    const h = ray.intersectObjects(curBuilt.shells, false)[0]; if (!h) return null;
    const it = curBuilt.T.items[h.object.userData.i]; if (!it || (game.on && it.paper)) return null;
    return { T: curBuilt.T, i: h.object.userData.i, it };
  };
  c3.addEventListener('pointerdown', e => { c3.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; lg.dragging = true; stopFall(); if (ptrs.size === 2){ const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
  c3.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p){ const h = pick(e.clientX, e.clientY); hoverIt = h ? h.it : null; c3.classList.toggle('over', !!h); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 2){ const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) cam.s *= d / pinch; pinch = d; return; }
    lg.theta -= dx * .006; lg.phi = clamp(lg.phi - dy * .005, .25, 1.45); lg.dTheta = -dx * .006;
  });
  const up = e => {
    if (!ptrs.delete(e.pointerId)) return; pinch = 0; if (ptrs.size) return; lg.dragging = false;
    if (moved < 6 && e.type === 'pointerup'){ const h = pick(e.clientX, e.clientY); if (h) choose(h); }
  };
  c3.addEventListener('pointerup', up); c3.addEventListener('pointercancel', up);
  c3.addEventListener('pointerleave', () => { hoverIt = null; c3.classList.remove('over'); });
  c3.addEventListener('wheel', e => { e.preventDefault(); stopFall(); cam.s *= Math.exp(-e.deltaY * (e.deltaMode ? .05 : e.ctrlKey ? .012 : .0016)); }, { passive: false });
  c3.addEventListener('contextmenu', e => e.preventDefault());
}

/* ── drawing ── */
function frame3(now){
  if (!active) return;
  requestAnimationFrame(frame3);
  const dt = Math.min(.05, (now - (lastT || now)) / 1000); lastT = now;
  const hide = introPlaying || !cur; c3.style.visibility = labBox.style.visibility = hide ? 'hidden' : 'visible'; if (hide) return;
  try { draw3(now / 1000, dt); } catch (e) { console.error(e); }
}

function draw3(time, dt){
  const T = cur, b = builtFor(T);
  if (b !== curBuilt){ if (curBuilt) root.remove(curBuilt.g); curBuilt = b; if (b){ b.g.userData.born = time; root.add(b.g); curRoot = b.g; } }
  const ch = nextOf(T), cb = ch && ch.status === 'ready' && ch.items && ch.items.length ? builtFor(ch) : null;
  if (cb !== childBuilt){
    if (childBuilt){ root.remove(holder); holder = null; }
    childBuilt = cb;
    if (cb){ holder = new THREE.Group(); holder.add(cb.g); holder.scale.setScalar(1 / T.K); holder.position.y = hAt(T.RH); root.add(holder); }
  }
  if (b) b.hole.visible = !childBuilt;
  // photos: ask for the biggest orbs' pictures, and pin them in as they arrive
  if (b && time - imgT > .8){ imgT = time; const now = performance.now(); b.orbs.slice(0, 70).forEach((o, k) => { o.it.lastPx = Math.max(o.it.lastPx || 0, 90 - k); o.it.seen = now; wantImg(o.it); }); }
  if (b){ let n = 0; for (const o of b.orbs){ if (o.photo === null && o.it.bmp){ addPhoto(o); if (++n >= 4) break; } } }

  // zoom: S is exactly how much bigger than its resting size this world is drawn, so the next world (in the hole at 1/K) is
  // S/K and the hand-over when cam.s drops by K changes nothing on screen. Near the hole the view slides from the middle
  // of the bowl to the middle of the next world, which is where the next world's own resting view looks.
  const K = T.K, k0 = restDiag() / (R0 * fitS()), S = clamp(cam.s / fitS(), .35, 1e7), u = cam.s * R0 / restDiag() / K, w = smooth01(.12, .85, u);
  const c0 = new THREE.Vector3(0, -DEPTH * .42, 0), pivot = c0.clone().lerp(new THREE.Vector3(0, hAt(T.RH) - DEPTH * .42 / K, 0), w);
  const born = b ? clamp((time - b.g.userData.born) * 1.6, 0, 1) : 1;
  root.scale.setScalar(S); root.position.copy(pivot).multiplyScalar(-S);
  if (!lg.dragging){ spin += dt * .045; lg.theta += lg.dTheta * .5; } lg.dTheta *= .92;
  root.rotation.y = lg.theta - cam.phi + spin;
  if (motes) motes.rotation.y = -time * .05;
  // camera: fixed orbit round the origin, sized and placed like the 2D view (in the free space between the title and the controls)
  const fov = cam3.fov * Math.PI / 180, dist = innerHeight / (2 * fitS() * Math.tan(fov / 2)), ph = lg.phi;
  cam3.position.set(0, Math.cos(ph) * dist, Math.sin(ph) * dist); cam3.lookAt(0, 0, 0);
  cam3.setViewOffset(innerWidth, innerHeight, W / 2 - CXt, H / 2 - CYt, innerWidth, innerHeight);
  if (curBuilt){ for (const o of curBuilt.orbs){ const bob = Math.sin(time * 1.1 + o.phase) * o.r * .05; o.og.position.y = hAt(Math.hypot(o.it.x, o.it.y)) + o.r * 1.15 + bob; o.og.scale.setScalar(born < 1 ? Math.min(1, Math.max(0, born * 1.4 - (Math.hypot(o.it.x, o.it.y) / R0) * .4)) + .0001 : 1 + (o.it === hoverIt ? .14 : 0)); } }

  // chosen orb: red ring; labels for the biggest orbs and whichever is under the pointer
  ringMesh.visible = false;
  const nx = T.chosen || T.jump ? T.items[T.next] : null;
  if (curBuilt && nx){ const o = curBuilt.orbs.find(q => q.it === nx); if (o){ if (ringMesh.parent !== o.og) o.og.add(ringMesh); ringMesh.position.set(0, 0, 0); ringMesh.scale.setScalar(o.r * 1.18); ringMesh.visible = true; ringMesh.quaternion.copy(cam3.quaternion); ringMesh.quaternion.premultiply(o.og.parent.getWorldQuaternion(new THREE.Quaternion()).invert()); } }
  placeLabels(nx);

  // render
  scene.updateMatrixWorld();
  if (fx){ fx.render(); } else R.render(scene, cam3);
}

function placeLabels(nx){
  const list = []; let n = 0;
  if (curBuilt){
    const W3 = innerWidth, H3 = innerHeight, vec = new THREE.Vector3();
    const cand = curBuilt.orbs.slice(0, 18); if (hoverIt){ const h = curBuilt.orbs.find(q => q.it === hoverIt); if (h && !cand.includes(h)) cand.push(h); }
    for (const o of cand){
      if (!(o.og.scale.x > .95)) continue;
      o.og.getWorldPosition(vec); const dist = vec.distanceTo(cam3.position); vec.project(cam3);
      if (vec.z > 1 || Math.abs(vec.x) > 1.05 || Math.abs(vec.y) > 1.05) continue;
      const wr = o.r * root.scale.x, px = wr / (dist * Math.tan(cam3.fov * Math.PI / 360)) * H3 / 2;
      if (px < 26 && o.it !== hoverIt && o.it !== nx) continue;
      const d = label(n++), name = o.it.title.replace(/ \(.*\)$/, ''), chosen = o.it === nx, hot = o.it === hoverIt;
      if (d.textContent !== name) d.textContent = name;
      d.style.display = 'block'; d.style.background = chosen ? SPOT : 'rgba(14,18,40,.68)'; d.style.zIndex = hot ? 3 : chosen ? 2 : 1; d.style.fontSize = (hot ? 17 : clamp(px * .26, 12, 16)) + 'px';
      const x = (vec.x * .5 + .5) * W3, y = (-vec.y * .5 + .5) * H3 + px * .95;
      d.style.transform = `translate(${x}px,${y}px) translate(-50%,0)`;
    }
  }
  for (let i = n; i < lab.length; i++) lab[i].style.display = 'none';
}

/* ── switching ── */
async function setOn(v){
  if (v === active) return;
  if (v){
    btn.disabled = true; try { await load(); } catch (e) { console.error(e); btn.disabled = false; btn.title = '3D needs WebGL and the three.js library'; return; } btn.disabled = false;
    active = true; cv.style.display = 'none'; c3.style.display = labBox.style.display = 'block'; lastT = 0; resize3(); document.body.classList.add('v3'); requestAnimationFrame(frame3);
  } else { active = false; cv.style.display = ''; if (c3){ c3.style.display = 'none'; labBox.style.display = 'none'; } document.body.classList.remove('v3'); }
  btn.classList.toggle('on', active); btn.setAttribute('aria-pressed', String(active));
}
const btn = document.createElement('button');
btn.id = 'view3'; btn.type = 'button'; btn.textContent = '3D'; btn.title = 'Look at this world in 3D (key 3)'; btn.setAttribute('aria-label', '3D view'); btn.setAttribute('aria-pressed', 'false');
btn.style.cssText = 'font:600 13px system-ui,sans-serif;letter-spacing:.04em';
(document.getElementById('btns') || document.body).appendChild(btn);
btn.addEventListener('click', () => setOn(!active));
addEventListener('keydown', e => { if (e.key === '3' && !typingIn(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) setOn(!active); });
window.view3d = { set: setOn, get on(){ return active; } };
if (START) setOn(true);
})();

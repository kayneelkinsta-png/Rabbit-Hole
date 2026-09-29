// The opening: hundreds of real Wikipedia article titles drift like a galaxy, start to swirl, and are pulled
// down a funnel into a ring of glass light, the rabbit hole. RABBIT HOLE appears; then we're pulled in after
// them, and land in the app's first world.
//   import('./intro.js').then(m => m.playIntro({ titles, onReveal, onDone }))
// onReveal fires as the intro starts fading away (show the app then); onDone once it's gone.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const V3 = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const rand = (a, b) => a + Math.random() * (b - a);

// when things happen, in seconds
const T = { wordsIn: 0, swirl: 1.3, titleIn: 2.1, titleOut: 4.9, dive: 4.9, flash: 6.7, reveal: 7.2 };

// things people love to fall down rabbit holes about
const EXTRA = ['Albert Einstein', 'Marie Curie', 'William Shakespeare', 'Mona Lisa', 'Ludwig van Beethoven', 'Photosynthesis', 'DNA', 'Solar System', 'Milky Way', 'Ancient Rome', 'Atlantis', 'Dragon', 'Unicorn', 'Kraken', 'Titanic', 'Apollo 11', 'Wright brothers', 'Internet', "Rubik's Cube", 'Olympic Games', 'Surfing', 'Tsunami', 'Amazon River', 'Nile', 'Sahara', 'Antarctica', 'Iceland', 'Mongolia', 'Petra', 'Angkor Wat', 'Taj Mahal', 'Eiffel Tower', 'Statue of Liberty', 'Sydney Opera House', 'Galápagos Islands', 'Grand Canyon', 'Mariana Trench', 'Vanilla', 'Saffron', 'Gold', 'Diamond', 'Meteorite', 'Comet', 'Jupiter', 'Neptune', 'International Space Station', 'Hubble Space Telescope', 'Pterosaur', 'Woolly mammoth', 'Great white shark', 'Axolotl', 'Platypus', 'Red panda', 'Firefly', 'Bioluminescence', 'Fossil', 'Gravity', 'Magnetism', 'Electricity', 'Opera', 'Hip hop', 'Animation', 'Poetry', 'Greek mythology', 'Fairy tale', 'Knight', 'Ninja', 'Astronaut', 'Fireworks', 'Paper plane', 'Northern lights', 'Pompeii', 'Easter Island', 'Terracotta Army', 'Rosetta Stone', 'Tutankhamun', 'Cleopatra', 'Genghis Khan', 'Ada Lovelace', 'Isaac Newton', 'Charles Darwin', 'Frida Kahlo', 'Vincent van Gogh', 'The Beatles', 'Hedy Lamarr', 'Nikola Tesla', 'Sherlock Holmes', 'Alice in Wonderland', 'Stradivarius', 'Venus flytrap', 'Giant squid', 'Emperor penguin', 'Monarch butterfly', 'Sloth', 'Narwhal', 'Honeycomb', 'Quicksand', 'Geyser', 'Stalactite', 'Eclipse', 'Supernova', 'Saturn V', 'Mount Fuji', 'Bermuda Triangle', 'Loch Ness Monster', 'Crop circle', 'Morse code', 'Enigma machine', 'Abacus', 'Sundial', 'Hourglass', 'Samurai', 'Pirate', 'Treasure', 'Ice age', 'Stone Age', 'Aztecs', 'Maya civilization', 'Inca Empire', 'Ancient Egypt', 'Colosseum', 'Machu Picchu'];

export async function playIntro({ titles = [], strings = {}, onReveal = () => {}, onDone = () => {} } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { onReveal(); onDone(); return; }
  const phone = matchMedia('(pointer:coarse)').matches || innerWidth < 760;

  // ---------- page layer ----------
  const root = document.createElement('div');
  root.id = 'rhIntro';
  root.innerHTML = `<style>
    #rhIntro{position:fixed;inset:0;z-index:1000;background:#05070f;transition:opacity 1s ease;touch-action:none}
    #rhIntro canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block}
    #rhIntro .skip{position:absolute;right:16px;top:calc(14px + env(safe-area-inset-top));font:500 13px/1 -apple-system,"SF Pro Text","Segoe UI",system-ui,sans-serif;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:9px 15px;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);cursor:pointer;opacity:0;transition:opacity .8s}
    #rhIntro .skip:hover{background:rgba(255,255,255,.18)}
    #rhIntro .title{position:absolute;left:0;right:0;top:15%;text-align:center;pointer-events:none;opacity:0;transform:translateY(10px) scale(.98);transition:opacity 1.1s ease,transform 1.4s cubic-bezier(.2,.8,.2,1),filter 1.1s;filter:blur(8px)}
    #rhIntro .title.on{opacity:1;transform:none;filter:none}
    #rhIntro .title.out{opacity:0;transform:translateY(-24px) scale(1.04);filter:blur(6px);transition-duration:.8s}
    #rhIntro .title h1{margin:0;font:700 clamp(34px,8.6vw,92px)/1 -apple-system,"SF Pro Display","Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;letter-spacing:.3em;text-indent:.3em;text-transform:uppercase;
      background:linear-gradient(100deg,#9fb3ff 0%,#ffffff 30%,#dfe6ff 45%,#ffffff 52%,#a9b8ff 70%,#ffffff 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;
      filter:drop-shadow(0 0 22px rgba(120,150,255,.55));animation:rhShine 3.2s ease-in-out infinite}
    #rhIntro .title p{margin:18px 0 0;font:600 clamp(10px,1.6vw,13px)/1 -apple-system,"SF Pro Text","Segoe UI",system-ui,sans-serif;letter-spacing:.48em;text-indent:.48em;text-transform:uppercase;color:rgba(226,232,255,.78)}
    @keyframes rhShine{0%{background-position:100% 0}100%{background-position:-50% 0}}
    #rhIntro .flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 52%,#ffffff 0%,#e3eaff 20%,#8ea6ff 46%,rgba(30,40,110,.9) 74%,#0b0f1e 100%);opacity:0;pointer-events:none}
  </style><button class="skip" type="button"></button><div class="title"><h1>Rabbit Hole</h1><p></p></div><div class="flash"></div>`;
  document.body.appendChild(root);
  const skipBtn = root.querySelector('.skip'), titleEl = root.querySelector('.title'), flash = root.querySelector('.flash');
  skipBtn.textContent = strings.skip || 'Skip intro'; titleEl.querySelector('p').textContent = strings.tagline || 'a world to discover';
  skipBtn.onclick = () => { window.rhSkipIntro = true; };   // a tap while the scene is still being built skips as soon as it starts

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.5 : 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  root.prepend(renderer.domElement);
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 16)));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05070f');
  const camera = new THREE.PerspectiveCamera(phone ? 58 : 44, innerWidth / innerHeight, .02, 200);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .62, .45, .96);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  new RGBELoader().loadAsync('assets/hdri/studio_small_09_1k.hdr').then(t => {
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(t).texture; t.dispose(); pm.dispose();
  }).catch(() => {});

  // ---------- the words ----------
  // in another language, only its own titles (the English extras would look out of place)
  const pool = document.documentElement.lang && document.documentElement.lang !== 'en' && titles.length > 20 ? titles : [...titles, ...EXTRA];
  const names = [...new Set(pool.map(t => t.replace(/ \(.*\)$/, '')))].sort(() => Math.random() - .5).slice(0, phone ? 170 : 240);
  const atlas = wordAtlas(names);
  const N = atlas.rects.length, R_MAX = 9.5;
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.attributes.position = base.attributes.position;
  const aRect = new Float32Array(N * 4), aSize = new Float32Array(N * 2), aP = new Float32Array(N * 4), aCol = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const r = atlas.rects[i], h = rand(.15, .25) * (phone ? 1.2 : 1);
    aRect.set([r.u, r.v, r.w, r.h], i * 4);
    aSize.set([h * r.aspect, h], i * 2);
    // a loose three-armed spiral galaxy
    const r0 = 1.3 + Math.pow(Math.random(), .8) * (R_MAX - 1.3), arm = (i % 3) * Math.PI * 2 / 3;
    aP.set([r0, arm + r0 * .55 + rand(-.55, .55), rand(.8, 1.25), Math.random()], i * 4);
    const gold = Math.random() < .12, cyan = !gold && Math.random() < .2;
    aCol.set(gold ? [1, .84, .56, 1] : cyan ? [.7, .95, 1, 1] : [.86, .9, 1, rand(.55, 1)], i * 4);
  }
  geo.setAttribute('aRect', new THREE.InstancedBufferAttribute(aRect, 4));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(aSize, 2));
  geo.setAttribute('aP', new THREE.InstancedBufferAttribute(aP, 4));
  geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(aCol, 4));
  geo.instanceCount = N;
  const wordsMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uDim: { value: 1 }, uAtlas: { value: atlas.texture } },
    vertexShader: `
      uniform float uT, uDim;
      attribute vec4 aRect; attribute vec2 aSize; attribute vec4 aP; attribute vec4 aCol;
      varying vec2 vUv; varying vec4 vCol;
      void main(){
        float r0 = aP.x, th0 = aP.y, sp = aP.z, seed = aP.w;
        // pulled in from the outside first, the far ones last
        float s = clamp((uT - ${T.swirl.toFixed(2)} - seed * 1.1 - r0 * .08) / 3.6, 0.0, 1.0);
        s = s * s * (3.0 - 2.0 * s); s *= s;
        float r = mix(r0, .1, s);
        float th = th0 + uT * sp * (.1 + .75 / (r + .6)) + s * s * 7.0 / (r0 * .3 + 1.0);
        float y = .35 - 2.0 / (r + .7) + (fract(sin(seed * 91.7) * 43758.5) - .5) * .5 * (1.0 - s);
        vec4 mv = viewMatrix * vec4(cos(th) * r, y, sin(th) * r, 1.0);
        mv.xy += position.xy * aSize * mix(1.0, .45, s);
        gl_Position = projectionMatrix * mv;
        vUv = vec2(aRect.x, aRect.y) + (position.xy + .5) * vec2(aRect.z, aRect.w);
        float a = smoothstep(0.0, 1.1, uT - seed * .8) * smoothstep(.16, .55, r) * smoothstep(18.0, 6.0, -mv.z) * smoothstep(.05, .5, -mv.z);
        vCol = vec4(aCol.rgb, aCol.a * a * uDim);
      }`,
    fragmentShader: `
      uniform sampler2D uAtlas; varying vec2 vUv; varying vec4 vCol;
      void main(){ float a = texture2D(uAtlas, vUv).a * vCol.a; if (a < .01) discard; gl_FragColor = vec4(vCol.rgb * a * .95, a); }`
  });
  const words = new THREE.Mesh(geo, wordsMat); words.frustumCulled = false;
  scene.add(words);

  // ---------- the hole: a ring of glass light at the bottom of the funnel ----------
  const HOLE_Y = .35 - 2 / (.55 + .7), HOLE_R = .55;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(HOLE_R, .022, 16, 200), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.5, 2.4), transparent: true, opacity: 0 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = HOLE_Y; scene.add(ring);
  const glass = new THREE.Mesh(new THREE.TorusGeometry(HOLE_R + .05, .085, 32, 200), new THREE.MeshPhysicalMaterial({
    color: '#cfdcff', metalness: 0, roughness: .04, transparent: true, opacity: 0, clearcoat: 1, clearcoatRoughness: .02,
    iridescence: 1, iridescenceIOR: 1.5, envMapIntensity: 3.5, emissive: new THREE.Color('#3b52c9'), emissiveIntensity: .4
  }));
  glass.rotation.x = Math.PI / 2; glass.position.y = HOLE_Y; scene.add(glass);
  const glassLight = new THREE.PointLight(0xaec2ff, 0, 5, 1.5); glassLight.position.set(0, HOLE_Y + .6, .4); scene.add(glassLight);
  // looking into it: a well of light
  const well = new THREE.Mesh(new THREE.CircleGeometry(HOLE_R - .01, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uO: { value: 0 }, uT: { value: 0 }, uDeep: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uO, uT, uDeep; varying vec2 vUv;
      void main(){ vec2 p = vUv - .5; float d = length(p) * 2.;
        float swirl = .5 + .5 * sin(atan(p.y, p.x) * 3. - d * 10. + uT * 2.4);
        vec3 c = mix(vec3(.01, .015, .05), vec3(.18, .24, .7), smoothstep(.2, 1., d));
        c += swirl * vec3(.05, .07, .18) * smoothstep(.1, .9, d);
        c += vec3(1.3, 1.45, 1.9) * uDeep * smoothstep(.7, 0., d);
        gl_FragColor = vec4(c, uO); }`
  }));
  well.rotation.x = -Math.PI / 2; well.position.y = HOLE_Y - .02; scene.add(well);

  // stars and dust for depth
  const soft = softTexture();
  const stars = points(phone ? 350 : 600, () => new V3(rand(-40, 40), rand(-25, 30), rand(-60, -8)), soft, 1.4, new THREE.Color(.8, .85, 1.1), false);
  scene.add(stars);
  const dust = points(phone ? 200 : 360, () => { const a = rand(0, 6.3), r = rand(.3, 8); return new V3(Math.cos(a) * r, .35 - 2 / (r + .7) + rand(-.4, .4), Math.sin(a) * r); }, soft, .045, new THREE.Color(.8, .9, 1.4), true);
  scene.add(dust);

  // ---------- camera ----------
  const DOWN = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), look = new V3(), pos = new V3();
  const START = new V3(0, 5.2, phone ? 9.8 : 8.4), NEAR = new V3(0, 3.4, phone ? 6.2 : 5.4), OVER = new V3(0, 1.3, .25), IN = new V3(0, HOLE_Y - 1.4, .001);
  const onResize = () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  addEventListener('resize', onResize); onResize();

  // ---------- run ----------
  let t = 0, last = performance.now(), revealed = false, skipping = false, hold = false, handed = false;
  const skip = () => { if (skipping || revealed) return; skipping = true; window.rhSkipIntro = true; titleEl.classList.add('out'); flash.style.transition = 'opacity .3s ease'; flash.style.opacity = 1; setTimeout(reveal, 320); };
  skipBtn.onclick = skip;
  // keys only count once the Skip button is showing, so a stray Enter from the address bar doesn't end it
  const onKey = e => { if (t > 1 && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) skip(); };
  addEventListener('keydown', onKey);
  setTimeout(() => skipBtn.style.opacity = 1, 150);   // the way out is there from the start
  window.__intro = { get t() { return t; }, seek(v, h = false) { t = v; hold = h; }, run() { hold = false; }, camera, T };

  function reveal() {
    if (revealed) return; revealed = true;
    onReveal();
    root.style.opacity = 0; root.style.pointerEvents = 'none';
    setTimeout(finish, 1050);
  }
  function finish() {
    renderer.setAnimationLoop(null);
    removeEventListener('resize', onResize); removeEventListener('keydown', onKey);
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? [].concat(o.material) : []; ms.forEach(m => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }); });
    atlas.texture.dispose(); if (scene.environment) scene.environment.dispose();
    composer.dispose(); renderer.dispose(); root.remove(); delete window.__intro;
    onDone();
  }

  renderer.setAnimationLoop(() => {
    const now = performance.now(); let dt = (now - last) / 1000; last = now;
    if (!(dt > 0)) dt = 1 / 60; else if (dt > .1) dt = .1;   // slow devices keep roughly to time
    if (!hold) t += dt;
    if (window.rhSkipIntro && !skipping) skip();   // skipped from the page's waiting screen before this could take the tap
    wordsMat.uniforms.uT.value = t;
    well.material.uniforms.uT.value = t;
    well.material.uniforms.uDeep.value = ease(seg(t, T.dive + .6, T.flash));
    wordsMat.uniforms.uDim.value = 1 - .5 * seg(t, T.titleIn - .3, T.titleIn + .5) * (1 - seg(t, T.titleOut - .2, T.titleOut + .4));

    // the hole lights up as the words start to fall into it
    const lit = ease(seg(t, T.swirl + .4, T.swirl + 2.2));
    ring.material.opacity = lit; glass.material.opacity = .55 * lit; well.material.uniforms.uO.value = lit;
    glassLight.intensity = 3 * lit;
    ring.scale.setScalar(1 + .02 * Math.sin(t * 3));
    dust.rotation.y = t * .12;
    stars.material.opacity = .8 * (1 - seg(t, T.dive, T.dive + 1));

    titleEl.classList.toggle('on', t > T.titleIn && t < T.titleOut);
    if (t >= T.titleOut) titleEl.classList.add('out');

    // camera: a slow drift in, then pulled down through the ring
    if (t < T.dive) {
      const a = ease(seg(t, 0, T.dive));
      pos.copy(START).lerp(NEAR, a); pos.x = Math.sin(t * .35) * .6;
      camera.position.copy(pos); camera.lookAt(0, HOLE_Y + .9 * (1 - a) + .2, 0);
    } else {
      const a = seg(t, T.dive, T.flash + .2), a1 = ease(seg(a, 0, .6)), a2 = ease(seg(a, .4, 1));
      pos.copy(NEAR).lerp(OVER, a1).lerp(IN, a2);
      camera.position.copy(pos);
      look.set(0, HOLE_Y, 0);
      _q.setFromRotationMatrix(_m.lookAt(pos, look, camera.up));
      camera.quaternion.copy(_q).slerp(DOWN, ease(seg(a, .25, .7)));
      camera.rotateZ(ease(a) * 1.4);
    }
    camera.fov = (phone ? 58 : 44) + 36 * ease(seg(t, T.dive + .4, T.flash + .3));
    camera.updateProjectionMatrix();

    if (!skipping) flash.style.opacity = seg(t, T.flash - .25, T.reveal);
    if (t >= T.reveal) reveal();
    composer.render();
    // the page's waiting glow hands over once the words are starting to show
    if (t > .25 && !handed) { handed = true; const p = document.getElementById('pre'); if (p) { p.classList.add('out'); setTimeout(() => p.remove(), 1000); } }
  });
}

// ---------- helpers ----------
// every title drawn once onto one big sheet; the shader picks each word's patch
function wordAtlas(list) {
  const W = 2048, fs = 44, rowH = 62, pad = 18, c = document.createElement('canvas'); c.width = W;
  const g = c.getContext('2d'), font = `600 ${fs}px -apple-system,"SF Pro Display","Segoe UI",system-ui,sans-serif`;
  g.font = font;
  const placed = []; let x = 0, y = 0;
  for (const w of list) {
    const tw = Math.ceil(g.measureText(w).width) + pad * 2;
    if (tw > W) continue;
    if (x + tw > W) { x = 0; y += rowH; }
    placed.push({ w, x, y, tw }); x += tw;
  }
  c.height = Math.min(4096, THREE.MathUtils.ceilPowerOfTwo(y + rowH));
  g.font = font; g.fillStyle = '#fff'; g.textBaseline = 'middle';
  const rects = [];
  for (const p of placed) {
    if (p.y + rowH > c.height) break;
    g.fillText(p.w, p.x + pad, p.y + rowH / 2 + 2);
    rects.push({ u: p.x / W, v: 1 - (p.y + rowH) / c.height, w: p.tw / W, h: rowH / c.height, aspect: p.tw / rowH });
  }
  const texture = new THREE.CanvasTexture(c); texture.anisotropy = 4; texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
  return { texture, rects };
}
function softTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function points(n, at, map, size, color, attenuate = true) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const p = at(i); pos.set([p.x, p.y, p.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map, size, color, transparent: true, depthWrite: false, sizeAttenuation: attenuate, blending: THREE.AdditiveBlending });
  const p = new THREE.Points(g, m); p.frustumCulled = false; return p;
}

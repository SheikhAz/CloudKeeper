import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ======================= TUNING KNOBS ======================= */
const CFG = {
  mobileMax: 700,
  maxDpr: 1.5,
  exposure: 1.0,
  bloom: { strength: 0.5, radius: 0.5, threshold: 1.0 },

  grass: {
    desktop: { near: 26000, mid: 60000, far: 40000, fg: 380 },
    /* blades are now packed into the visible strip only, so far fewer are wasted off-screen */
    mobile: { near: 9000, mid: 20000, far: 12000, fg: 200 },
    heightScale: 0.38,            // was 0.19  -> everything about twice as tall
    widthScale: 0.62,             // was 0.4
    mobileHeightBoost: 1.35,      // extra height on phones
    mobileWidthBoost: 1.25,       // extra width on phones
    mulNear: 0.85,                // per-band height multipliers (near the camera is kept lower so the form stays readable)
    mulMid: 1.5,
    mulFar: 2.1,
    mulFg: 3.2,                   // big blurry blades, bottom-left
    tvClear: { min: 0.22, inner: 1.4, outer: 4.5 },
  },
  windDesktop: 0.75,
  windMobile: 1.2,
  brush: {
    strength: 1.0,
    bend: 1.3,
    follow: 20,
    screenFrac: 0.09,
    minR: 0.4,
    maxR: 1.8,
  },
  dof: true,                      // CSS blur in the bottom-left corner (desktop only)

  /* TV position on screen: x / y are fractions of the scene (0,0 = top-left).
     Desktop = the box you drew (upper-left, standing on the hill). */
  tv: {
    desktop: { x: 0.16, y: 0.33, yaw: 0.15 },
    mobile: { x: 0.40, y: 0.36, yaw: -0.45 },
  },
  tvTurnY: 0.5,                   // extra yaw following the mouse (desktop)
  tvTurnX: 0.2,                   // extra pitch following the mouse (desktop)
  camY: 0.4,
  fogColor: 0x6a72c0,
  tvGlow: 0.35,

  /* Mountains: three hazy layers, far -> near. peak / floor / base are heights on screen
     (0 = top, 1 = bottom), so they always poke out above the hill line on any screen size.
     feat = how many main peaks fit across the screen. blur = softness in texture pixels. */
  mountains: {
    env: { from: -0.35, to: 0.95, floor: 0.0 },           // rise from centre to the right edge
    /* phones show a slim crop of the same wide range, centred on its tall right-hand part */
    mobileViewAspect: 2.0,
    mobileCentre: 0.6,
    mobileLift: 0.75,                                     // phones: peaks are kept a bit lower
    layers: [
      { z: -82, peak: 0.29, floor: 0.46, base: 0.62, feat: 4.6, seed: 3,  lit: 0xc9a6e4, shade: 0x8d86d8, haze: 0xeab4d0, hazeMin: 0.25, hazeMax: 0.8,  snow: 0.7, blur: 2.4 },
      { z: -63, peak: 0.32, floor: 0.47, base: 0.62, feat: 5.8, seed: 11, lit: 0xa497d8, shade: 0x5f63b4, haze: 0xd8a4cc, hazeMin: 0.15, hazeMax: 0.65, snow: 0,   blur: 1.6 },
      { z: -48, peak: 0.36, floor: 0.48, base: 0.62, feat: 7.2, seed: 29, lit: 0x6c70bb, shade: 0x39448f, haze: 0x9a90d4, hazeMin: 0.08, hazeMax: 0.5,  snow: 0,   blur: 1.0 },
    ],
  },
};

/* ======================= helpers ======================= */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);

/* ---- procedural mountain painter (pure maths, no canvas) ---- */
const hash2 = (ix, iy, s) => {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vnoise = (x, y, s) => {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
};
const fbm = (x, y, s, oct) => {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += a * vnoise(x * f, y * f, s + i * 17); norm += a; f *= 2.03; a *= 0.5; }
  return sum / norm;
};
/* sharp-peaked 1D ridge profile, roughly 0..1 */
const ridge1D = (x, s) => {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < 6; i++) {
    const n = 1 - Math.abs(2 * vnoise(x * f, 3.3 + i, s + i * 11) - 1);
    sum += amp * n * n * n; norm += amp; amp *= 0.55; f *= 2.1;
  }
  return sum / norm;
};
const hexRGB = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

/* Paints one hazy mountain layer into an RGBA byte array (no canvas needed, so it is easy to test) */
function paintMountains(o) {
  const { W, H, seed, cyc, K, env, sxMin, sxMax, hPeak, hFloor, lit, shade, haze, hazeMin, hazeMax, snow } = o;
  const PAD = 4;
  /* shading detail is tuned for a texture that spans the full layer at 2048 px; keep it the same size in the world */
  const ps = (2048 * ((sxMax - sxMin) / (2 * K))) / W;
  const hArr = new Float32Array(W + PAD * 2);
  let maxH = 1;
  for (let i = 0; i < hArr.length; i++) {
    const x = i - PAD;
    const sx = sxMin + (x / W) * (sxMax - sxMin);   // position on the (virtual) screen axis: -1..1 = screen edges
    const u = 0.5 + sx / (2 * K);                    // position along the full layer
    const e = env.floor + (1 - env.floor) * sstep(env.from, env.to, sx);
    const r = ridge1D(u * cyc, seed);
    const shape = sstep(0.18, 0.70, r);
    const hpx = hFloor + (hPeak - hFloor) * (0.12 * shape + 0.88 * e * shape);
    hArr[i] = hpx;
    if (hpx > maxH) maxH = hpx;
  }
  const cL = hexRGB(lit), cS = hexRGB(shade), cH = hexRGB(haze), cSn = [255, 236, 240];
  const data = new Uint8ClampedArray(W * H * 4);
  const SW = Math.max(4, Math.round(18 / ps));                                    /* wide window: smooth flank direction, no per-column noise */
  for (let x = 0; x < W; x++) {
    const hx = hArr[x + PAD];
    const yTop = H - hx;
    const sl = (hArr[Math.min(x + PAD + SW, hArr.length - 1)] - hArr[Math.max(x + PAD - SW, 0)]) / (2 * SW);  /* + = rising to the right */
    const sl2 = (hArr[x + PAD + 2] - hArr[x + PAD - 2]) * 0.25;
    for (let y = Math.max(0, Math.floor(yTop)); y < H; y++) {
      const cover = clamp(y + 1 - yTop, 0, 1);
      if (cover <= 0) continue;
      const depth = y - yTop;
      const ph = (H - y) / maxH;
      /* gullies and spurs: a stretched noise field that fans out along the flank */
      const wx = x + depth * sl * 1.3;
      const F = (xx) => fbm(xx * 0.034 * ps, y * 0.013 * ps, seed + 7, 4);
      const gc = F(wx), gl = F(wx - 2.5 / ps), gr = F(wx + 2.5 / ps);
      /* sun sits low on the right: faces that look right are lit, faces that look left fall into shadow */
      let l = 0.5 - (gr - gl) * 7.5 - sl * 0.9 - sl2 * 0.35 + (gc - 0.5) * 0.55;
      l += Math.exp(-(depth * ps) / 4) * 0.2;                  /* thin rim light along the crest */
      l = clamp(l, 0, 1);
      let r = cS[0] + (cL[0] - cS[0]) * l, g = cS[1] + (cL[1] - cS[1]) * l, b = cS[2] + (cL[2] - cS[2]) * l;
      if (snow > 0) {
        const sn = snow * sstep(0.62, 0.84, ph) * sstep(0.4, 0.62, gc + (l - 0.5) * 0.4);
        const k = 0.72 + 0.28 * l;
        r += (cSn[0] * k - r) * sn; g += (cSn[1] * k - g) * sn; b += (cSn[2] * k - b) * sn;
      }
      /* valleys sink into the haze */
      const hz = hazeMin + (hazeMax - hazeMin) * (1 - sstep(0, 0.8, ph));
      r += (cH[0] - r) * hz; g += (cH[1] - g) * hz; b += (cH[2] - b) * hz;
      const i = (y * W + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = cover * 255;
    }
  }
  return data;
}


function makeCloudTexture(seed) {
  const r = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 90 + r() * 332;
    const y = 90 + r() * 80;
    const rad = 40 + r() * 70;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, 'rgba(255,255,255,0.30)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,235,200,1)');
  grad.addColorStop(0.35, 'rgba(255,190,110,0.35)');
  grad.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* soft band of mist that sits between the mountains and the hills */
function makeMistTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,192,208,0)');
  grad.addColorStop(0.55, 'rgba(255,196,212,0.6)');
  grad.addColorStop(1, 'rgba(255,200,216,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* glowing CRT screen: hot white centre, orange falloff, rounded corners (alpha) */
function makeScreenTexture() {
  const W = 384, H = 300;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rr = 46;
  g.beginPath();
  g.moveTo(rr, 0); g.lineTo(W - rr, 0); g.quadraticCurveTo(W, 0, W, rr);
  g.lineTo(W, H - rr); g.quadraticCurveTo(W, H, W - rr, H);
  g.lineTo(rr, H); g.quadraticCurveTo(0, H, 0, H - rr);
  g.lineTo(0, rr); g.quadraticCurveTo(0, 0, rr, 0);
  g.closePath();
  g.clip();
  const grad = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.62);
  grad.addColorStop(0, '#fffdf4');
  grad.addColorStop(0.55, '#fff0cf');
  grad.addColorStop(0.85, '#ffc77a');
  grad.addColorStop(1, '#f19a45');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,170,90,0.07)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1.5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ======================= component ======================= */
export default function AuthScene() {
  const wrapRef = useRef(null);
  /* "m-0.5" / "d-2" ... the scene is rebuilt when the layout bucket (phone vs desktop, rough aspect) changes,
     so the TV, grass and mountains are always laid out for the screen that is actually showing */
  const [layoutKey, setLayoutKey] = useState('');

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let timer;
    const calc = () => {
      const w = Math.max(wrap.clientWidth, 1);
      const h = Math.max(wrap.clientHeight, 1);
      const mob = w <= CFG.mobileMax || w / h < 0.9;
      setLayoutKey(`${mob ? 'm' : 'd'}-${Math.round((w / h) * 4) / 4}`);
    };
    calc();
    const onR = () => { clearTimeout(timer); timer = setTimeout(calc, 250); };
    window.addEventListener('resize', onR);
    return () => { clearTimeout(timer); window.removeEventListener('resize', onR); };
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !layoutKey) return;

    const W = () => Math.max(wrap.clientWidth, 1);
    const H = () => Math.max(wrap.clientHeight, 1);
    const MOB = layoutKey.startsWith('m');
    const DPR = Math.min(window.devicePixelRatio || 1, CFG.maxDpr);
    const rand = mulberry32(1337);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(DPR);
    renderer.setSize(W(), H());
    /* no filmic tone-mapping: ACES was washing every colour out to pastel */
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = CFG.exposure;
    wrap.insertBefore(renderer.domElement, wrap.firstChild);

    const scene = new THREE.Scene();
    const fogColor = new THREE.Color(CFG.fogColor);
    const FOG_NEAR = 12, FOG_FAR = 70;
    scene.fog = new THREE.Fog(fogColor, FOG_NEAR, FOG_FAR);

    /* ---------- camera + TV placement ---------- */
    const aspect0 = W() / H();
    const fovV = MOB ? 40 : 33;
    const camZ = MOB ? 9.6 : 8.2;
    const HT = Math.tan(THREE.MathUtils.degToRad(fovV / 2)) * aspect0;   // half-width per unit of distance
    const camera = new THREE.PerspectiveCamera(fovV, aspect0, 0.1, 160);

    const tvc = MOB ? CFG.tv.mobile : CFG.tv.desktop;
    const TV_Z = -2.2;
    /* world x that lands the TV at tv.x of the screen width */
    const TV_X = (2 * tvc.x - 1) * HT * (camZ - TV_Z);

    /* rolling hills: TV hill (left on desktop), a long swell behind the form, a hill on the right */
    const hillH = (x, z) => {
      const g = (cx, cz, sx, sz, a) =>
        a * Math.exp(-(((x - cx) ** 2) / (2 * sx * sx) + ((z - cz) ** 2) / (2 * sz * sz)));
      let h =
        g(TV_X, TV_Z, 3.4, 3.4, 1.5) +
        g(TV_X + 6.2, -4.2, 4.2, 3.6, 1.5) +
        g(TV_X + 12.6, -2.0, 3.6, 3.3, 1.5) +
        g(TV_X + 9, 3.2, 3.0, 2.5, 0.45) +
        g(-3.4, 2.8, 2.3, 2.4, 1.2) +
        g(TV_X - 5.5, -6.5, 4, 4, 0.8);
      h += 0.11 * Math.sin(x * 0.7 + z * 0.4) + 0.07 * Math.sin(z * 0.9 - x * 0.3);
      return h - 1.1;
    };
    const TV_Y = hillH(TV_X, TV_Z) + 0.66;
    const SUN_DIR = new THREE.Vector3(4.6, 0.9, -6).normalize();

    /* frame the scene so the TV lands at tv.y of the screen height */
    const applyCamera = () => {
      const w = W(), h = H();
      camera.clearViewOffset();
      camera.aspect = w / h;
      camera.fov = fovV;
      camera.position.set(0, CFG.camY, camZ);
      camera.lookAt(0, CFG.camY + 0.15, -2);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const p = new THREE.Vector3(TV_X, TV_Y, TV_Z).project(camera);
      const want = 1 - 2 * tvc.y;
      camera.setViewOffset(w, h, 0, ((want - p.y) / 2) * h, w, h);
    };
    applyCamera();

    /* ---------- sky ---------- */
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        cTop: { value: new THREE.Color(0x1f35c8) },
        cMid: { value: new THREE.Color(0x3a52e0) },
        cLow: { value: new THREE.Color(0x8a86e0) },
        cHor: { value: new THREE.Color(0xf6aab4) },
        uSun: { value: SUN_DIR.clone() },
      },
      vertexShader: `
        varying vec3 vP;
        void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vP;
        uniform vec3 cTop; uniform vec3 cMid; uniform vec3 cLow; uniform vec3 cHor; uniform vec3 uSun;
        void main(){
          vec3 d = normalize(vP);
          float r = smoothstep(-0.3, 0.8, d.x);            /* right side is warmer */
          float h = clamp(d.y, -0.05, 1.0) * mix(1.0, 0.8, r);
          vec3 c = mix(cHor, cLow, smoothstep(0.0, 0.12, h));
          c = mix(c, cMid, smoothstep(0.10, 0.30, h));
          c = mix(c, cTop, smoothstep(0.26, 0.55, h));
          float g = max(dot(d, normalize(uSun)), 0.0);
          c += vec3(1.0, 0.55, 0.40) * pow(g, 4.0) * 0.20;
          c += vec3(1.0, 0.75, 0.60) * pow(g, 30.0) * 0.25;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(110, 48, 24), skyMat);
    scene.add(sky);

    /* environment map for the TV's glossy plastic (built from the same sky) */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), skyMat));
    const envSun = new THREE.Mesh(
      new THREE.SphereGeometry(3, 16, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 3.6, 2.2) })
    );
    envSun.position.copy(SUN_DIR).multiplyScalar(30);
    envScene.add(envSun);
    const envRT = pmrem.fromScene(envScene, 0.02);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.8;

    /* ---------- clouds (drawn behind the mountains) ---------- */
    const clouds = [];
    const cloudDefs = [
      { x: -4, y: 9, z: -42, s: 34, o: 0.5, c: 0xffe0e6, seed: 3 },
      { x: 24, y: 6, z: -50, s: 36, o: 0.45, c: 0xffc9b0, seed: 8 },
      { x: -30, y: 10, z: -55, s: 30, o: 0.35, c: 0xf0d8ff, seed: 11 },
      { x: 40, y: 10, z: -58, s: 30, o: 0.35, c: 0xffd0c0, seed: 5 },
      { x: 4, y: 3.5, z: -52, s: 44, o: 0.3, c: 0xffbcc8, seed: 21 },
    ];
    for (const d of cloudDefs) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.5),
        new THREE.MeshBasicMaterial({
          map: makeCloudTexture(d.seed), transparent: true, depthWrite: false,
          opacity: d.o, color: d.c, fog: false,
        })
      );
      m.position.set(d.x, d.y, d.z);
      m.scale.set(d.s, d.s, 1);
      m.renderOrder = -1;
      m.userData.speed = 0.12 + rand() * 0.12;
      clouds.push(m);
      scene.add(m);
    }

    /* ---------- mountains: soft, hazy layers, tallest on the right ---------- */
    const shot = new THREE.Raycaster();
    /* world height that appears at screen height f (0 = top, 1 = bottom) on the plane at depth z */
    const screenToY = (z, f) => {
      shot.setFromCamera(new THREE.Vector2(0, 1 - 2 * f), camera);
      const o = shot.ray.origin, d = shot.ray.direction;
      return o.y + d.y * ((z - o.z) / d.z);
    };
    const MC = CFG.mountains;
    const MK = 2.2;                                   // full layer is MK x wider than a screen
    const VIEW_ASPECT = MOB ? MC.mobileViewAspect : aspect0;
    const HTv = Math.tan(THREE.MathUtils.degToRad(fovV / 2)) * VIEW_ASPECT;
    const sxMid = MOB ? MC.mobileCentre : 0;
    const sxHalf = (aspect0 / VIEW_ASPECT) * 1.3 + 0.1;   // visible slice of the range, plus a safety margin
    const sxMin = sxMid - sxHalf, sxMax = sxMid + sxHalf;
    for (const L of MC.layers) {
      const halfWv = HTv * (camZ - L.z);
      const planeW = halfWv * (sxMax - sxMin);
      /* phones: a slimmer screen needs lower peaks or they turn into needles */
      const peakF = MOB ? L.floor - (L.floor - L.peak) * MC.mobileLift : L.peak;
      const yPeak = screenToY(L.z, peakF);
      const yFloor = screenToY(L.z, L.floor);
      const yBase = screenToY(L.z, L.base);
      const planeH = (yPeak - yBase) * 1.08 + 0.5;
      const TW = MOB ? 1024 : 2048;
      const TH = clamp(Math.ceil((planeH / planeW) * TW), 48, 640);

      const cv = document.createElement('canvas');
      cv.width = TW; cv.height = TH;
      const cx = cv.getContext('2d');
      const img = cx.createImageData(TW, TH);
      img.data.set(paintMountains({
        W: TW, H: TH, seed: L.seed, K: MK, sxMin, sxMax,
        cyc: L.feat * MK,
        env: MC.env,
        hPeak: ((yPeak - yBase) / planeH) * TH,
        hFloor: ((yFloor - yBase) / planeH) * TH,
        lit: L.lit, shade: L.shade, haze: L.haze, hazeMin: L.hazeMin, hazeMax: L.hazeMax, snow: L.snow,
      }));
      cx.putImageData(img, 0, 0);

      /* soften the whole layer (skipped on browsers without canvas filters; the texture is still bilinear-smooth) */
      let src = cv;
      if (L.blur > 0 && 'filter' in cx) {
        const cv2 = document.createElement('canvas');
        cv2.width = TW; cv2.height = TH;
        const c2 = cv2.getContext('2d');
        c2.filter = `blur(${(L.blur * TW) / (planeW * 8.3)}px)`;   // same softness in the world on every device
        c2.drawImage(cv, 0, 0);
        src = cv2;
      }
      const tex = new THREE.CanvasTexture(src);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 2;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(planeW, planeH),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })
      );
      mesh.position.set(0, yBase + planeH / 2, L.z);
      scene.add(mesh);
    }

    /* mist between the mountains and the hills */
    {
      const mz = -44.5;
      const yTop = screenToY(mz, 0.445);
      const yBot = screenToY(mz, 0.535);
      const mist = new THREE.Mesh(
        new THREE.PlaneGeometry(HT * (camZ - mz) * 2 * 1.6, yTop - yBot),
        new THREE.MeshBasicMaterial({
          map: makeMistTexture(), transparent: true, depthWrite: false, fog: false, opacity: 0.55,
        })
      );
      mist.position.set(0, (yTop + yBot) / 2, mz);
      scene.add(mist);
    }

    /* ---------- terrain ---------- */
    const tGeo = new THREE.PlaneGeometry(90, 52, 180, 104);
    tGeo.rotateX(-Math.PI / 2);
    tGeo.translate(0, 0, -16);
    {
      const p = tGeo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, hillH(p.getX(i), p.getZ(i)) - 0.03);
      tGeo.computeVertexNormals();
    }
    scene.add(new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({ color: 0x0e2320, fog: true })));

    /* ---------- grass ---------- */
    const GC = CFG.grass;
    const counts = MOB ? GC.mobile : GC.desktop;
    const FG = counts.fg;                  /* big blurry foreground blades, bottom-left */
    const total = counts.near + counts.mid + counts.far + FG;
    const HS = GC.heightScale * (MOB ? GC.mobileHeightBoost : 1);
    const WS = GC.widthScale * (MOB ? GC.mobileWidthBoost : 1);
    const aOff = new Float32Array(total * 3);
    const aSc = new Float32Array(total * 3);
    const aRnd = new Float32Array(total * 4);
    let gi = 0;
    const addBlade = (x, z, hMul, wMul) => {
      /* shorter right around the TV so it is never buried */
      const dc = Math.hypot(x - TV_X, (z - TV_Z) * 0.7);
      const clear = GC.tvClear.min + (1 - GC.tvClear.min) * sstep(GC.tvClear.inner, GC.tvClear.outer, dc);

      aOff[gi * 3] = x; aOff[gi * 3 + 1] = hillH(x, z) - 0.02; aOff[gi * 3 + 2] = z;
      aSc[gi * 3] = (0.035 + rand() * 0.03) * wMul * WS;
      aSc[gi * 3 + 1] = (0.45 + rand() * 0.6) * hMul * HS * clear;
      aSc[gi * 3 + 2] = 0.4 + rand() * 0.6;
      aRnd[gi * 4] = rand() * Math.PI * 2;
      aRnd[gi * 4 + 1] = rand();
      aRnd[gi * 4 + 2] = rand();
      aRnd[gi * 4 + 3] = rand();
      gi++;
    };
    /* blades only where the camera can see them: half-width at depth z (+ a little margin) */
    const reach = (z) => Math.max(camZ - z, 1) * HT * 1.12 + 1.4;
    for (let i = 0; i < counts.near; i++) {
      const z = camZ - 1.4 - Math.pow(rand(), 0.7) * 5.6;
      addBlade((rand() * 2 - 1) * reach(z), z, GC.mulNear, 1.0);
    }
    for (let i = 0; i < counts.mid; i++) {
      const z = -7 + rand() * (camZ - 1.4 - 5.6 + 7.4);
      addBlade((rand() * 2 - 1) * reach(z), z, GC.mulMid, 1.25);
    }
    for (let i = 0; i < counts.far; i++) {
      const z = -26 + rand() * 19;
      addBlade((rand() * 2 - 1) * reach(z), z, GC.mulFar, 2.5);
    }
    /* foreground blades, left side only; the ones that would sit in front of the TV are kept low */
    const tvLat = TV_X / ((camZ - TV_Z) * HT);
    for (let i = 0; i < FG; i++) {
      const z = camZ - 2.2 - rand() * 1.2;
      const lat = -(0.1 + rand() * 0.9);                       // -1 = left screen edge
      const inFront = Math.abs(lat - tvLat) < 0.3;
      addBlade(lat * (camZ - z) * HT, z, GC.mulFg * (inFront ? 0.4 : 1), 3.0);
    }

    /* blade template: 4 segments tapering to a tip */
    const tpl = new THREE.BufferGeometry();
    const rows = [[0, 0.5], [0.25, 0.44], [0.5, 0.34], [0.75, 0.2]];
    const bp = [], buv = [];
    for (const [t, w] of rows) {
      bp.push(-w, t, 0, w, t, 0);
      buv.push(0.5 - w, t, 0.5 + w, t);
    }
    bp.push(0, 1, 0); buv.push(0.5, 1);
    tpl.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
    tpl.setAttribute('uv', new THREE.Float32BufferAttribute(buv, 2));
    tpl.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6, 6, 5, 7, 6, 7, 8]);

    const gGeo = new THREE.InstancedBufferGeometry();
    gGeo.index = tpl.index;
    gGeo.setAttribute('position', tpl.attributes.position);
    gGeo.setAttribute('uv', tpl.attributes.uv);
    gGeo.setAttribute('aOff', new THREE.InstancedBufferAttribute(aOff, 3));
    gGeo.setAttribute('aSc', new THREE.InstancedBufferAttribute(aSc, 3));
    gGeo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(aRnd, 4));
    gGeo.instanceCount = total;

    const grassU = {
      uTime: { value: 0 },
      uWind: { value: MOB ? CFG.windMobile : CFG.windDesktop },
      uBrush: { value: new THREE.Vector3(0, -50, 0) },   // cursor position on the ground
      uBrushR: { value: CFG.brush.minR },
      uBrushS: { value: 0 },                              // fades in/out with the cursor
      uBrushBend: { value: CFG.brush.bend },
      uTv: { value: new THREE.Vector3(TV_X, TV_Y, TV_Z) },
      uTvGlow: { value: CFG.tvGlow },
      uTvDir: { value: new THREE.Vector2(0, 1) },         // where the screen faces (x,z)
      uSun: { value: SUN_DIR.clone() },
      uFogColor: { value: fogColor },
      uFogNear: { value: FOG_NEAR },
      uFogFar: { value: FOG_FAR },
    };
    const grassMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: grassU,
      vertexShader: `
        attribute vec3 aOff; attribute vec3 aSc; attribute vec4 aRnd;
        uniform float uTime; uniform float uWind;
        uniform vec3 uBrush; uniform float uBrushR; uniform float uBrushS; uniform float uBrushBend; uniform vec3 uSun;
        varying float vT; varying vec3 vWorld; varying vec4 vRnd; varying float vFacing; varying float vDepth;
        void main(){
          float t = uv.y;
          vT = t; vRnd = aRnd;
          float ang = aRnd.x; float c = cos(ang), s = sin(ang);
          float curve = t * t;
          vec3 lp = vec3(position.x * aSc.x, t * aSc.y, curve * aSc.z * aSc.y);
          vec3 wp = vec3(c * lp.x + s * lp.z, lp.y, -s * lp.x + c * lp.z) + aOff;
          vec3 nrm = vec3(s, 0.0, c);
          vFacing = abs(dot(nrm, normalize(vec3(uSun.x, 0.0, uSun.z))));

          float bend = curve * aSc.y;
          float g = sin(uTime * 1.4 + aOff.x * 0.55 + aOff.z * 0.35) * 0.6
                  + sin(uTime * 2.3 + aOff.x * 1.7 + aRnd.y * 6.28) * 0.25
                  + sin(uTime * 0.45 + aOff.z * 0.2) * 0.4;
          vec2 wind = vec2(1.0, 0.35) * g * uWind * 0.24;

          /* cursor: smooth push away from the brush centre, no jitter right under it */
          vec2 bd = aOff.xz - uBrush.xz;
          float bl = length(bd);
          vec2 push = (bd / (bl + 0.25 * uBrushR)) * exp(-(bl * bl) / (uBrushR * uBrushR)) * 1.7 * uBrushS;

          /* bend the blade over without stretching it (keeps its length, never sinks into the ground) */
          vec2 d = (wind + push * uBrushBend) * bend;
          float L = length(d);
          float h = max(lp.y, 0.0001);
          float Lc = min(L, h * 0.92);
          d *= Lc / max(L, 0.00001);
          wp.xz += d;
          wp.y = aOff.y + sqrt(max(h * h - Lc * Lc, 0.0));

          vWorld = wp;
          vec4 mv = viewMatrix * vec4(wp, 1.0);
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vT; varying vec3 vWorld; varying vec4 vRnd; varying float vFacing; varying float vDepth;
        uniform vec3 uTv; uniform float uTvGlow; uniform vec2 uTvDir; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
        vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }   /* palette below is written in sRGB */
        void main(){
          float t = vT;
          vec3 root = vec3(0.03, 0.09, 0.08);
          vec3 mid  = mix(vec3(0.13, 0.20, 0.08), vec3(0.30, 0.30, 0.10), vRnd.z);
          vec3 tip  = mix(vec3(0.90, 0.66, 0.22), vec3(0.55, 0.52, 0.18), vRnd.z * 0.8);
          vec3 col = mix(root, mid, smoothstep(0.0, 0.5, t));
          col = mix(col, tip, smoothstep(0.45, 1.0, t) * (0.45 + 0.4 * vRnd.w));
          col = lin(col);

          /* sunset backlight + glossy tip sheen */
          col += vec3(1.0, 0.58, 0.22) * pow(t, 2.0) * vFacing * 0.20;
          col += vec3(1.0, 0.82, 0.45) * pow(t, 3.0) * 0.07 * vRnd.z;
          col += vec3(0.01, 0.02, 0.06) * (0.4 + t);

          /* warm light thrown by the TV screen (pool follows where the screen faces) */
          vec2 dxz = vWorld.xz - uTv.xz;
          float d = length(dxz);
          float front = mix(0.35, 1.0, smoothstep(-1.2, 1.4, dot(dxz, uTvDir)));
          float wide = exp(-d * d * 0.16);
          float tight = exp(-d * d * 1.1);
          float lit = (0.25 + 0.9 * t);
          col += vec3(1.0, 0.46, 0.12) * wide * lit * 0.55 * front * uTvGlow;
          col += vec3(1.0, 0.72, 0.36) * tight * (0.2 + t) * 0.5 * front * uTvGlow;

          float f = smoothstep(uFogNear, uFogFar, vDepth) * 0.55;
          col = mix(col, uFogColor, f);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const grass = new THREE.Mesh(gGeo, grassMat);
    grass.frustumCulled = false;
    scene.add(grass);

    /* ---------- floating bokeh particles ---------- */
    const PN = MOB ? 200 : 320;
    const pPos = new Float32Array(PN * 3);
    const pSeed = new Float32Array(PN * 4);
    for (let i = 0; i < PN; i++) {
      pPos[i * 3] = (rand() - 0.5) * 34;
      pPos[i * 3 + 1] = rand() * 14;
      pPos[i * 3 + 2] = -26 + rand() * 30;
      const big = rand() < 0.18;
      pSeed[i * 4] = big ? 22 + rand() * 24 : 6 + rand() * 12;
      pSeed[i * 4 + 1] = 0.4 + rand() * 1.2;
      pSeed[i * 4 + 2] = rand();
      pSeed[i * 4 + 3] = big ? 0.25 : 0.5 + rand() * 0.5;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 4));
    const pU = { uTime: { value: 0 }, uPx: { value: DPR } };
    const motes = new THREE.Points(
      pGeo,
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: pU,
        vertexShader: `
          uniform float uTime; uniform float uPx;
          attribute vec4 aSeed; varying float vA;
          void main(){
            vec3 p = position;
            p.y = mod(p.y + uTime * aSeed.y * 0.12, 14.0);
            p.x += sin(uTime * 0.3 + aSeed.z * 6.28) * 0.5;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSeed.x * uPx * (10.0 / -mv.z);
            float tw = 0.65 + 0.35 * sin(uTime * 1.5 + aSeed.z * 20.0);
            vA = aSeed.w * tw * smoothstep(0.0, 1.2, p.y) * (1.0 - smoothstep(11.0, 14.0, p.y));
          }`,
        fragmentShader: `
          varying float vA;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            float soft = smoothstep(0.5, 0.12, d);
            float ring = smoothstep(0.5, 0.42, d) * 0.25;
            float a = vA * (soft * 0.7 + ring) * 0.9;
            gl_FragColor = vec4(vec3(0.78, 0.86, 1.0) * a, a);
          }`,
      })
    );
    motes.frustumCulled = false;
    scene.add(motes);

    /* ---------- lights ---------- */
    scene.add(new THREE.HemisphereLight(0x8fa0ff, 0x2a1a30, 0.55));
    const rim = new THREE.DirectionalLight(0xffa88c, 2.4);
    rim.position.set(5, 3, -6);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0x9bb0ff, 0.5);
    fill.position.set(-4, 3, 4);
    scene.add(fill);

    /* ---------- the TV ---------- */
    const rig = new THREE.Group();          /* mouse-driven rotation */
    rig.position.set(TV_X, TV_Y, TV_Z);
    rig.rotation.y = tvc.yaw;
    scene.add(rig);
    const tv = new THREE.Group();           /* resting pose */
    tv.rotation.set(0, 0, 0.08);
    rig.add(tv);

    const blue = new THREE.MeshPhysicalMaterial({
      color: 0x1a2fc2, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.14,
    });
    const black = new THREE.MeshPhysicalMaterial({
      color: 0x06070c, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08,
    });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd5d9e6, roughness: 0.18, metalness: 1 });

    tv.add(new THREE.Mesh(new RoundedBoxGeometry(1.9, 1.4, 1.2, 6, 0.13), blue));

    const back = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.1, 0.8, 5, 0.12), blue);
    back.position.z = -0.85;
    tv.add(back);

    const bezel = new THREE.Mesh(new RoundedBoxGeometry(1.76, 1.28, 0.14, 6, 0.1), black);
    bezel.position.z = 0.62;
    tv.add(bezel);

    const inset = new THREE.Mesh(new RoundedBoxGeometry(1.34, 1.08, 0.06, 5, 0.09), new THREE.MeshStandardMaterial({ color: 0x020205, roughness: 0.5 }));
    inset.position.set(-0.18, 0.02, 0.7);
    tv.add(inset);

    /* slightly bulging glass */
    const sGeo = new THREE.PlaneGeometry(1.22, 0.96, 20, 16);
    {
      const p = sGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const nx = p.getX(i) / 0.61, ny = p.getY(i) / 0.48;
        p.setZ(i, 0.05 * (1 - nx * nx) * (1 - ny * ny));
      }
      sGeo.computeVertexNormals();
    }
    const sMul = 0.85 + 1.45 * CFG.tvGlow;   // 2.3 at tvGlow = 1
    const screen = new THREE.Mesh(
      sGeo,
      new THREE.MeshBasicMaterial({
        map: makeScreenTexture(), alphaTest: 0.5, color: new THREE.Color(sMul, sMul * 0.91, sMul * 0.76), toneMapped: true,
      })
    );
    screen.position.set(-0.18, 0.02, 0.735);
    tv.add(screen);

    /* glow around the screen: a sprite, so it always faces the camera */
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(), transparent: true, opacity: 0.55, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false,
      })
    );
    halo.scale.set(2.4, 2.1, 1);
    halo.position.set(-0.18, 0.02, 0.9);
    tv.add(halo);

    const screenLight = new THREE.PointLight(0xffc890, 12, 8, 2);
    screenLight.position.set(-0.18, 0.1, 1.5);
    tv.add(screenLight);

    /* knobs + speaker slots */
    const knobGeo = new THREE.CylinderGeometry(0.06, 0.065, 0.06, 24);
    knobGeo.rotateX(Math.PI / 2);
    for (const y of [0.26, 0.04]) {
      const k = new THREE.Mesh(knobGeo, chrome);
      k.position.set(0.68, y, 0.72);
      tv.add(k);
    }
    for (let i = 0; i < 6; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.018, 0.02), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      slot.position.set(0.68, -0.18 - i * 0.055, 0.695);
      tv.add(slot);
    }

    /* antennas (short, uneven V like the reference) */
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), black);
    dome.position.set(0, 0.7, -0.05);
    tv.add(dome);
    for (const [len, tilt] of [[0.95, 0.62], [1.05, -0.3]]) {
      const rodGeo = new THREE.CylinderGeometry(0.008, 0.015, len, 8);
      rodGeo.translate(0, len / 2, 0);
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.74, -0.05);
      pivot.rotation.z = tilt;
      pivot.rotation.x = -0.05;
      pivot.add(new THREE.Mesh(rodGeo, chrome));
      tv.add(pivot);
    }

    /* feet */
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.14, 12), black);
      f.position.set(sx * 0.7, -0.74, sz * 0.4);
      tv.add(f);
    }

    /* ---------- post-processing: bloom for the blazing screen ---------- */
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(DPR);
    composer.setSize(W(), H());
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), CFG.bloom.strength * (0.3 + 0.7 * CFG.tvGlow), CFG.bloom.radius, CFG.bloom.threshold);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    /* auto quality: if frames are slow, quietly lower the render resolution */
    let dpr = DPR;
    const setDpr = (v) => {
      dpr = v;
      renderer.setPixelRatio(v);
      composer.setPixelRatio(v);
      pU.uPx.value = v;
    };

    /* ---------- input (desktop mouse only) ---------- */
    const target = new THREE.Vector2(0, 0);   // TV turn target
    const smooth = new THREE.Vector2(0, 0);
    const pointer = new THREE.Vector2(0, 0);  // cursor in NDC, relative to the scene
    const raycaster = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    const brushTarget = new THREE.Vector3(0, -50, 0);
    const brushPos = new THREE.Vector3(0, -50, 0);
    let brushOn = 0, brushAmt = 0, brushR = CFG.brush.minR, brushRT = CFG.brush.minR;
    let pointerDirty = false;
    let rect = wrap.getBoundingClientRect();
    /* aim a little above the soil so the brush lands where the blades actually are */
    const BRUSH_LIFT = 0.35 * HS;

    /* walk the camera ray down onto the real hills */
    const marchTerrain = (ray, out) => {
      const o = ray.origin, d = ray.direction;
      const f = (t) => o.y + d.y * t - (hillH(o.x + d.x * t, o.z + d.z * t) + BRUSH_LIFT);
      let t0 = 0.2;
      if (f(t0) <= 0) return -1;
      for (let i = 0; i < 220; i++) {
        const t1 = t0 + 0.1 + t0 * 0.03;
        if (t1 > 70) return -1;
        if (f(t1) <= 0) {
          let a = t0, b = t1;
          for (let k = 0; k < 10; k++) {
            const m = (a + b) * 0.5;
            if (f(m) > 0) a = m; else b = m;
          }
          const tt = (a + b) * 0.5;
          out.set(o.x + d.x * tt, hillH(o.x + d.x * tt, o.z + d.z * tt), o.z + d.z * tt);
          return tt;
        }
        t0 = t1;
      }
      return -1;
    };

    /* the event only stores the position; the heavy work runs once per frame in the loop */
    const onPointer = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      target.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      );
      pointerDirty = true;
    };
    const onLeave = () => { brushOn = 0; pointerDirty = false; };
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    /* ---------- loop ---------- */
    let raf;
    let last = performance.now();
    const t0 = last;
    let slow = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const rawDt = (now - last) / 1000;
      last = now;
      const dt = Math.min(rawDt, 0.05);
      const t = (now - t0) / 1000;

      /* slow for a while? drop resolution one step (never goes back up, so no flip-flopping) */
      if (rawDt > 0.026 && rawDt < 0.5) slow++; else slow = Math.max(0, slow - 1);
      if (slow > 45 && dpr > 1) { setDpr(Math.max(1, dpr - 0.25)); slow = 0; }

      grassU.uTime.value = t;
      pU.uTime.value = t;

      /* cursor -> point on the hill, then glide the brush to it (frame-rate independent) */
      if (!MOB && pointerDirty) {
        pointerDirty = false;
        raycaster.setFromCamera(pointer, camera);
        const dist = marchTerrain(raycaster.ray, hit);
        if (dist > 0) {
          brushTarget.copy(hit);
          brushRT = clamp(dist * CFG.brush.screenFrac, CFG.brush.minR, CFG.brush.maxR);
          if (brushAmt < 0.03) { brushPos.copy(hit); brushR = brushRT; }   // first contact: no sweep from far away
          brushOn = 1;
        } else brushOn = 0;
      }
      brushPos.lerp(brushTarget, 1 - Math.exp(-dt * CFG.brush.follow));
      brushR += (brushRT - brushR) * (1 - Math.exp(-dt * 10));
      brushAmt += ((MOB ? 0 : brushOn) - brushAmt) * (1 - Math.exp(-dt * 8));
      grassU.uBrush.value.copy(brushPos);
      grassU.uBrushR.value = brushR;
      grassU.uBrushS.value = brushAmt * CFG.brush.strength;

      let yawT = tvc.yaw, pitchT = 0;
      if (!MOB) {
        smooth.lerp(target, 1 - Math.exp(-dt * 3));
        yawT += smooth.x * CFG.tvTurnY;
        pitchT = smooth.y * CFG.tvTurnX;
      }
      const kr = 1 - Math.exp(-dt * 5);
      rig.rotation.y += (yawT - rig.rotation.y) * kr;
      rig.rotation.x += (pitchT - rig.rotation.x) * kr;
      grassU.uTvDir.value.set(Math.sin(rig.rotation.y), Math.cos(rig.rotation.y));

      /* screen flicker */
      const fl = 0.93 + Math.sin(t * 19) * 0.04 + Math.sin(t * 47) * 0.02 + Math.random() * 0.03;
      screenLight.intensity = 12 * fl * CFG.tvGlow;
      halo.material.opacity = (0.5 * fl + 0.05) * CFG.tvGlow;

      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 60) c.position.x = -60;
      }

      composer.render();
    };
    loop();

    const onResize = () => {
      rect = wrap.getBoundingClientRect();
      renderer.setSize(W(), H());
      composer.setSize(W(), H());
      applyCamera();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => { x.map?.dispose?.(); x.dispose?.(); });
        else if (m) { m.map?.dispose?.(); m.dispose?.(); }
      });
      envRT.dispose();
      pmrem.dispose();
      composer.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    };
  }, [layoutKey]);

  /* soft blur in the bottom-left corner (desktop only: backdrop-filter over a live canvas is costly) */
  const dof = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    backdropFilter: 'blur(11px)',
    WebkitBackdropFilter: 'blur(11px)',
    WebkitMaskImage: 'radial-gradient(ellipse 62% 42% at 0% 100%, #000 30%, transparent 100%)',
    maskImage: 'radial-gradient(ellipse 62% 42% at 0% 100%, #000 30%, transparent 100%)',
  };
  const showDof = CFG.dof && layoutKey.startsWith('d');

  return (
    <div ref={wrapRef} className="auth-scene" aria-hidden="true">
      {showDof && <div style={dof} />}
    </div>
  );
}
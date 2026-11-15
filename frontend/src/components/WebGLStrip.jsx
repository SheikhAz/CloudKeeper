import { useEffect, useRef } from 'react';
import * as THREE from 'three';

THREE.Cache.enabled = true;
const mod = (n, m) => ((n % m) + m) % m;
const clamp = THREE.MathUtils.clamp;
const MOBILE_MAX = 700; /* px */

function makeNameTexture(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f4f1';
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 10;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 400 104px "Ceraph Roman", Didot, "Bodoni MT", "Times New Roman", serif';
  const parts = name.split(' ');
  if (parts.length > 1) {
    ctx.fillText(parts[0], 256, 108);
    ctx.fillText(parts.slice(1).join(' '), 256, 232);
  } else {
    ctx.fillText(name, 256, 170);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function build(wrap, opts) {
  const isMobile = wrap.clientWidth <= MOBILE_MAX;
  const { items, gap, drift, radiusFactor, top, slope, mobileScale, shiftY = 0 } = {
    ...opts,
    ...(isMobile ? opts.mobile : null),
  };

  const disposables = [];
  const meshes = [];
  let dead = false; /* set on cleanup so late-arriving textures get disposed */
  const W = () => wrap.clientWidth;
  const H = () => wrap.clientHeight;

  const s = isMobile
    ? clamp(W() / 380, 0.8, 1.1) * mobileScale
    : Math.min(1.1, Math.max(0.6, W() / 1440));

  const R = H() * radiusFactor;
  const Cx = W() / 2;
  const Cy = H() * (top + shiftY) + R;

  const sized = items.map((it, i) => {
    let h = it.vh ? H() * it.vh : it.h * s;
    let w = it.ratio ? h * it.ratio : it.w * s;
    if (isMobile) {
      const maxW = W() * 0.8;
      if (w > maxW) { const k = maxW / w; w *= k; h *= k; }
    }
    return { ...it, idx: i, w, h, dy: (it.y || 0) * s };
  });
  let totalW = 0;
  for (const it of sized) { it.cx = totalW + it.w / 2; totalW += it.w + gap * s; }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.domElement.style.pointerEvents = 'none';
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const fov = 30;
  const camZ = (H() / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const camera = new THREE.PerspectiveCamera(fov, W() / H(), 1, camZ * 4);
  camera.position.z = camZ;

  /* ---- load each unique URL once, share the texture across repeated cards ---- */
  const loader = new THREE.TextureLoader();
  const texCache = new Map(); /* src -> { tex, waiting } */
  const loadShared = (src, cb) => {
    let entry = texCache.get(src);
    if (!entry) {
      entry = { tex: null, waiting: [] };
      texCache.set(src, entry);
      loader.load(
        src,
        (tex) => {
          if (dead) { tex.dispose(); return; }
          tex.colorSpace = THREE.SRGBColorSpace;
          entry.tex = tex;
          disposables.push(tex); /* disposed once, not per card */
          entry.waiting.forEach((fn) => fn(tex));
          entry.waiting = [];
        },
        undefined,
        (err) => console.error('Texture failed:', src, err)
      );
    }
    if (entry.tex) cb(entry.tex);
    else entry.waiting.push(cb);
  };

  for (const it of sized) {
    const geo = new THREE.PlaneGeometry(it.w, it.h);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = it;
    scene.add(mesh);
    meshes.push(mesh);
    disposables.push(geo, mat);

    loadShared(it.src, (tex) => {
      mat.map = tex;
      mat.needsUpdate = true;
      mesh.userData.loaded = true;
    });

    if (it.name) {
      const nameTex = makeNameTexture(it.name);
      const nGeo = new THREE.PlaneGeometry(it.w * 0.9, it.w * 0.9 * (320 / 512));
      const nMat = new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, opacity: 0 });
      const nameMesh = new THREE.Mesh(nGeo, nMat);
      nameMesh.position.z = 2;
      nameMesh.rotation.z = THREE.MathUtils.degToRad(56);
      mesh.add(nameMesh);
      mesh.userData.nameMat = nMat;
      disposables.push(nGeo, nMat, nameTex);
    }
  }

  let target = 0, current = 0, dragging = false, lastX = 0;

  /* ---- tap detection (raycast against the photo planes) ---- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;

  const hitTest = (clientX, clientY) => {
    const r = wrap.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(meshes, false); /* nearest first */
    const hit = hits.find((h) => h.object.material.opacity > 0.5);
    return hit ? hit.object.userData.idx : -1;
  };

  const onWheel = (e) => {
    if (e.target.closest?.('.lb-backdrop')) return;
    e.preventDefault();
    target += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  };
  const onDown = (e) => {
    if (e.target.closest?.('a')) return;
    if (e.target.closest?.('.lb-backdrop')) return; /* lightbox open: ignore */
    dragging = true;
    lastX = e.clientX;
    down = e.target.closest?.('.strip-page')
      ? { x: e.clientX, y: e.clientY, t: performance.now() }
      : null;
    document.body.classList.add('is-dragging');
  };
  const onMove = (e) => {
    if (!dragging) return;
    target -= (e.clientX - lastX) * (isMobile ? 2.2 : 1.6);
    lastX = e.clientX;
  };
  const onUp = (e) => {
    dragging = false;
    document.body.classList.remove('is-dragging');
    if (down && e?.type === 'pointerup') {
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 6 && performance.now() - down.t < 400) {
        const idx = hitTest(e.clientX, e.clientY);
        if (idx >= 0) opts.onItemClick?.(idx);
      }
    }
    down = null;
  };

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  let last = performance.now();
  let raf;
  const tick = () => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!dragging) target += drift * dt * 60;
    const prev = current;
    current += (target - current) * 0.075;
    const vel = current - prev;

    for (const m of meshes) {
      const it = m.userData;

      const arcX = mod(it.cx - current, totalW) - totalW / 2;
      const th = arcX / R;
      const xs = Cx + R * Math.sin(th);
      const ys = Cy - R * Math.cos(th) - it.dy;

      const u = clamp((xs - Cx) / (W() / 2), -1.3, 1.3);
      const sc = 1 - u * slope;

      m.position.set(xs - W() / 2, H() / 2 - ys, -u * 20);
      m.scale.set(sc, sc, 1);
      m.rotation.z = th + clamp(vel * 0.0008, -0.05, 0.05);
      m.rotation.y = clamp(-vel * 0.0025, -0.18, 0.18);

      const o = it.loaded ? 1 : 0;
      m.material.opacity += (o - m.material.opacity) * 0.08;
      if (it.nameMat) it.nameMat.opacity += (o - it.nameMat.opacity) * 0.08;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    document.body.classList.remove('is-dragging');
    for (const d of disposables) d.dispose?.();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

export default function WebGLStrip({
  items,
  gap = 130,
  drift = 0,
  radiusFactor = 1.8,
  top = 0.28,
  slope = 0,
  mobileScale = 1,
  mobile = null,
  onItemClick = null,
}) {
  const wrapRef = useRef(null);
  const clickRef = useRef(onItemClick);
  clickRef.current = onItemClick; /* latest callback without rebuilding the scene */

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const opts = {
      items, gap, drift, radiusFactor, top, slope, mobileScale, mobile,
      onItemClick: (i) => clickRef.current?.(i),
    };
    let cleanup = build(wrap, opts);
    let lastW = wrap.clientWidth;
    let lastH = wrap.clientHeight;

    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        if (w === lastW && Math.abs(h - lastH) < 80) return;
        lastW = w; lastH = h;
        cleanup();
        cleanup = build(wrap, opts);
      }, 220);
    };
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
      cleanup();
    };
  }, [items, gap, drift, radiusFactor, top, slope, mobileScale, mobile]);

  return <div ref={wrapRef} className="strip" aria-hidden="true" />;
}
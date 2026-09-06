import * as THREE from "three";
import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";
import { t } from "../i18n.js";

/**
 * Hero Gaussian-splat viewer.
 * Replaces the static hero photo with an interactive 3D reconstruction
 * (video 360 -> COLMAP -> Brush -> .splat).
 *
 * Navigation: drag to orbit, WASD to move, Q/E (or R/F) up-down, hold Shift to sprint.
 * No automated camera motion — everything is user-driven.
 * Tuning helpers:  ?splatdebug  ?cam=x,y,z  ?target=x,y,z  ?up=x,y,z  ?rot=x,y,z(deg)
 */

const SPLAT_URL = "/models/nico-splat.splat";
const SPLAT_CACHE = "hero-splat-v1";

/**
 * Fetch the ~9.6 MB splat once and keep it in the Cache API, so later visits
 * (and reloads) read it straight from disk instead of the network.
 */
async function loadSplatBlob() {
  try {
    if (self.caches) {
      // drop any stale versions of this cache
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("hero-splat-") && n !== SPLAT_CACHE).map((n) => caches.delete(n))
      );

      const cache = await caches.open(SPLAT_CACHE);
      let resp = await cache.match(SPLAT_URL);
      if (!resp) {
        resp = await fetch(SPLAT_URL, { cache: "force-cache" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        await cache.put(SPLAT_URL, resp.clone());
      }
      return await resp.blob();
    }
  } catch (_) {
    /* Cache API unavailable (private window, etc.) — fall back to a plain fetch */
  }
  const resp = await fetch(SPLAT_URL, { cache: "force-cache" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.blob();
}

// --- framing config (edit these to re-aim the camera) ---
const FRAME = {
  cameraPosition: [-0.731, 0.743, -0.516],
  cameraLookAt: [0.125, 0.737, 0.231],
  cameraUp: [0.0, -1.0, 0.0], // COLMAP / Brush scenes are Y-down
  splatRotationDeg: [0, 0, 0], // extra orientation fix for the splat cloud
  moveSpeed: 1.4, // units / second
  sprintMultiplier: 3.0,
};

const MOVE_KEYS = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "KeyR", "KeyF",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
]);

function readVec(name) {
  const raw = new URLSearchParams(location.search).get(name);
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? parts : null;
}

function eulerDegToQuat([x, y, z]) {
  const e = new THREE.Euler(
    (x * Math.PI) / 180,
    (y * Math.PI) / 180,
    (z * Math.PI) / 180,
    "XYZ"
  );
  const q = new THREE.Quaternion().setFromEuler(e);
  return [q.x, q.y, q.z, q.w];
}

export function initSplatScene(container) {
  const debug = new URLSearchParams(location.search).has("splatdebug");
  const camPos = readVec("cam") || FRAME.cameraPosition;
  const camTarget = readVec("target") || FRAME.cameraLookAt;
  const camUp = readVec("up") || FRAME.cameraUp;
  const rotDeg = readVec("rot") || FRAME.splatRotationDeg;

  container.setAttribute("tabindex", "0");
  try {
    localStorage.removeItem("heroSplatFraming"); // legacy: framing no longer persisted
  } catch (_) {}

  const viewer = new GaussianSplats3D.Viewer({
    rootElement: container,
    sharedMemoryForWorkers: false, // Vite dev server is not cross-origin isolated
    selfDrivenMode: true,
    useBuiltInControls: true,
    dynamicScene: false,
    antialiased: true,
    sphericalHarmonicsDegree: 0,
    cameraUp: camUp,
    initialCameraPosition: camPos,
    initialCameraLookAt: camTarget,
    ignoreDevicePixelRatio: false,
    halfPrecisionCovariancesOnGPU: true,
  });

  let disposed = false;
  const keys = new Set();
  let navActive = false;
  let lastT = performance.now();

  const loader = container.querySelector(".splat-loader");
  const loaderLabel = container.querySelector(".splat-loader__label");

  // touch devices get a gesture-appropriate hint (no scroll wheel, no WASD)
  const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const hintEl = container.querySelector(".splat-hint");
  if (coarsePointer && hintEl) {
    hintEl.setAttribute("data-i18n", "splat.hintTouch");
    hintEl.textContent = t("splat.hintTouch");
  }

  const cleanups = [];
  const on = (el, ev, fn, opts) => {
    el.addEventListener(ev, fn, opts);
    cleanups.push(() => el.removeEventListener(ev, fn, opts));
  };

  // GitHub Pages serves .splat with `Content-Encoding: gzip`, so the header's
  // Content-Length is the *compressed* size — which breaks the library's loader.
  // Fetch it ourselves (the browser transparently inflates), then hand the
  // library a blob: URL whose Content-Length matches the real byte count.
  let blobUrl = null;
  const dropBlobUrl = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  };

  const beginLoad = () =>
    loadSplatBlob()
    .then((blob) => {
      if (disposed) return;
      blobUrl = URL.createObjectURL(blob);
      return viewer.addSplatScene(blobUrl, {
        format: GaussianSplats3D.SceneFormat.Splat,
        showLoadingUI: false,
        progressiveLoad: false,
        splatAlphaRemovalThreshold: 5,
        rotation: eulerDegToQuat(rotDeg),
        position: [0, 0, 0],
        scale: [1, 1, 1],
      });
    })
    .then(() => {
      dropBlobUrl();
      if (disposed) return;
      viewer.start();
      container.classList.add("is-ready");

      // stop rendering entirely while the viewer is scrolled off-screen or the tab is hidden
      let onScreen = true;
      const setRunning = (run) => {
        if (disposed) return;
        try {
          if (run) viewer.start();
          else viewer.stop();
        } catch (_) {}
      };
      const io = new IntersectionObserver(
        (entries) => {
          const vis = entries[entries.length - 1].isIntersecting;
          if (vis === onScreen) return;
          onScreen = vis;
          setRunning(vis && !document.hidden);
        },
        { rootMargin: "150px" }
      );
      io.observe(container);
      cleanups.push(() => io.disconnect());
      on(document, "visibilitychange", () => setRunning(onScreen && !document.hidden));

      const controls = viewer.controls;
      if (controls) {
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enableZoom = true;
        controls.zoomSpeed = 0.6;
        controls.enablePan = true;
        controls.autoRotate = false;
        controls.target.set(camTarget[0], camTarget[1], camTarget[2]);
      }

      // --- persist / report the live framing (dev tuning aid) ---
      const round = (n) => Math.round(n * 1000) / 1000;
      const vecArr = (v) => [round(v.x), round(v.y), round(v.z)];
      let reportT;
      const reportFraming = () => {
        if (!debug) return;
        clearTimeout(reportT);
        reportT = setTimeout(() => {
          if (disposed || !controls) return;
          const cam = vecArr(viewer.camera.position);
          const target = vecArr(controls.target);
          console.log(`[splat framing] ?cam=${cam}&target=${target}`);
        }, 350);
      };
      if (controls) {
        on(controls, "end", () => reportFraming());
      }

      // --- WASD / arrows fly-through ---
      const setActive = (v) => {
        navActive = v;
        if (!v) keys.clear();
      };
      on(container, "pointerenter", () => setActive(true));
      on(container, "pointerleave", () => setActive(false));
      on(container, "focus", () => setActive(true));
      on(container, "blur", () => setActive(false));
      on(window, "keydown", (e) => {
        if (!navActive || !MOVE_KEYS.has(e.code)) return;
        e.preventDefault();
        keys.add(e.code);
      });
      on(window, "keyup", (e) => {
        keys.delete(e.code);
        if (MOVE_KEYS.has(e.code)) reportFraming();
      });

      const fwd = new THREE.Vector3();
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      const step = new THREE.Vector3();

      const moveTick = () => {
        if (disposed) return;
        requestAnimationFrame(moveTick);
        if (!controls || !onScreen) return;
        const now = performance.now();
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;

        if (keys.size === 0) return;

        fwd.copy(controls.target).sub(viewer.camera.position);
        if (fwd.lengthSq() < 1e-8) return;
        fwd.normalize();
        up.copy(viewer.camera.up).normalize();
        right.crossVectors(fwd, up).normalize();

        step.set(0, 0, 0);
        if (keys.has("KeyW") || keys.has("ArrowUp")) step.add(fwd);
        if (keys.has("KeyS") || keys.has("ArrowDown")) step.sub(fwd);
        if (keys.has("KeyD") || keys.has("ArrowRight")) step.add(right);
        if (keys.has("KeyA") || keys.has("ArrowLeft")) step.sub(right);
        if (keys.has("KeyE") || keys.has("KeyR")) step.sub(up);
        if (keys.has("KeyQ") || keys.has("KeyF")) step.add(up);
        if (step.lengthSq() === 0) return;

        const sprint =
          keys.has("ShiftLeft") || keys.has("ShiftRight") ? FRAME.sprintMultiplier : 1;
        step.normalize().multiplyScalar(FRAME.moveSpeed * sprint * dt);
        viewer.camera.position.add(step);
        controls.target.add(step);
        reportFraming();
      };
      requestAnimationFrame(moveTick);

      if (debug) attachDebugHUD(container, viewer);
    })
    .catch((err) => {
      dropBlobUrl();
      console.error("[splat-scene] failed to load", err);
      container.classList.add("is-failed");
      if (loader) loader.classList.add("splat-loader--error");
      if (loaderLabel) loaderLabel.textContent = t("splat.error");
      const ring = container.querySelector(".splat-loader__ring");
      if (ring) ring.remove();
    });

  // don't touch the network or the GPU until the viewer is near the viewport
  const loadIO = new IntersectionObserver(
    (entries) => {
      if (disposed || !entries.some((e) => e.isIntersecting)) return;
      loadIO.disconnect();
      beginLoad();
    },
    { rootMargin: "600px" }
  );
  loadIO.observe(container);
  cleanups.push(() => loadIO.disconnect());

  return {
    dispose() {
      disposed = true;
      cleanups.forEach((fn) => fn());
      try {
        viewer.dispose();
      } catch (_) {}
    },
  };
}

function attachDebugHUD(container, viewer) {
  const hud = document.createElement("div");
  hud.style.cssText =
    "position:absolute;left:6px;bottom:6px;z-index:5;font:11px/1.4 ui-monospace,monospace;" +
    "background:rgba(0,0,0,.65);color:#0f0;padding:6px 8px;border-radius:6px;white-space:pre;pointer-events:none";
  container.appendChild(hud);
  const p = new THREE.Vector3();
  const fmt = (v) => `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
  const tick = () => {
    if (!container.isConnected) return;
    viewer.camera.getWorldPosition(p);
    const t = viewer.controls ? viewer.controls.target : { x: 0, y: 0, z: 0 };
    hud.textContent =
      `cam=${fmt(p)}\n` +
      `target=${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)}\n` +
      `up=${fmt(viewer.camera.up)}`;
    requestAnimationFrame(tick);
  };
  tick();
}

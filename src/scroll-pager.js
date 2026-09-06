/**
 * Wheel-driven section pager (mouse only).
 * A small wheel gesture jumps to the next well-defined stop:
 *   hero -> about -> arduino widget -> focus areas -> experience -> let's talk
 * A stop taller than the viewport is walked in ~one-screen steps before the jump.
 * Touch and keyboard are untouched; they rely on native scroll + CSS proximity snap.
 */

const COOLDOWN_MS = 620;
const DELTA_THRESHOLD = 4;
const TOP_PAD = 16;

export function initScrollPager() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;

  const navH = () =>
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--nav-h")
    ) || 88;

  const collectStops = () =>
    [
      document.getElementById("hero"),
      document.getElementById("about"),
      document.querySelector("#about .lab"),
      document.getElementById("focus"),
      document.getElementById("experience"),
      document.getElementById("contact"),
    ].filter(Boolean);

  let stops = collectStops();
  if (stops.length < 2) return;

  let locked = false;
  const lock = () => {
    locked = true;
    window.setTimeout(() => {
      locked = false;
    }, COOLDOWN_MS);
  };

  const stopY = (el) =>
    Math.max(0, el.getBoundingClientRect().top + window.scrollY - navH() - TOP_PAD);

  const currentIndex = () => {
    const y = window.scrollY;
    let idx = 0;
    for (let i = 0; i < stops.length; i++) {
      if (stopY(stops[i]) <= y + 6) idx = i;
    }
    return idx;
  };

  const scrollTo = (top) => {
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    lock();
  };

  const goToIndex = (i) => {
    i = Math.max(0, Math.min(stops.length - 1, i));
    scrollTo(stopY(stops[i]));
  };

  const onWheel = (event) => {
    if (event.ctrlKey) return; // pinch-zoom
    if (event.target.closest("#mini-ide, textarea, input, select, [contenteditable]")) return;
    if (Math.abs(event.deltaY) < DELTA_THRESHOLD) return;

    if (locked) {
      event.preventDefault();
      return;
    }

    const dir = event.deltaY > 0 ? 1 : -1;
    const idx = currentIndex();
    const y = window.scrollY;
    const vh = window.innerHeight;
    const regionTop = stopY(stops[idx]);
    const regionBottom =
      idx + 1 < stops.length ? stopY(stops[idx + 1]) : document.body.scrollHeight;

    event.preventDefault();

    if (dir > 0) {
      // more of this stop still below the fold -> step down one screen first
      if (regionBottom - y > vh + 24) {
        scrollTo(Math.min(regionBottom, y + vh * 0.85));
      } else {
        goToIndex(idx + 1);
      }
    } else {
      // sitting below this stop's top -> return to it before leaving for the previous one
      if (y - regionTop > vh * 0.4) {
        scrollTo(Math.max(regionTop, y - vh * 0.85));
      } else if (y - regionTop > 24) {
        goToIndex(idx);
      } else {
        goToIndex(idx - 1);
      }
    }
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener(
    "resize",
    () => {
      stops = collectStops();
    },
    { passive: true }
  );
}

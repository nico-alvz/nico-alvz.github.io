// A 3-card 3D carousel: one card centered and focused (white, full detail),
// the other two fanned to the sides in perspective. Clicking a side card,
// the arrows, or a dot brings that pillar to the center. It also auto-rotates
// on a timer, pausing whenever the pointer gets near the carousel (not just
// while exactly over it) so it never fights the visitor for control.

const AUTOPLAY_BASE_MS = 4000;
const AUTOPLAY_JITTER_MS = 3000; // random +1s to +3s on top of the base delay
const PROXIMITY_PX = 90;

function nextDelay() {
  return AUTOPLAY_BASE_MS + 1000 + Math.random() * (AUTOPLAY_JITTER_MS - 1000);
}

export function initFocusCarousel() {
  const root = document.getElementById("focus-carousel");
  if (!root) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cards = Array.from(root.querySelectorAll(".carousel__card"));
  const dots = Array.from(root.querySelectorAll(".carousel__dot"));
  const arrows = Array.from(root.querySelectorAll(".carousel__arrow"));
  const ids = cards.map((card) => card.dataset.id);
  let active = ids.indexOf("web");
  if (active === -1) active = 0;

  function render() {
    const n = ids.length;
    cards.forEach((card, i) => {
      let offset = i - active;
      if (offset > n / 2) offset -= n;
      if (offset < -n / 2) offset += n;
      card.dataset.pos = String(offset);
      const isActive = offset === 0;
      card.setAttribute("aria-current", isActive ? "true" : "false");
      const link = card.querySelector(".repo-preview");
      if (link) link.tabIndex = isActive ? 0 : -1;
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === active);
      dot.setAttribute("aria-current", i === active ? "true" : "false");
    });
  }

  function goTo(index) {
    const n = ids.length;
    active = ((index % n) + n) % n;
    render();
  }

  cards.forEach((card, i) => {
    card.addEventListener("click", () => {
      if (i !== active) {
        goTo(i);
        restartAutoplay();
      }
    });
  });

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      goTo(i);
      restartAutoplay();
    });
  });

  arrows.forEach((btn) => {
    btn.addEventListener("click", () => {
      goTo(active + Number(btn.dataset.dir));
      restartAutoplay();
    });
  });

  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(active - 1);
      restartAutoplay();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(active + 1);
      restartAutoplay();
    } else if (event.key === "Enter" || event.key === " ") {
      const card = event.target.closest?.(".carousel__card");
      if (card) {
        event.preventDefault();
        goTo(cards.indexOf(card));
        restartAutoplay();
      }
    }
  });

  // --- autoplay, paused whenever the pointer is near the carousel ---
  let timer = null;
  let paused = false;

  function tick() {
    goTo(active + 1);
    timer = window.setTimeout(tick, nextDelay());
  }

  function startAutoplay() {
    if (reduceMotion || timer) return;
    timer = window.setTimeout(tick, nextDelay());
  }

  function stopAutoplay() {
    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  function restartAutoplay() {
    if (paused) return;
    stopAutoplay();
    startAutoplay();
  }

  function handlePointerMove(event) {
    const rect = root.getBoundingClientRect();
    const nearby =
      event.clientX >= rect.left - PROXIMITY_PX &&
      event.clientX <= rect.right + PROXIMITY_PX &&
      event.clientY >= rect.top - PROXIMITY_PX &&
      event.clientY <= rect.bottom + PROXIMITY_PX;
    if (nearby && !paused) {
      paused = true;
      stopAutoplay();
    } else if (!nearby && paused) {
      paused = false;
      startAutoplay();
    }
  }

  if (!reduceMotion) {
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    root.addEventListener("focusin", () => {
      paused = true;
      stopAutoplay();
    });
    root.addEventListener("focusout", (event) => {
      if (!root.contains(event.relatedTarget)) {
        paused = false;
        startAutoplay();
      }
    });
  }

  render();
  startAutoplay();
}

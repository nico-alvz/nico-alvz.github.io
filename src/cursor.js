export function initCursor() {
  if (window.matchMedia("(hover: none)").matches) return;

  const dot = document.querySelector(".cursor-dot");
  const ring = document.querySelector(".cursor-ring");
  if (!dot || !ring) return;

  const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const dotPos = { ...target };
  const ringPos = { ...target };

  window.addEventListener("pointermove", (event) => {
    target.x = event.clientX;
    target.y = event.clientY;
  });

  const interactiveSelector = "a, button, .focus-card, canvas";
  document.addEventListener("pointerover", (event) => {
    if (event.target.closest?.(interactiveSelector)) {
      ring.classList.add("is-active");
    }
  });
  document.addEventListener("pointerout", (event) => {
    if (event.target.closest?.(interactiveSelector)) {
      ring.classList.remove("is-active");
    }
  });

  function tick() {
    dotPos.x += (target.x - dotPos.x) * 0.55;
    dotPos.y += (target.y - dotPos.y) * 0.55;
    ringPos.x += (target.x - ringPos.x) * 0.16;
    ringPos.y += (target.y - ringPos.y) * 0.16;

    dot.style.transform = `translate(${dotPos.x}px, ${dotPos.y}px) translate(-50%, -50%)`;
    ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%, -50%)`;

    requestAnimationFrame(tick);
  }
  tick();
}

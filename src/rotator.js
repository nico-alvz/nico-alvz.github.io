import gsap from "gsap";

export function initRotator() {
  const el = document.querySelector(".rotator");
  if (!el) return;

  const words = el.dataset.words.split(",");
  let index = 0;
  el.textContent = words[0];

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  function next() {
    index = (index + 1) % words.length;
    gsap
      .timeline()
      .to(el, { yPercent: -110, opacity: 0, duration: 0.45, ease: "power3.in" })
      .call(() => {
        el.textContent = words[index];
      })
      .fromTo(
        el,
        { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.55, ease: "power3.out" }
      );
  }

  gsap.set(el, { display: "inline-block" });
  setInterval(next, 2600);
}

export function initReveal() {
  const revealEls = document.querySelectorAll(".reveal");
  const groupCounters = new Map();

  revealEls.forEach((el) => {
    const parent = el.parentElement;
    const count = groupCounters.get(parent) ?? 0;
    el.style.transitionDelay = `${Math.min(count * 70, 280)}ms`;
    groupCounters.set(parent, count + 1);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );

  revealEls.forEach((el) => observer.observe(el));
}

export function initMaskReveal() {
  const words = document.querySelectorAll(".mask-reveal");
  requestAnimationFrame(() => {
    words.forEach((word, i) => {
      word.style.transition = "transform 1s cubic-bezier(0.16, 1, 0.3, 1)";
      word.style.transitionDelay = `${i * 90}ms`;
      word.style.transform = "translateY(0)";
    });
  });
}

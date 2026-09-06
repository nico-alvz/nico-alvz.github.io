import "./style.css";
import { initI18n } from "./i18n.js";
import { initNav } from "./nav.js";
import { initBackgroundScene } from "./scenes/background-scene.js";
import { initCursor } from "./cursor.js";
import { initRotator } from "./rotator.js";
import { initReveal, initMaskReveal } from "./reveal.js";
import { initFocusCarousel } from "./focus-carousel.js";
import { initRepoPreviews } from "./repo-preview.js";

document.addEventListener("DOMContentLoaded", () => {
  initI18n();
  initNav();

  // A WebGL failure on a weak/blocked device must not take the rest of the page down.
  const bgCanvas = document.getElementById("bg-canvas");
  if (bgCanvas) {
    try {
      initBackgroundScene(bgCanvas);
    } catch (err) {
      console.warn("background scene disabled:", err);
    }
  }

  const heroSplat = document.getElementById("hero-splat");
  if (heroSplat) {
    import("./scenes/splat-scene.js")
      .then(({ initSplatScene }) => initSplatScene(heroSplat))
      .catch((err) => console.warn("splat viewer disabled:", err));
  }

  const heroArduinoCanvas = document.getElementById("hero-arduino-canvas");
  if (heroArduinoCanvas) {
    window.__DEBUG_ARDUINO__ = new URLSearchParams(location.search).has("debug");
    import("./scenes/arduino-scene.js").then(({ initArduinoScene }) => {
      const sceneApi = initArduinoScene(heroArduinoCanvas);
      import("./mini-ide.js").then(({ initMiniIDE }) => initMiniIDE(sceneApi));
    });
  }

  initCursor();
  initRotator();
  initFocusCarousel();
  initRepoPreviews();
  initMaskReveal();
  initReveal();

  const scrollCue = document.querySelector(".scroll-cue");
  if (scrollCue) {
    window.addEventListener(
      "scroll",
      () => {
        scrollCue.classList.toggle("is-hidden", window.scrollY > 60);
      },
      { passive: true }
    );
  }
});

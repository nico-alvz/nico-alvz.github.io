import "./style.css";
import { initI18n } from "./i18n.js";
import { initBackgroundScene } from "./scenes/background-scene.js";
import { initCursor } from "./cursor.js";
import { initRotator } from "./rotator.js";
import { initReveal, initMaskReveal } from "./reveal.js";
import { initFocusCarousel } from "./focus-carousel.js";
import { initRepoPreviews } from "./repo-preview.js";

document.addEventListener("DOMContentLoaded", () => {
  initI18n();

  const bgCanvas = document.getElementById("bg-canvas");
  if (bgCanvas) initBackgroundScene(bgCanvas);

  const heroSplat = document.getElementById("hero-splat");
  if (heroSplat) {
    import("./scenes/splat-scene.js").then(({ initSplatScene }) => initSplatScene(heroSplat));
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

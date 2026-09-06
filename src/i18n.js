/**
 * Tiny runtime i18n for the portfolio.
 * - Default language is auto-detected from a saved choice or the browser/OS language.
 * - Translatable nodes carry data-i18n / data-i18n-html / data-i18n-attr="attr:key;..".
 * - setLang() swaps text in place and notifies listeners (t()) plus a "langchange" window event.
 */

const SUPPORTED = ["es", "en"];
const STORE = "lang";
const DEFAULT = "es";

const DICT = {
  es: {
    "meta.title": "Nicolás Álvarez · IoT, desarrollo web e inteligencia artificial",
    "meta.desc":
      "Portafolio de Nicolás Álvarez, estudiante de Ingeniería Civil en Computación e Informática. IoT, desarrollo web e inteligencia artificial.",

    "nav.about": "Sobre mí",
    "nav.focus": "Enfoque",
    "nav.experience": "Experiencia",
    "nav.contact": "Contacto",
    "nav.menu": "Menú",
    "nav.menuClose": "Cerrar",

    "hero.role":
      "Ingeniería Civil en Computación e Informática · Universidad Católica del Norte",
    "hero.buildingIn": "Construyendo en",
    "rotator.words": "Internet de las Cosas,Desarrollo Web,Inteligencia Artificial",

    "splat.loading": "Cargando",
    "splat.hint": "Arrastra para girar · Rueda para acercar · WASD para moverte",
    "splat.hintTouch": "Desliza para girar · Pellizca para acercar",
    "splat.error": "No se pudo cargar el modelo 3D",

    "about.title": "Sobre mí",
    "about.lead":
      "Soy estudiante de Ingeniería Civil en Computación e Informática en la Universidad Católica del Norte. Soy apasionado por mis proyectos y disfruto encontrar soluciones creativas a problemas difíciles. Hoy me enfoco en construir sistemas conectados, productos web sólidos y aplicaciones inteligentes.",
    "about.fact1": "Inglés nivel intermedio, B1 Preliminary (Cambridge English)",
    "about.fact2": "Interés activo en el estado del arte tecnológico y campos emergentes",
    "about.modelCaption":
      'Modelo 3D: <a href="https://sketchfab.com/3d-models/aulas-23-24-e-25-genius-2d19400de55b4d0f98766f51552c6e48" target="_blank" rel="noopener">"Aulas 23, 24 e 25 - Genius"</a> por <a href="https://sketchfab.com/roboticaparana" target="_blank" rel="noopener">Robótica Paraná</a>, CC BY 4.0',

    "ide.hint": "Escribe tu sketch y pulsa el check para verificar.",
    "ide.verify": "Verificar",
    "ide.upload": "Subir",
    "ide.okVerify": "Sin errores.",
    "ide.okUpload": "Subido — el modelo ahora corre tu código.",
    "ide.lineLabel": "Línea",

    "focus.title": "Áreas de enfoque",
    "focus.iot.title": "Internet de las Cosas",
    "focus.iot.desc":
      "Diseño e implementación de sistemas conectados y proyectos de domótica, desde el microcontrolador hasta la nube.",
    "focus.web.title": "Desarrollo Web",
    "focus.web.desc":
      "Aplicaciones web y móviles pensadas de extremo a extremo, con foco en experiencia de usuario, rendimiento y buenas prácticas de despliegue.",
    "focus.ai.title": "Inteligencia Artificial",
    "focus.ai.desc":
      "Investigación aplicada en aprendizaje de máquinas y aprendizaje por refuerzo, explorando cómo dotar de inteligencia a sistemas reales.",

    "tag.microcontrollers": "Microcontroladores",
    "tag.sensors": "Sensores",
    "tag.homeAutomation": "Domótica",
    "tag.systemArchitecture": "Arquitectura de sistemas",
    "tag.machineLearning": "Aprendizaje de máquinas",
    "tag.reinforcementLearning": "Aprendizaje por refuerzo",
    "tag.itServiceMgmt": "Gestión de servicios TI",
    "tag.projectEvaluation": "Evaluación de proyectos",

    "repo.view": "Ver repositorio en GitHub",
    "common.prev": "Anterior",
    "common.next": "Siguiente",

    "exp.title": "Experiencia",
    "exp.date1": "Ene 2025 — Mar 2025",
    "exp.job1": "Estudiante en Prácticas",
    "exp.org1": "Aguas Antofagasta · Contrato de prácticas · Presencial",
    "exp.date2": "Mar 2024 — Jun 2024",
    "exp.job2": "Ayudante de Proyecto, Introducción a la Ingeniería",
    "exp.org2": "Universidad Católica del Norte · Autónomo · Antofagasta, Chile",

    "edu.label": "Educación",
    "edu.deg1title": "Ingeniería Civil en Computación e Informática",
    "edu.deg1meta": "Universidad Católica del Norte · 2020 — actualidad",
    "edu.deg2title": "Educación escolar",
    "edu.deg2meta": "Colegio Inglés San José · 2007 — 2019",

    "contact.title": "Conversemos",
    "contact.lead": "¿Un proyecto en mente o alguna oportunidad? Escríbeme.",

    "langToggle.label": "Switch to English",
  },

  en: {
    "meta.title": "Nicolás Álvarez · IoT, web development & artificial intelligence",
    "meta.desc":
      "Portfolio of Nicolás Álvarez, Computer Science & Informatics Engineering student. IoT, web development and artificial intelligence.",

    "nav.about": "About",
    "nav.focus": "Focus",
    "nav.experience": "Experience",
    "nav.contact": "Contact",
    "nav.menu": "Menu",
    "nav.menuClose": "Close",

    "hero.role":
      "Computer Science & Informatics Engineering · Universidad Católica del Norte",
    "hero.buildingIn": "Building in",
    "rotator.words": "Internet of Things,Web Development,Artificial Intelligence",

    "splat.loading": "Loading",
    "splat.hint": "Drag to orbit · Scroll to zoom · WASD to move",
    "splat.hintTouch": "Swipe to orbit · Pinch to zoom",
    "splat.error": "Could not load the 3D model",

    "about.title": "About me",
    "about.lead":
      "I'm a Computer Science & Informatics Engineering student at Universidad Católica del Norte. I'm passionate about my projects and enjoy finding creative solutions to hard problems. Right now I focus on building connected systems, solid web products and intelligent applications.",
    "about.fact1": "Intermediate English, B1 Preliminary (Cambridge English)",
    "about.fact2": "Active interest in the state of the art and emerging tech fields",
    "about.modelCaption":
      '3D model: <a href="https://sketchfab.com/3d-models/aulas-23-24-e-25-genius-2d19400de55b4d0f98766f51552c6e48" target="_blank" rel="noopener">"Aulas 23, 24 e 25 - Genius"</a> by <a href="https://sketchfab.com/roboticaparana" target="_blank" rel="noopener">Robótica Paraná</a>, CC BY 4.0',

    "ide.hint": "Write your sketch and hit the check to verify.",
    "ide.verify": "Verify",
    "ide.upload": "Upload",
    "ide.okVerify": "No errors.",
    "ide.okUpload": "Uploaded — the model now runs your code.",
    "ide.lineLabel": "Line",

    "focus.title": "Focus areas",
    "focus.iot.title": "Internet of Things",
    "focus.iot.desc":
      "Design and implementation of connected systems and home-automation projects, from the microcontroller to the cloud.",
    "focus.web.title": "Web Development",
    "focus.web.desc":
      "End-to-end web and mobile applications, focused on user experience, performance and solid deployment practices.",
    "focus.ai.title": "Artificial Intelligence",
    "focus.ai.desc":
      "Applied research in machine learning and reinforcement learning, exploring how to bring intelligence to real systems.",

    "tag.microcontrollers": "Microcontrollers",
    "tag.sensors": "Sensors",
    "tag.homeAutomation": "Home automation",
    "tag.systemArchitecture": "System architecture",
    "tag.machineLearning": "Machine learning",
    "tag.reinforcementLearning": "Reinforcement learning",
    "tag.itServiceMgmt": "IT service management",
    "tag.projectEvaluation": "Project evaluation",

    "repo.view": "View repository on GitHub",
    "common.prev": "Previous",
    "common.next": "Next",

    "exp.title": "Experience",
    "exp.date1": "Jan 2025 — Mar 2025",
    "exp.job1": "Intern",
    "exp.org1": "Aguas Antofagasta · Internship contract · On-site",
    "exp.date2": "Mar 2024 — Jun 2024",
    "exp.job2": "Project Assistant, Introduction to Engineering",
    "exp.org2": "Universidad Católica del Norte · Freelance · Antofagasta, Chile",

    "edu.label": "Education",
    "edu.deg1title": "Computer Science & Informatics Engineering",
    "edu.deg1meta": "Universidad Católica del Norte · 2020 — present",
    "edu.deg2title": "School education",
    "edu.deg2meta": "Colegio Inglés San José · 2007 — 2019",

    "contact.title": "Let's talk",
    "contact.lead": "Got a project in mind or an opportunity? Drop me a line.",

    "langToggle.label": "Cambiar a español",
  },
};

let current = DEFAULT;
const listeners = new Set();

function detect() {
  try {
    const saved = localStorage.getItem(STORE);
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch (_) {}
  const list =
    navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || DEFAULT];
  for (const l of list) {
    const base = String(l).toLowerCase().split("-")[0];
    if (SUPPORTED.includes(base)) return base;
  }
  return DEFAULT;
}

export function getLang() {
  return current;
}

export function t(key) {
  const table = DICT[current] || DICT[DEFAULT];
  if (key in table) return table[key];
  return key in DICT[DEFAULT] ? DICT[DEFAULT][key] : key;
}

export function onLangChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function applyDom(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n-html"));
  });
  root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    el.getAttribute("data-i18n-attr")
      .split(";")
      .forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
  });
}

export function setLang(lang, { persist = true } = {}) {
  if (!SUPPORTED.includes(lang)) return;
  current = lang;
  document.documentElement.lang = lang;
  if (persist) {
    try {
      localStorage.setItem(STORE, lang);
    } catch (_) {}
  }

  applyDom();

  const rot = document.querySelector(".rotator");
  if (rot) rot.dataset.words = t("rotator.words");

  document.querySelectorAll("[data-lang-toggle]").forEach((btn) => {
    btn.textContent = current === "es" ? "EN" : "ES";
    btn.setAttribute("aria-label", t("langToggle.label"));
  });

  listeners.forEach((cb) => {
    try {
      cb(current);
    } catch (_) {}
  });
  window.dispatchEvent(new CustomEvent("langchange", { detail: current }));
}

export function initI18n() {
  setLang(detect(), { persist: false });
  document.querySelectorAll("[data-lang-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => setLang(current === "es" ? "en" : "es"));
  });
}

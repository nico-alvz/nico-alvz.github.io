import { t, onLangChange } from "./i18n.js";

// Mobile navigation: below the CSS breakpoint the section links collapse behind
// the "Menú"/"Menu" text control and open as a full-width sheet under the bar.
export function initNav() {
  const btn = document.getElementById("nav-menu-btn");
  const panel = document.getElementById("site-nav-links");
  if (!btn || !panel) return;

  const mq = window.matchMedia("(max-width: 720px)");
  let open = false;

  const setOpen = (next) => {
    open = next;
    btn.setAttribute("aria-expanded", String(open));
    panel.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
    btn.textContent = open ? t("nav.menuClose") : t("nav.menu");
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!open);
  });

  // close on link tap, outside tap, Escape, or when leaving the mobile breakpoint
  panel.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("click", (e) => {
    if (open && !e.target.closest(".site-nav")) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (open && e.key === "Escape") {
      setOpen(false);
      btn.focus();
    }
  });
  mq.addEventListener("change", (e) => {
    if (!e.matches) setOpen(false);
  });

  // i18n re-applies data-i18n on every language switch; re-assert the state label after
  onLangChange(() => {
    btn.textContent = open ? t("nav.menuClose") : t("nav.menu");
  });
}

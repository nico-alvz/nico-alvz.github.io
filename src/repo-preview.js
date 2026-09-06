// Fetches public repo metadata from the GitHub API to fill in the
// link-preview cards (stars, language, description) — same idea as the
// preview you get when a GitHub link is shared elsewhere.

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

async function fillPreview(el) {
  const repo = el.dataset.repo;
  if (!repo) return;
  const descEl = el.querySelector(".repo-preview__desc");
  const statsEl = el.querySelector(".repo-preview__stats");
  const starsEl = el.querySelector(".repo-preview__stars");
  const langEl = el.querySelector(".repo-preview__lang");

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`);
    if (!res.ok) return;
    const data = await res.json();
    if (descEl && data.description) descEl.textContent = data.description;
    if (statsEl) {
      if (starsEl) starsEl.textContent = `★ ${formatCount(data.stargazers_count ?? 0)}`;
      if (langEl) langEl.textContent = data.language || "";
      statsEl.hidden = false;
    }
  } catch (err) {
    // Offline or rate-limited: the static fallback text already in the
    // markup ("Ver repositorio en GitHub") stays as-is.
  }
}

export function initRepoPreviews() {
  const previews = document.querySelectorAll(".repo-preview[data-repo]");
  previews.forEach(fillPreview);
}

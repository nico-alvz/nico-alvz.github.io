import { t } from "./i18n.js";

const STARTER_CODE = `// Pinout: D2 Amarillo · D3 Azul · D4 Verde · D5 Rojo
// Direct port manipulation: D2–D5 son los bits 2–5 de PORTD
void setup() {
  DDRD |= (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5); // D2-D5 como OUTPUT

  attachInterrupt(2, toggleAmarillo, FALLING);
  attachInterrupt(3, toggleAzul, FALLING);
  attachInterrupt(4, toggleVerde, FALLING);
  attachInterrupt(5, toggleRojo, FALLING);
}

void toggleAmarillo() { PORTD ^= (1 << 2); }
void toggleAzul()     { PORTD ^= (1 << 3); }
void toggleVerde()    { PORTD ^= (1 << 4); }
void toggleRojo()     { PORTD ^= (1 << 5); }
`;

const FUNCTIONS = new Set([
  "setup",
  "loop",
  "pinMode",
  "digitalWrite",
  "digitalRead",
  "attachInterrupt",
  "delay",
  "DDRD",
  "PORTD",
]);
const CONSTANTS = new Set(["HIGH", "LOW", "OUTPUT", "INPUT", "INPUT_PULLUP", "RISING", "FALLING", "CHANGE"]);
const TOKEN_RE = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(\b\d+\b)|([A-Za-z_]\w*)|([{}()[\];,.!])/g;

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(code) {
  let out = "";
  let lastIndex = 0;
  TOKEN_RE.lastIndex = 0;
  let match;
  while ((match = TOKEN_RE.exec(code))) {
    if (match.index > lastIndex) out += escapeHtml(code.slice(lastIndex, match.index));
    const [full, comment1, comment2, number, word, punct] = match;
    if (comment1 || comment2) {
      out += `<span class="tok-comment">${escapeHtml(full)}</span>`;
    } else if (number) {
      out += `<span class="tok-number">${escapeHtml(full)}</span>`;
    } else if (word) {
      if (word === "void") out += `<span class="tok-type">${word}</span>`;
      else if (CONSTANTS.has(word)) out += `<span class="tok-constant">${word}</span>`;
      else if (FUNCTIONS.has(word)) out += `<span class="tok-function">${word}</span>`;
      else out += `<span class="tok-ident">${word}</span>`;
    } else if (punct) {
      out += `<span class="tok-punct">${escapeHtml(full)}</span>`;
    }
    lastIndex = TOKEN_RE.lastIndex;
  }
  out += escapeHtml(code.slice(lastIndex));
  return out + "\n";
}

export function initMiniIDE(sceneApi) {
  const editor = document.getElementById("ide-editor");
  const highlightEl = document.getElementById("ide-highlight");
  const highlightCode = highlightEl?.querySelector("code");
  const consoleEl = document.getElementById("ide-console");
  const verifyBtn = document.getElementById("ide-verify");
  const uploadBtn = document.getElementById("ide-upload");
  if (!editor || !consoleEl || !verifyBtn || !uploadBtn) return;

  function syncHighlight() {
    if (highlightCode) highlightCode.innerHTML = highlight(editor.value);
    if (highlightEl) {
      highlightEl.scrollTop = editor.scrollTop;
      highlightEl.scrollLeft = editor.scrollLeft;
    }
  }

  editor.value = STARTER_CODE;
  syncHighlight();

  editor.addEventListener("input", syncHighlight);
  editor.addEventListener("scroll", syncHighlight);

  editor.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const { selectionStart, selectionEnd, value } = editor;
    editor.value = value.slice(0, selectionStart) + "  " + value.slice(selectionEnd);
    editor.selectionStart = editor.selectionEnd = selectionStart + 2;
    syncHighlight();
  });

  function renderResult(result, successMessage) {
    consoleEl.innerHTML = "";
    if (result.ok) {
      const line = document.createElement("span");
      line.className = "mini-ide__console-ok";
      line.textContent = `✓ ${successMessage}`;
      consoleEl.appendChild(line);
      return;
    }
    result.errors.forEach((err) => {
      const line = document.createElement("span");
      line.className = "mini-ide__console-error";
      line.textContent = `${t("ide.lineLabel")} ${err.line}: ${err.message}`;
      consoleEl.appendChild(line);
    });
  }

  verifyBtn.addEventListener("click", () => {
    const result = sceneApi.verify(editor.value);
    renderResult(result, t("ide.okVerify"));
  });

  uploadBtn.addEventListener("click", () => {
    const result = sceneApi.upload(editor.value);
    renderResult(result, t("ide.okUpload"));
  });
}

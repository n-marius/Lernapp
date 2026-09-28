// Kleine gemeinsame Helfer (Vorbild: ukr-app js/tokens.js), hier auf das
// Nötige reduziert: HTML-Escaping und Fisher-Yates-Mischen für die
// Antwortreihenfolge im Frage-Antwort-Modus.

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// ---------- Prio-Symbol (antippbar, siehe SPEC.md Abschnitt 5.1a) ----------

export const PRIO_LABEL = { hoch: "Hohe Priorität", normal: "Normale Priorität", niedrig: "Niedrige Priorität" };

export const PRIO_SHORT = { hoch: "Hoch", normal: "Normal", niedrig: "Niedrig" };

// Drei aufsteigende Balken (wie eine Signalanzeige): hoch = alle drei gefüllt,
// normal = zwei, niedrig = einer. Nicht gefüllte Balken bleiben blass sichtbar,
// damit die Stufe auch ohne Farbe lesbar ist.
const PRIO_BARS = { hoch: 3, normal: 2, niedrig: 1 };

export function prioIcon(prio) {
  const n = PRIO_BARS[prio] ?? PRIO_BARS.normal;
  const bars = [4.5, 7.5, 10.5].map((h, i) =>
    `<rect x="${1 + i * 4}" y="${12 - h}" width="2.6" height="${h}" rx="1.1" fill="currentColor"${i < n ? "" : ` opacity="0.22"`}/>`
  ).join("");
  return `<svg class="prio-bars" viewBox="0 0 12.6 12.5" aria-hidden="true">${bars}</svg>`;
}

function prioChipInner(prio) {
  return `${prioIcon(prio)}<span>${PRIO_SHORT[prio] ?? PRIO_SHORT.normal}</span>`;
}

export function prioChip(prio) {
  const label = PRIO_LABEL[prio] ?? PRIO_LABEL.normal;
  return `<button type="button" class="prio-btn" data-prio="${prio}" aria-label="${label} – antippen zum Ändern">${prioChipInner(prio)}</button>`;
}

export function updatePrioChip(btn, prio) {
  const label = PRIO_LABEL[prio] ?? PRIO_LABEL.normal;
  btn.dataset.prio = prio;
  btn.setAttribute("aria-label", `${label} – antippen zum Ändern`);
  btn.innerHTML = prioChipInner(prio);
}

// Filter-Knopf oberhalb der Rechtsgebietswahl (gleiches Symbol, gleiche Farben).
export function prioToggle(prio, active) {
  const label = PRIO_LABEL[prio] ?? PRIO_LABEL.normal;
  return `<button type="button" class="prio-toggle-btn" data-prio="${prio}" data-active="${active}" aria-pressed="${active}" aria-label="${label}${active ? "" : " (ausgeblendet)"}">${prioChipInner(prio)}</button>`;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

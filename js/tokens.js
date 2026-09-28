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

const PRIO_ICON = {
  hoch: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.2l5.6 8.1H6.4z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
  normal: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12h10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>`,
  niedrig: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16.8l-5.6-8.1h11.2z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
};

export function prioIcon(prio) {
  return PRIO_ICON[prio] ?? PRIO_ICON.normal;
}

export function prioChip(prio) {
  const label = PRIO_LABEL[prio] ?? PRIO_LABEL.normal;
  return `<button type="button" class="prio-btn" data-prio="${prio}" aria-label="${label} – antippen zum Ändern">${prioIcon(prio)}</button>`;
}

export function updatePrioChip(btn, prio) {
  const label = PRIO_LABEL[prio] ?? PRIO_LABEL.normal;
  btn.dataset.prio = prio;
  btn.setAttribute("aria-label", `${label} – antippen zum Ändern`);
  btn.innerHTML = prioIcon(prio);
}

// Filter-Knopf oberhalb der Rechtsgebietswahl (gleiches Symbol, gleiche Farben).
export function prioToggle(prio, active) {
  const label = PRIO_LABEL[prio] ?? PRIO_LABEL.normal;
  return `<button type="button" class="prio-toggle-btn" data-prio="${prio}" data-active="${active}" aria-pressed="${active}" aria-label="${label}${active ? "" : " (ausgeblendet)"}">${prioIcon(prio)}</button>`;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

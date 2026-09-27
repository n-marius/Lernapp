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

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

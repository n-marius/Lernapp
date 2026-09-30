// Routing und Bildschirme. Vorbild: ukr-app js/app.js (gleicher Rahmen aus
// Kopfleiste/Seite/Dock, gleiche Hilfsfunktionen für Dialog und Hinweis).
import { renderFlashcard, buildQueue, countByStufe, countDueStufe5, countByGebiet, pickWeightedCard, filterByPrio } from "./cards.js";
import { renderQuizCard, renderQuizCardReview } from "./quiz.js";
import { renderTermCard, renderTermCardReview, isTermCard } from "./begriffe.js";
import { renderStats, countToday } from "./stats.js";
import {
  USERS,
  GEBIETE,
  STUFEN,
  PRIOS,
  getSetting,
  setSetting,
  getCurrentUser,
  setCurrentUser,
  getAllUserCards,
  addUserCard,
  getAllLevels,
  setLevel,
  getAllPrios,
  setPrio,
  effectivePrio,
  getAllEvents,
  addEvent,
  cardKey,
  applyOverridesAndFilter,
  overlayCardById,
  getOpenFlags,
  addFlag,
  resolveOpenFlagsForCard,
  setCardEdit,
} from "./store.js";
import { getSyncConfig, setSyncConfig, sync, resetStatsForUser, resetLevelsForUser } from "./sync.js";
import { escapeHtml, prioToggle } from "./tokens.js";

const GEBIET_NAMEN = {
  zivilgericht: "Zivilgericht",
  strafrecht: "Strafrecht",
  rechtsanwalt: "Rechtsanwalt",
  verwaltungsrecht: "Verwaltungsrecht",
};
const USER_NAMEN = { marius: "Marius", agnessa: "Agnessa" };

const SPRUECHE = [
  "Sauber. Weiter so.",
  "Das sitzt.",
  "Nächster Fall.",
  "Klar erkannt.",
  "Gut subsumiert.",
  "Weiter im Text.",
  "Stark.",
  "Das Examen wird das merken.",
  "Sattelfest.",
  "Nächste Norm.",
];

const svg = (d, extra = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  back: svg(`<path d="M15 5l-7 7 7 7"/>`),
  clock: svg(`<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`, `class="row-clock"`),
  chevron: svg(`<path d="M9 5l7 7-7 7"/>`, `class="row-chev"`),
  stats: svg(`<path d="M5 20V11M12 20V4M19 20v-6"/>`),
  settings: svg(`<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>`),
  arrow: svg(`<path d="M5 12h14M13 6l6 6-6 6"/>`, `class="mode-go"`),
  cards: svg(`<rect x="6.5" y="7" width="14" height="10" rx="1.5"/><path d="M3.5 5v10a1.5 1.5 0 0 0 1.5 1.5"/><path d="M10.5 12h6M10.5 14.5h4"/>`),
  quiz: svg(`<circle cx="12" cy="12" r="9"/><path d="M9.2 9.5a2.8 2.8 0 1 1 3.6 2.7c-.8.3-1.1.8-1.1 1.5"/><circle cx="12" cy="16.6" r="0.4" fill="currentColor"/>`),
  plus: svg(`<path d="M12 5v14M5 12h14"/>`),
  exit: svg(`<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M14 16l4-4-4-4M18 12H8"/>`),
  flag: svg(`<path d="M6 21V4"/><path d="M6 4.5c1.4-1 3-1 4.5 0s3.1 1 4.5 0v9c-1.4 1-3 1-4.5 0s-3.1-1-4.5 0"/>`),
  hand: svg(`<path d="M6 4h6M6 8h9M6 12h7"/><circle cx="18" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="16" r="4"/>`),
  auto: svg(`<path d="M12 4v3M12 17v3M4 12h3M17 12h3"/><circle cx="12" cy="12" r="4.5"/>`),
  download: svg(`<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>`),
  up: svg(`<path d="M7 12l5-5 5 5M7 17.5l5-5 5 5"/>`),
};

// Untere Leiste der Lernmodi. „Falsch“ und „Richtig“ teilen sich die Breite
// je zur Hälfte; der „Direkt in Stufe 4“-Knopf nimmt seinen Platz nur von
// „Richtig“ bzw. „Weiter“, die Trennung Falsch/Richtig bleibt in der Mitte.
// `dock-review` (anfangs ausgeblendet) zeigt beim Zurückschauen auf die
// letzte Karte nur einen einzelnen „Weiter“-Knopf, siehe showFlashcardMode
// & Co. – die eigentlichen Bewertungsknöpfe bleiben dabei unangetastet im
// DOM (nur versteckt), damit ihre Klick-Verdrahtung erhalten bleibt.
const FAST_BTN = `<button type="button" class="btn btn-fasttrack" id="fasttrack" disabled aria-label="Direkt in Stufe 4 (schon sicher gekonnt)" title="Direkt in Stufe 4">${ICON.up}</button>`;
const REVIEW_ROW = `<div class="dock-row" id="dock-review" hidden><button type="button" class="btn btn-primary btn-fill" id="review-next">Weiter</button></div>`;
const DOCK_CARDS = `
  <div class="dock-col">
    <div class="dock-row dock-row-split" id="dock-normal">
      <button type="button" class="btn btn-wrong" id="wrong" disabled>Falsch</button>
      <div class="dock-pair">
        <button type="button" class="btn btn-correct btn-fill" id="richtig" disabled>Richtig</button>
        ${FAST_BTN}
      </div>
    </div>
    ${REVIEW_ROW}
    <span class="dock-progress" id="progress"></span>
  </div>`;
const DOCK_QUIZ = `
  <div class="dock-col">
    <div class="dock-row" id="dock-normal">
      <button type="button" class="btn btn-primary btn-fill" id="next" disabled>Weiter</button>
      ${FAST_BTN}
    </div>
    ${REVIEW_ROW}
    <span class="dock-progress" id="progress"></span>
  </div>`;

const root = document.getElementById("app");
let allContentCards = [];
let currentUser = null;
let current = null;

// Nur für Agnessa: Serien-Zähler innerhalb des aktuellen Durchgangs (Modus).
let sessionStreak = 0;
let streakMilestonesShown = 0; // wie viele Meilensteine dieser Durchgang schon gezeigt hat

// ---------- Rahmen ----------

function render(name, { left = "", mid = "", right = "", body = "", dock = "" }) {
  current = name;
  root.innerHTML = `
    <header class="bar"><div class="bar-inner">
      <div class="bar-side">${left}</div>
      ${mid ? `<div class="bar-mid">${mid}</div>` : ""}
      <div class="bar-side">${right}</div>
    </div></header>
    <main class="screen${dock ? " has-dock" : ""}">${body}</main>
    ${dock ? `<footer class="dock"><div class="dock-inner">${dock}</div></footer>` : ""}`;
  window.scrollTo(0, 0);
  updateBarBorder();
  return root;
}

function updateBarBorder() {
  root.querySelector(".bar")?.classList.toggle("is-scrolled", window.scrollY > 4);
}
window.addEventListener("scroll", updateBarBorder, { passive: true });

// Zähler unten links: heute bearbeitete Karten (ganzer Kalendertag, alle Modi, wie in der Statistik).
async function updateProgress(el) {
  const n = countToday(await getAllEvents(currentUser));
  el.textContent = `${n} heute bearbeitet`;
}

// Frage-Antwort-Anzeige: Vierer-Auswahl oder Begriffe-Format (SPEC.md 5.7).
function renderAnswerCard(stage, card, opts) {
  return (isTermCard(card) ? renderTermCard : renderQuizCard)(stage, card, opts);
}
function renderAnswerReview(stage, card, last, opts) {
  if (isTermCard(card)) return renderTermCardReview(stage, card, { ...opts, result: last.result });
  return renderQuizCardReview(stage, card, { ...opts, chosenIndex: last.chosenIndex, order: last.order });
}

const $ = (sel) => root.querySelector(sel);
const on = (sel, ev, fn) => $(sel)?.addEventListener(ev, fn);
const backButton = (label = "Zurück") => `<button class="icon-btn" id="back" aria-label="${label}">${ICON.back}</button>`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Basis-Kartenbestand ohne Korrekturen/Filterung (Grundbestand + selbst
// angelegte Karten). Für die normale Anzeige/Zählung immer `allCards()`
// verwenden; `allBaseCards()` wird nur für den Modus „Flaggs beheben"
// gebraucht, der auch offen gemeldete Karten sehen muss.
async function allBaseCards() {
  const userCards = await getAllUserCards();
  return allContentCards.concat(userCards);
}

// Wie `allBaseCards()`, aber mit angewendeten Korrekturen (cardEdits) und
// ohne gelöschte oder offen gemeldete Karten – die Grundlage für alle
// Kartenlisten in Karteikarten- und Frage-Antwort-Modus sowie die
// Rechtsgebiets-/Stufenzählung (siehe store.applyOverridesAndFilter).
async function allCards() {
  return applyOverridesAndFilter(await allBaseCards());
}

async function levelsMap(user) {
  const levels = await getAllLevels(user);
  return new Map(levels.map((l) => [l.cardId, l]));
}

// Für Agnessa gelten Mariuss manuell gewählte Prios als Vorgabe, solange sie
// selbst für die Karte nie manuell gewählt hat (eigene Wahl gewinnt immer,
// egal ob vorher oder nachher). Umgekehrt wird nichts übertragen.
async function priosMap(user) {
  const own = await getAllPrios(user);
  const map = new Map();
  if (user === "agnessa") for (const p of await getAllPrios("marius")) map.set(p.cardId, p);
  for (const p of own) map.set(p.cardId, p);
  return map;
}

// Speichert eine per Antippen geänderte Prio für den aktuellen Nutzer, aktualisiert
// die im Durchgang bereits geladene Map (damit die Automatik sie sofort berücksichtigt)
// und synchronisiert. Die Änderung gilt ausdrücklich nur für diesen Nutzer.
async function changePrio(prios, card, prio) {
  const ts = new Date().toISOString();
  await setPrio(currentUser, cardKey(card), prio, ts);
  prios.set(cardKey(card), { cardId: cardKey(card), prio, ts });
  sync();
}

// ---------- Nutzerwahl ----------

async function showUserPick() {
  render("user-pick", {
    body: `
      <header class="page-head">
        <p class="kicker">Karteikarten</p>
        <h1 class="page-title">Wer lernt gerade?</h1>
        <p class="page-sub">Der Kartenbestand ist gemeinsam, der Lernfortschritt bleibt getrennt.</p>
      </header>
      <div class="users">
        <button class="user-card" data-user="marius">
          <span class="user-name">Marius</span>
        </button>
        <button class="user-card" data-user="agnessa">
          <span class="user-name">Agnessa</span>
        </button>
      </div>`,
  });
  root.querySelectorAll("[data-user]").forEach((b) =>
    b.addEventListener("click", async () => {
      currentUser = b.dataset.user;
      await setCurrentUser(currentUser);
      showModes();
    })
  );
}

// ---------- Moduswahl ----------

async function showModes() {
  const cards = await allCards();
  const total = cards.length;
  const openFlags = currentUser === "marius" ? await getValidOpenFlags() : [];

  render("modes", {
    left: `<span class="user-chip" data-user="${currentUser}"><span class="user-dot-sm"></span>${USER_NAMEN[currentUser]}</span>`,
    right: `
      <button class="icon-btn" id="to-stats" aria-label="Statistik">${ICON.stats}</button>
      <button class="icon-btn" id="to-settings" aria-label="Einstellungen">${ICON.settings}</button>`,
    body: `
      <header class="page-head">
        <p class="kicker">Staatsexamen</p>
        <h1 class="page-title">Was möchtest du üben?</h1>
      </header>
      <div class="modes">
        <button class="mode" id="mode-cards" ${total ? "" : "disabled"}>
          <span class="mode-icon">${ICON.cards}</span>
          ${total ? ICON.arrow : `<span class="badge">Noch keine Karten</span>`}
          <span class="mode-title">Karteikarten</span>
          <span class="mode-text">${total ? `${plural(total, "Karte", "Karten")} insgesamt` : "Frage, Antwort und Erklärung"}</span>
        </button>
        <button class="mode" id="mode-quiz" ${total ? "" : "disabled"}>
          <span class="mode-icon">${ICON.quiz}</span>
          ${total ? ICON.arrow : `<span class="badge">Noch keine Karten</span>`}
          <span class="mode-title">Frage-Antwort</span>
          <span class="mode-text">${total ? "Vier Antworten, eine richtig" : "Vier Antworten, eine richtig"}</span>
        </button>
        <button class="mode" id="mode-create">
          <span class="mode-icon">${ICON.plus}</span>
          ${ICON.arrow}
          <span class="mode-title">Karten anlegen</span>
          <span class="mode-text">Eigene Karten ergänzen</span>
        </button>
        ${currentUser === "marius" ? `
        <button class="mode" id="mode-flags">
          <span class="mode-icon">${ICON.flag}</span>
          ${ICON.arrow}
          <span class="mode-title">Flaggs beheben</span>
          <span class="mode-text">${openFlags.length === 0 ? "Keine offenen Meldungen" : plural(openFlags.length, "offene Meldung", "offene Meldungen")}</span>
        </button>` : ""}
      </div>`,
  });

  on("#to-stats", "click", showStats);
  on("#to-settings", "click", showSettings);
  on("#mode-cards", "click", () => showAutoManualPick("cards"));
  on("#mode-quiz", "click", () => showAutoManualPick("quiz"));
  on("#mode-create", "click", () => showGebietPick("create"));
  on("#mode-flags", "click", () => showFlagReview());
}

// ---------- Manuell oder Automatisch ----------

async function showAutoManualPick(mode) {
  render("auto-manual", {
    left: backButton(),
    body: `
      <header class="page-head">
        <p class="kicker">${modeLabel(mode)}</p>
        <h1 class="page-title">Wie möchtest du üben?</h1>
      </header>
      <div class="modes">
        <button class="mode" id="pick-manuell">
          <span class="mode-icon">${ICON.hand}</span>
          ${ICON.arrow}
          <span class="mode-title">Manuell</span>
          <span class="mode-text">Rechtsgebiet und Stufe selbst wählen</span>
        </button>
        <button class="mode" id="pick-automatisch">
          <span class="mode-icon">${ICON.auto}</span>
          ${ICON.arrow}
          <span class="mode-title">Automatisch</span>
          <span class="mode-text">Karten eines Rechtsgebiets in sinnvoller Reihenfolge</span>
        </button>
      </div>`,
  });

  on("#back", "click", showModes);
  on("#pick-manuell", "click", () => showGebietPick(mode));
  on("#pick-automatisch", "click", () => showGebietPick(`${mode}-auto`));
}

// ---------- Rechtsgebiet ----------

function isAutoMode(mode) { return mode.endsWith("-auto"); }
function baseMode(mode) { return mode.replace("-auto", ""); }

async function showGebietPick(mode, allowedPrios = new Set(PRIOS)) {
  const showPrioFilter = mode !== "create";
  const baseCards = await allCards();
  const prios = showPrioFilter ? await priosMap(currentUser) : null;
  const cards = showPrioFilter ? filterByPrio(baseCards, prios, allowedPrios) : baseCards;
  const counts = countByGebiet(cards);
  const title = mode === "create" ? "Für welches Rechtsgebiet?" : "Rechtsgebiet wählen";

  const rows = GEBIETE.map((g) => {
    const n = counts[g] ?? 0;
    const available = mode === "create" || n > 0;
    return `
      <button class="row" data-gebiet="${g}" ${available ? "" : "disabled"}>
        <span class="row-main">
          <span class="row-title">${GEBIET_NAMEN[g]}</span>
          <span class="row-sub">${available ? `${plural(n, "Karte", "Karten")}` : "Noch keine Karten"}</span>
        </span>
        ${available ? ICON.chevron : ""}
      </button>`;
  }).join("");

  const prioFilterHtml = showPrioFilter
    ? `<div class="prio-toggle" role="group" aria-label="Prio-Filter">
        ${PRIOS.map((p) => prioToggle(p, allowedPrios.has(p))).join("")}
      </div>`
    : "";

  render("gebiet", {
    left: backButton(),
    body: `
      <header class="page-head">
        <p class="kicker">${modeLabel(mode)}${isAutoMode(mode) ? " · Automatisch" : ""}</p>
        <h1 class="page-title">${title}</h1>
      </header>
      ${prioFilterHtml}
      <div class="group">${rows}</div>`,
  });

  on("#back", "click", () => (mode === "create" ? showModes() : showAutoManualPick(baseMode(mode))));

  if (showPrioFilter) {
    root.querySelectorAll(".prio-toggle-btn").forEach((b) =>
      b.addEventListener("click", () => {
        const p = b.dataset.prio;
        const next = new Set(allowedPrios);
        if (next.has(p)) { if (next.size > 1) next.delete(p); }
        else next.add(p);
        showGebietPick(mode, next);
      })
    );
  }

  root.querySelectorAll("[data-gebiet]:not(:disabled)").forEach((b) =>
    b.addEventListener("click", () => {
      if (mode === "create") showCreate(b.dataset.gebiet);
      else if (isAutoMode(mode)) showAutoMode(baseMode(mode), b.dataset.gebiet, allowedPrios);
      else showStufePick(mode, b.dataset.gebiet, allowedPrios);
    })
  );
}

function modeLabel(mode) {
  if (mode === "cards") return "Karteikarten";
  if (mode === "quiz") return "Frage-Antwort";
  return "Karten anlegen";
}

// ---------- Stufe ----------

async function showStufePick(mode, gebiet, allowedPrios = new Set(PRIOS)) {
  const baseCards = await allCards();
  const prios = await priosMap(currentUser);
  const cards = filterByPrio(baseCards, prios, allowedPrios);
  const levels = await levelsMap(currentUser);
  const counts = countByStufe(cards, gebiet, levels);
  const due5 = countDueStufe5(cards, gebiet, levels);

  const rows = STUFEN.map((stufe) => {
    const n = counts[stufe] ?? 0;
    const available = n > 0;
    return `
      <button class="row" data-stufe="${stufe}" ${available ? "" : "disabled"}>
        <span class="row-lead">${stufe}</span>
        <span class="row-main">
          <span class="row-title">Stufe ${stufe}</span>
          <span class="row-sub">${available ? plural(n, "Karte", "Karten") : "Noch keine Karten"}${stufe === 5 && due5 > 0 ? `<span class="row-due" title="Seit über 2 Monaten nicht bearbeitet">(<span class="row-due-in">${ICON.clock}${plural(due5, "Karte", "Karten")}</span>)</span>` : ""}</span>
        </span>
        ${available ? ICON.chevron : ""}
      </button>`;
  }).join("");

  render("stufe", {
    left: backButton(),
    body: `
      <header class="page-head">
        <p class="kicker">${modeLabel(mode)} · ${GEBIET_NAMEN[gebiet]}</p>
        <h1 class="page-title">Stufe wählen</h1>
        <p class="page-sub">Neue Karten stehen in Stufe 1. Richtig beantwortet wandern sie eine Stufe höher, falsch beantwortet zurück auf Stufe 1.</p>
      </header>
      <div class="group">${rows}</div>`,
  });

  on("#back", "click", () => showGebietPick(mode));
  root.querySelectorAll("[data-stufe]:not(:disabled)").forEach((b) =>
    b.addEventListener("click", () => {
      const stufe = Number(b.dataset.stufe);
      if (mode === "cards") showFlashcardMode(gebiet, stufe, allowedPrios);
      else showQuizMode(gebiet, stufe, allowedPrios);
    })
  );
}

// ---------- Bewertung einer Karte (gemeinsam für beide Lernmodi) ----------

// `forceStufe` überspringt die normale +1-Logik (Knopf „Direkt in Stufe 4“
// für Karten, die man schon sicher kann – zählt wie eine richtige Antwort).
async function answerCard(mode, card, correct, forceStufe) {
  const now = new Date().toISOString();
  const newStufe = forceStufe ?? (correct ? Math.min(5, (await currentStufeOf(card)) + 1) : 1);
  await setLevel(currentUser, cardKey(card), newStufe, now);

  const todayBefore = countToday(await getAllEvents(currentUser));
  await addEvent({ id: crypto.randomUUID(), user: currentUser, ts: now, cardId: cardKey(card), correct, mode });
  sync();

  if (currentUser === "agnessa") {
    if (correct) {
      sessionStreak++;
      if (shouldTriggerStreak(sessionStreak)) showMotivOverlay();
    } else {
      sessionStreak = 0;
    }
    const todayAfter = todayBefore + 1;
    if (Math.floor(todayBefore / 50) < Math.floor(todayAfter / 50)) showMotivOverlay();
  }
}

function shouldTriggerStreak(streak) {
  if (streak === 5 || streak === 15) return true;
  return streak > 15 && (streak - 15) % 25 === 0;
}

async function currentStufeOf(card) {
  const levels = await levelsMap(currentUser);
  return levels.get(cardKey(card))?.stufe ?? 1;
}

function showMotivOverlay() {
  document.querySelector(".motiv")?.remove();
  const text = SPRUECHE[Math.floor(Math.random() * SPRUECHE.length)];
  const el = document.createElement("div");
  el.className = "motiv";
  el.innerHTML = `<div class="motiv-card"><p class="motiv-count">Weiter so</p><p class="motiv-text">${escapeHtml(text)}</p></div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener("click", close);
  setTimeout(close, 1800);
}

// ---------- Karte melden (Flag-Dialog, beide Lernmodi) ----------

// Zeigt den Melde-Dialog für `card`. Löst mit `true`, wenn tatsächlich eine
// Meldung abgeschickt wurde (die Karte soll dann aus der laufenden
// Warteschlange verschwinden), sonst mit `false` (Abbrechen).
function flagDialog(card) {
  return new Promise((resolve) => {
    let field = "frage";
    const el = document.createElement("div");
    el.className = "backdrop";
    el.innerHTML = `
      <div class="dialog" role="alertdialog" aria-modal="true">
        <h3>Karte melden</h3>
        <p>Was ist an dieser Karte falsch oder unklar?</p>
        <div class="seg" id="flag-seg">
          <button type="button" data-field="frage" class="is-active">Frage</button>
          <button type="button" data-field="antwort">Antwort</button>
        </div>
        <label class="field-box" style="margin-top:14px">
          <span class="field-box-label">Kurze Beschreibung</span>
          <textarea id="flag-note" rows="3" placeholder="Was genau ist falsch oder unklar?"></textarea>
        </label>
        <div class="dialog-actions" style="margin-top:18px">
          <button class="btn btn-secondary" data-answer="cancel">Abbrechen</button>
          <button class="btn btn-primary" id="flag-submit" disabled>Absenden</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    const segButtons = [...el.querySelectorAll("#flag-seg button")];
    for (const b of segButtons) {
      b.addEventListener("click", () => {
        field = b.dataset.field;
        for (const x of segButtons) x.classList.toggle("is-active", x === b);
      });
    }

    const note = el.querySelector("#flag-note");
    const submit = el.querySelector("#flag-submit");
    note.addEventListener("input", () => { submit.disabled = note.value.trim().length === 0; });

    const close = (result) => { el.remove(); resolve(result); };
    el.addEventListener("click", (e) => { if (e.target === el) close(false); });
    el.querySelector('[data-answer="cancel"]').addEventListener("click", () => close(false));
    submit.addEventListener("click", async () => {
      if (submit.disabled) return;
      submit.disabled = true;
      await addFlag({
        id: crypto.randomUUID(),
        cardId: cardKey(card),
        field,
        note: note.value.trim(),
        flaggedBy: currentUser,
        ts: new Date().toISOString(),
        status: "open",
      });
      sync();
      toast("Danke, gemeldet.");
      close(true);
    });
    note.focus();
  });
}

// ---------- Karteikarten-Modus ----------

async function showFlashcardMode(gebiet, stufe, allowedPrios = new Set(PRIOS)) {
  sessionStreak = 0;
  await sync();

  const baseCards = await allCards();
  const levels = await levelsMap(currentUser);
  const prios = await priosMap(currentUser);
  const cards = filterByPrio(baseCards, prios, allowedPrios);
  const queue = buildQueue(cards, gebiet, stufe, levels);

  render("flashcards", {
    left: backButton("Modus verlassen"),
    mid: `<button class="pill-btn" id="prev-btn" disabled>Zurück</button>`,
    right: `<button class="icon-btn" id="flag-btn" aria-label="Karte melden">${ICON.flag}</button><span class="bar-crumb"><b>Stufe ${stufe}</b> · ${GEBIET_NAMEN[gebiet]}</span>`,
    body: `<div id="stage"></div>`,
    dock: DOCK_CARDS,
  });

  on("#back", "click", async () => { await sync(); showStufePick("cards", gebiet, allowedPrios); });

  let i = 0;
  let currentCard = null;
  let lastAnswered = null; // { card } – letzte tatsächlich bewertete Karte, für „Zurück"
  let reviewing = false;
  let skipCurrent = null;
  const stage = $("#stage");
  const progress = $("#progress");
  const dockNormal = $("#dock-normal");
  const dockReview = $("#dock-review");
  const reviewNextBtn = $("#review-next");
  const prevBtn = $("#prev-btn");
  const wrongBtn = $("#wrong");
  const richtigBtn = $("#richtig");
  const fastBtn = $("#fasttrack");

  // Zeigt `card` unbeantwortet an und wartet auf Falsch/Richtig/Stufe-4 – die
  // eigentliche Klick-Verdrahtung der Knöpfe liegt unten (einmalig), diese
  // Funktion setzt nur den Anzeigezustand zurück (auch nach einer Rückschau).
  function armCard(card) {
    wrongBtn.disabled = true;
    richtigBtn.disabled = true;
    fastBtn.disabled = true;
    renderFlashcard(stage, card, {
      onRevealed: () => { wrongBtn.disabled = false; richtigBtn.disabled = false; fastBtn.disabled = false; },
      prio: effectivePrio(card, prios),
      onPrioChange: (prio) => changePrio(prios, card, prio),
    });
  }

  function showEmptyState() {
    stage.innerHTML = `
      <div class="empty">
        <p class="empty-title">Stufe abgeschlossen</p>
        <p class="empty-sub">Alle Karten dieser Stufe sind für diesen Durchgang bearbeitet.</p>
      </div>`;
    dockNormal.hidden = true;
  }

  on("#flag-btn", "click", () => {
    const target = reviewing ? lastAnswered?.card : currentCard;
    if (!target) return;
    flagDialog(target).then((flagged) => { if (flagged && !reviewing) skipCurrent?.(); });
  });

  prevBtn.addEventListener("click", () => {
    if (!lastAnswered || reviewing) return;
    reviewing = true;
    dockNormal.hidden = true;
    dockReview.hidden = false;
    renderFlashcard(stage, lastAnswered.card, {
      revealed: true,
      prio: effectivePrio(lastAnswered.card, prios),
      onPrioChange: (prio) => changePrio(prios, lastAnswered.card, prio),
    });
  });

  reviewNextBtn.addEventListener("click", () => {
    reviewing = false;
    dockReview.hidden = true;
    if (currentCard) { dockNormal.hidden = false; armCard(currentCard); }
    else showEmptyState();
  });

  let resolveStep = null;
  wrongBtn.onclick = () => { if (!wrongBtn.disabled && resolveStep) resolveStep({ correct: false }); };
  richtigBtn.onclick = () => { if (!richtigBtn.disabled && resolveStep) resolveStep({ correct: true }); };
  fastBtn.onclick = () => { if (!fastBtn.disabled && resolveStep) resolveStep({ fastTrack: true }); };

  async function step() {
    if (i >= queue.length) {
      currentCard = null;
      showEmptyState();
      await updateProgress(progress);
      await sync();
      return;
    }
    dockNormal.hidden = false;
    await updateProgress(progress);
    const card = queue[i];
    currentCard = card;
    armCard(card);
    const result = await new Promise((resolve) => {
      skipCurrent = () => resolve({ flagged: true });
      resolveStep = resolve;
    });
    resolveStep = null;
    i++;
    if (result.flagged) { step(); return; }
    lastAnswered = { card };
    prevBtn.disabled = false;
    if (result.fastTrack) { await answerCard("cards", card, true, 4); step(); return; }
    await answerCard("cards", card, result.correct);
    step();
  }
  step();
}

// ---------- Frage-Antwort-Modus ----------

async function showQuizMode(gebiet, stufe, allowedPrios = new Set(PRIOS)) {
  sessionStreak = 0;
  await sync();

  const baseCards = await allCards();
  const levels = await levelsMap(currentUser);
  const prios = await priosMap(currentUser);
  const cards = filterByPrio(baseCards, prios, allowedPrios);
  const queue = buildQueue(cards, gebiet, stufe, levels);

  render("quiz-mode", {
    left: backButton("Modus verlassen"),
    mid: `<button class="pill-btn" id="prev-btn" disabled>Zurück</button>`,
    right: `<button class="icon-btn" id="flag-btn" aria-label="Karte melden">${ICON.flag}</button><span class="bar-crumb"><b>Stufe ${stufe}</b> · ${GEBIET_NAMEN[gebiet]}</span>`,
    body: `<div id="stage"></div>`,
    dock: DOCK_QUIZ,
  });

  on("#back", "click", async () => { await sync(); showStufePick("quiz", gebiet, allowedPrios); });

  let i = 0;
  let currentCard = null;
  let lastAnswered = null; // { card, chosenIndex, order } – für „Zurück"
  let reviewing = false;
  let skipCurrent = null;
  let outcome = null;
  let quizController = null;
  const stage = $("#stage");
  const progress = $("#progress");
  const dockNormal = $("#dock-normal");
  const dockReview = $("#dock-review");
  const reviewNextBtn = $("#review-next");
  const prevBtn = $("#prev-btn");
  const nextBtn = $("#next");
  const fastBtn = $("#fasttrack");

  // Zeigt `card` unbeantwortet an. „Weiter" heißt anfangs „Auflösen" und ist
  // von Anfang an anklickbar (siehe nextBtn.onclick) – erst nach einer Wahl
  // (oder dem Auflösen) wird daraus wieder „Weiter" zum eigentlichen Fortfahren.
  function armCard(card) {
    outcome = null;
    nextBtn.disabled = false;
    nextBtn.textContent = "Auflösen";
    fastBtn.disabled = true;
    quizController = renderAnswerCard(stage, card, {
      onAnswered: (result) => {
        outcome = result;
        nextBtn.textContent = "Weiter";
        fastBtn.disabled = !result.correct;
      },
      prio: effectivePrio(card, prios),
      onPrioChange: (prio) => changePrio(prios, card, prio),
    });
  }

  function showEmptyState() {
    stage.innerHTML = `
      <div class="empty">
        <p class="empty-title">Stufe abgeschlossen</p>
        <p class="empty-sub">Alle Karten dieser Stufe sind für diesen Durchgang bearbeitet.</p>
      </div>`;
    dockNormal.hidden = true;
  }

  on("#flag-btn", "click", () => {
    const target = reviewing ? lastAnswered?.card : currentCard;
    if (!target) return;
    flagDialog(target).then((flagged) => { if (flagged && !reviewing) skipCurrent?.(); });
  });

  prevBtn.addEventListener("click", () => {
    if (!lastAnswered || reviewing) return;
    reviewing = true;
    dockNormal.hidden = true;
    dockReview.hidden = false;
    renderAnswerReview(stage, lastAnswered.card, lastAnswered, {
      prio: effectivePrio(lastAnswered.card, prios),
      onPrioChange: (prio) => changePrio(prios, lastAnswered.card, prio),
    });
  });

  reviewNextBtn.addEventListener("click", () => {
    reviewing = false;
    dockReview.hidden = true;
    if (currentCard) { dockNormal.hidden = false; armCard(currentCard); }
    else showEmptyState();
  });

  let resolveStep = null;
  nextBtn.onclick = () => {
    if (!outcome) { quizController?.giveUp(); return; }
    if (resolveStep) resolveStep(outcome);
  };
  fastBtn.onclick = () => { if (!fastBtn.disabled && resolveStep) resolveStep({ ...outcome, fastTrack: true }); };

  async function step() {
    if (i >= queue.length) {
      currentCard = null;
      showEmptyState();
      await updateProgress(progress);
      await sync();
      return;
    }
    dockNormal.hidden = false;
    await updateProgress(progress);
    const card = queue[i];
    currentCard = card;
    armCard(card);
    const result = await new Promise((resolve) => {
      skipCurrent = () => resolve({ flagged: true });
      resolveStep = resolve;
    });
    resolveStep = null;
    i++;
    if (result.flagged) { step(); return; }
    lastAnswered = { card, chosenIndex: result.chosenIndex, order: result.order, result };
    prevBtn.disabled = false;
    if (result.fastTrack) { await answerCard("quiz", card, true, 4); step(); return; }
    await answerCard("quiz", card, result.correct);
    step();
  }
  step();
}

// ---------- Automatikmodus (Karteikarten oder Frage-Antwort) ----------
//
// Anders als die manuelle Stufenwahl zieht diese Funktion die Karten laufend
// gewichtet aus dem gesamten Rechtsgebiet (siehe cards.js pickWeightedCard)
// und hat kein festes Ende – der Durchgang läuft, bis über „Modus verlassen"
// zurückgegangen wird.
async function showAutoMode(mode, gebiet, allowedPrios = new Set(PRIOS)) {
  sessionStreak = 0;
  await sync();

  const baseCards = await allCards();
  const filterPrios = await priosMap(currentUser);
  const cards = filterByPrio(baseCards, filterPrios, allowedPrios);
  const pool = cards.filter((c) => c.gebiet === gebiet);

  render(`${mode}-auto`, {
    left: backButton("Modus verlassen"),
    mid: `<button class="pill-btn" id="prev-btn" disabled>Zurück</button>`,
    right: `<button class="icon-btn" id="flag-btn" aria-label="Karte melden">${ICON.flag}</button><span class="bar-crumb"><b>Automatisch</b> · ${GEBIET_NAMEN[gebiet]}</span>`,
    body: `<div id="stage"></div>`,
    dock: mode === "cards" ? DOCK_CARDS : DOCK_QUIZ,
  });

  on("#back", "click", async () => { await sync(); showGebietPick(`${mode}-auto`); });

  // Eine gezogene, aber noch nicht beantwortete Karte bleibt gemerkt (lokal,
  // je Nutzer/Modus/Rechtsgebiet), damit ein Verlassen ohne Weiter/Richtig/
  // Falsch nicht als bearbeitet zählt und beim erneuten Öffnen dieselbe
  // Karte wieder angezeigt wird statt sofort eine neue zu ziehen.
  const pendingKey = `autoPending_${currentUser}_${mode}_${gebiet}`;

  let answered = 0;
  let currentCard = null;
  let lastKey = null;
  let lastAnswered = null; // { card, stufe, chosenIndex, order } – für „Zurück"
  let reviewing = false;
  let skipCurrent = null;
  let curLevels = null;
  let curPrios = null;
  const stage = $("#stage");
  const progress = $("#progress");
  const dockNormal = $("#dock-normal");
  const dockReview = $("#dock-review");
  const reviewNextBtn = $("#review-next");
  const prevBtn = $("#prev-btn");

  const wrongBtn = mode === "cards" ? $("#wrong") : null;
  const richtigBtn = mode === "cards" ? $("#richtig") : null;
  const nextBtn = mode === "quiz" ? $("#next") : null;
  const fastBtn = $("#fasttrack");

  let outcome = null;
  let quizController = null;
  let resolveStep = null;

  function stufeOf(card) {
    return curLevels?.get(cardKey(card))?.stufe ?? 1;
  }

  function armCard(card) {
    if (mode === "cards") {
      wrongBtn.disabled = true;
      richtigBtn.disabled = true;
      fastBtn.disabled = true;
      renderFlashcard(stage, card, {
        onRevealed: () => { wrongBtn.disabled = false; richtigBtn.disabled = false; fastBtn.disabled = false; },
        prio: effectivePrio(card, curPrios),
        onPrioChange: (prio) => changePrio(curPrios, card, prio),
        stufe: stufeOf(card),
      });
    } else {
      outcome = null;
      nextBtn.disabled = false;
      nextBtn.textContent = "Auflösen";
      fastBtn.disabled = true;
      quizController = renderAnswerCard(stage, card, {
        onAnswered: (result) => {
          outcome = result;
          nextBtn.textContent = "Weiter";
          fastBtn.disabled = !result.correct;
        },
        prio: effectivePrio(card, curPrios),
        onPrioChange: (prio) => changePrio(curPrios, card, prio),
        stufe: stufeOf(card),
      });
    }
  }

  function showEmptyState() {
    const rest = pool.length > 0;
    stage.innerHTML = `
      <div class="empty">
        <p class="empty-title">${rest ? "Für heute durch" : "Keine Karten verfügbar"}</p>
        <p class="empty-sub">${rest ? "Alle Karten dieses Rechtsgebiets wurden in den letzten 24 Stunden bearbeitet. Später gibt es wieder neue." : "In diesem Rechtsgebiet gibt es aktuell keine Karten."}</p>
      </div>`;
    dockNormal.hidden = true;
  }

  on("#flag-btn", "click", () => {
    const target = reviewing ? lastAnswered?.card : currentCard;
    if (!target) return;
    flagDialog(target).then((flagged) => { if (flagged && !reviewing) skipCurrent?.(); });
  });

  prevBtn.addEventListener("click", () => {
    if (!lastAnswered || reviewing) return;
    reviewing = true;
    dockNormal.hidden = true;
    dockReview.hidden = false;
    if (mode === "cards") {
      renderFlashcard(stage, lastAnswered.card, {
        revealed: true,
        prio: effectivePrio(lastAnswered.card, curPrios),
        onPrioChange: (prio) => changePrio(curPrios, lastAnswered.card, prio),
        stufe: lastAnswered.stufe,
      });
    } else {
      renderAnswerReview(stage, lastAnswered.card, lastAnswered, {
        prio: effectivePrio(lastAnswered.card, curPrios),
        onPrioChange: (prio) => changePrio(curPrios, lastAnswered.card, prio),
      });
    }
  });

  reviewNextBtn.addEventListener("click", () => {
    reviewing = false;
    dockReview.hidden = true;
    if (currentCard) { dockNormal.hidden = false; armCard(currentCard); }
    else showEmptyState();
  });

  if (mode === "cards") {
    wrongBtn.onclick = () => { if (!wrongBtn.disabled && resolveStep) resolveStep({ correct: false }); };
    richtigBtn.onclick = () => { if (!richtigBtn.disabled && resolveStep) resolveStep({ correct: true }); };
  } else {
    nextBtn.onclick = () => {
      if (!outcome) { quizController?.giveUp(); return; }
      if (resolveStep) resolveStep(outcome);
    };
  }
  fastBtn.onclick = () => { if (!fastBtn.disabled && resolveStep) resolveStep({ ...outcome, fastTrack: true }); };

  async function step() {
    if (pool.length === 0) {
      currentCard = null;
      showEmptyState();
      await updateProgress(progress);
      return;
    }
    dockNormal.hidden = false;
    await updateProgress(progress);
    curLevels = await levelsMap(currentUser);
    curPrios = await priosMap(currentUser);
    const pendingId = await getSetting(pendingKey, null);
    const card = (pendingId && pool.find((c) => cardKey(c) === pendingId)) || pickWeightedCard(pool, curLevels, curPrios, lastKey);
    if (!card) {
      currentCard = null;
      showEmptyState();
      return;
    }
    await setSetting(pendingKey, cardKey(card));
    currentCard = card;
    lastKey = cardKey(card);
    const stufe = stufeOf(card);
    armCard(card);

    const result = await new Promise((resolve) => {
      skipCurrent = () => resolve({ flagged: true });
      resolveStep = resolve;
    });
    resolveStep = null;
    await setSetting(pendingKey, null);
    if (result.flagged) {
      const idx = pool.findIndex((c) => cardKey(c) === lastKey);
      if (idx >= 0) pool.splice(idx, 1);
      step();
      return;
    }
    lastAnswered = { card, stufe, chosenIndex: result.chosenIndex ?? null, order: result.order ?? null, result };
    prevBtn.disabled = false;
    answered++;
    if (result.fastTrack) { await answerCard(mode, card, true, 4); step(); return; }
    await answerCard(mode, card, result.correct);
    step();
  }
  step();
}

// ---------- Karten anlegen ----------

async function showCreate(gebiet) {
  render("create", {
    left: backButton(),
    body: `
      <header class="page-head">
        <p class="kicker">Karten anlegen · ${GEBIET_NAMEN[gebiet]}</p>
        <h1 class="page-title">Neue Karte</h1>
        <p class="page-sub">Nach dem Anlegen bleibt das Formular offen, damit du direkt die nächste Karte eintragen kannst.</p>
      </header>
      <div class="form-group">
        <div class="seg" id="create-typ">
          <button type="button" class="is-active" data-typ="quiz">Vier Antworten</button>
          <button type="button" data-typ="begriffe">Antwortbegriffe</button>
        </div>
        <label class="field-box">
          <span class="field-box-label">Frage</span>
          <textarea id="f-frage" rows="3" placeholder="z. B. Unter welchen Voraussetzungen …"></textarea>
        </label>
        <div class="form-group" id="fields-quiz">
          <label class="field-box field-box-correct">
            <span class="field-box-label">Richtige Antwort</span>
            <input id="f-a0" type="text">
          </label>
          <label class="field-box">
            <span class="field-box-label">Falsche Antwort 1</span>
            <input id="f-a1" type="text">
          </label>
          <label class="field-box">
            <span class="field-box-label">Falsche Antwort 2</span>
            <input id="f-a2" type="text">
          </label>
          <label class="field-box">
            <span class="field-box-label">Falsche Antwort 3</span>
            <input id="f-a3" type="text">
          </label>
        </div>
        <div class="form-group" id="fields-begriffe" hidden>
          <div class="seg" id="create-order">
            <button type="button" class="is-active" data-order="0">Reihenfolge egal</button>
            <button type="button" data-order="1">Reihenfolge zählt</button>
          </div>
          <label class="field-box field-box-correct">
            <span class="field-box-label">Richtige Begriffe (einer pro Zeile, bei Reihenfolge in richtiger Reihenfolge)</span>
            <textarea id="f-richtig" rows="5"></textarea>
          </label>
          <label class="field-box">
            <span class="field-box-label">Falsche Begriffe (einer pro Zeile)</span>
            <textarea id="f-falsch" rows="3"></textarea>
          </label>
        </div>
        <label class="field-box">
          <span class="field-box-label">Erklärung</span>
          <textarea id="f-erklaerung" rows="3" placeholder="Kurze Begründung, Norm, Fundstelle …"></textarea>
        </label>
        <button class="btn btn-primary" id="save">Anlegen</button>
      </div>`,
  });

  on("#back", "click", () => showGebietPick("create"));

  let typ = "quiz";
  let ordered = false;
  const selectSeg = (segId, attr, value) => {
    root.querySelectorAll(`#${segId} button`).forEach((b) => b.classList.toggle("is-active", b.dataset[attr] === value));
  };
  root.querySelectorAll("#create-typ button").forEach((b) => b.addEventListener("click", () => {
    typ = b.dataset.typ;
    selectSeg("create-typ", "typ", typ);
    $("#fields-quiz").hidden = typ !== "quiz";
    $("#fields-begriffe").hidden = typ !== "begriffe";
  }));
  root.querySelectorAll("#create-order button").forEach((b) => b.addEventListener("click", () => {
    ordered = b.dataset.order === "1";
    selectSeg("create-order", "order", b.dataset.order);
  }));

  on("#save", "click", async () => {
    const frage = $("#f-frage").value.trim();
    const erklaerung = $("#f-erklaerung").value.trim();
    const lines = (id) => $(id).value.split("\n").map((l) => l.trim()).filter(Boolean);
    let extra;
    if (typ === "begriffe") {
      const richtig = lines("#f-richtig");
      const falsch = lines("#f-falsch");
      const alle = [...richtig, ...falsch];
      if (!frage || richtig.length < 2 || falsch.length < 1) {
        toast("Bitte Frage, mindestens 2 richtige und 1 falschen Begriff eintragen");
        return;
      }
      if (alle.length > 12 || new Set(alle.map((a) => a.toLowerCase())).size !== alle.length) {
        toast("Höchstens 12 Begriffe, jeder nur einmal");
        return;
      }
      extra = { typ: "begriffe", reihenfolge: ordered, antworten: richtig, falsche: falsch };
    } else {
      const a = ["#f-a0", "#f-a1", "#f-a2", "#f-a3"].map((id) => $(id).value.trim());
      if (!frage || a.some((x) => !x)) {
        toast("Bitte Frage und alle vier Antworten ausfüllen");
        return;
      }
      extra = { antworten: a };
    }
    const uuid = crypto.randomUUID();
    const card = {
      uuid,
      id: uuid,
      gebiet,
      frage,
      ...extra,
      erklaerung,
      creator: currentUser,
      ts: new Date().toISOString(),
    };
    await addUserCard(card);
    sync();
    toast("Karte angelegt");
    $("#f-frage").value = "";
    for (const id of ["#f-a0", "#f-a1", "#f-a2", "#f-a3", "#f-richtig", "#f-falsch", "#f-erklaerung"]) $(id).value = "";
    $("#f-frage").focus();
  });
}

// ---------- Flaggs beheben (nur Marius) ----------

const REVIEW_KEYS = ["A", "B", "C", "D"];

function reportedChip(flag) {
  return `<span class="user-chip">${flag.field === "frage" ? "Frage gemeldet" : "Antwort gemeldet"}</span>`;
}

function reporterChip(flag) {
  const name = USER_NAMEN[flag.flaggedBy] ?? flag.flaggedBy;
  return `<span class="user-chip" data-user="${flag.flaggedBy}"><span class="user-dot-sm"></span>${name}</span>`;
}

// Offene Meldungen, deren Karte noch existiert. Meldungen zu ersatzlos
// entfernten Karten zählen nirgends mehr (nur ausgeblendet, nicht verändert –
// so geht bei einem veralteten Kartenstand nichts verloren).
async function getValidOpenFlags() {
  const open = await getOpenFlags();
  if (open.length === 0) return open;
  const existing = new Set((await allBaseCards()).map((c) => cardKey(c)));
  return open.filter((f) => existing.has(f.cardId));
}

// Alle offenen Meldungen samt Karte (Dateiname, Frage, Antworten, Erklärung)
// als Klartext, zum Besprechen in einem Chat.
async function flagsAsText() {
  const open = (await getValidOpenFlags()).sort((a, b) => (a.ts < b.ts ? -1 : 1));
  if (open.length === 0) return "";
  const base = await allBaseCards();
  const byCard = new Map();
  for (const f of open) byCard.set(f.cardId, [...(byCard.get(f.cardId) ?? []), f]);
  const blocks = [];
  for (const [cardId, list] of byCard) {
    const card = await overlayCardById(base, cardId);
    const lines = [];
    lines.push(`Datei: ${card && !card.creator ? `content/${card.gebiet}/${card.id}.json` : `(von Nutzer in der App angelegt, keine Datei im Repo)`}`);
    lines.push(`Karten-ID: ${cardId}`);
    if (!card) {
      lines.push("(Karte existiert nicht mehr)");
    } else {
      lines.push(`Rechtsgebiet: ${GEBIET_NAMEN[card.gebiet]}`);
      if (isTermCard(card)) lines.push(`Typ: Begriffe (${card.reihenfolge ? "Reihenfolge zählt" : "Auflistung"})`);
      lines.push(`Frage: ${card.frage}`);
      if (isTermCard(card)) {
        card.antworten.forEach((a, i) => lines.push(`Richtiger Begriff${card.reihenfolge ? ` ${i + 1}` : ""}: ${a}`));
        card.falsche.forEach((a) => lines.push(`Falscher Begriff: ${a}`));
      } else {
        lines.push(`Richtige Antwort: ${card.antworten[0]}`);
        card.antworten.slice(1).forEach((a, i) => lines.push(`Falsche Antwort ${i + 1}: ${a}`));
      }
      lines.push(`Erklärung: ${card.erklaerung ?? ""}`);
    }
    for (const f of list) {
      lines.push(`Meldung (${f.field === "frage" ? "Frage" : "Antwort"}, von ${USER_NAMEN[f.flaggedBy] ?? f.flaggedBy}, ${f.ts.slice(0, 10)}): ${f.note}`);
    }
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n----------------------------------------\n\n") + "\n";
}

async function showFlagReview() {
  await sync();

  let flags = (await getValidOpenFlags()).sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  let idx = 0;

  render("flag-review", {
    left: backButton(),
    right: `<button class="icon-btn" id="export-flags" aria-label="Offene Meldungen als Textdatei exportieren" title="Als Textdatei exportieren">${ICON.download}</button>`,
    body: `<div id="stage"></div>`,
  });
  on("#back", "click", async () => { await sync(); showModes(); });
  on("#export-flags", "click", async () => {
    const text = await flagsAsText();
    if (!text) { toast("Keine offenen Meldungen"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    a.download = `flaggs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  const stage = $("#stage");

  // Nach einer Löschung/Bearbeitung verschwinden alle offenen Meldungen
  // dieser Karte aus der Liste; die Zeigerposition wird ggf. angepasst.
  function removeCardFromQueue(cardId) {
    flags = flags.filter((f) => f.cardId !== cardId);
    if (idx >= flags.length) idx = 0;
  }

  async function renderCurrent() {
    if (flags.length === 0) {
      stage.innerHTML = `
        <header class="page-head">
          <p class="kicker">Marius</p>
          <h1 class="page-title">Flaggs beheben</h1>
        </header>
        <div class="empty">
          <p class="empty-title">Keine offenen Meldungen</p>
          <p class="empty-sub">Alle gemeldeten Karten sind bearbeitet.</p>
        </div>`;
      return;
    }
    if (idx >= flags.length) idx = 0;
    const flag = flags[idx];
    const base = await allBaseCards();
    const card = await overlayCardById(base, flag.cardId);
    if (!card) {
      // Karte existiert nicht mehr (sollte praktisch nicht vorkommen) – Meldung überspringen.
      removeCardFromQueue(flag.cardId);
      renderCurrent();
      return;
    }
    renderCardView(flag, card);
  }

  function renderCardView(flag, card) {
    stage.innerHTML = `
      <header class="page-head">
        <p class="kicker">Meldung <b>${idx + 1}</b> von ${flags.length}</p>
        <h1 class="page-title">Flaggs beheben</h1>
      </header>
      <div class="flash-face flash-face-question" style="margin-bottom:14px">
        <p class="flash-text">${escapeHtml(card.frage)}</p>
      </div>
      ${isTermCard(card) ? `
      <div class="terms" style="margin-bottom:14px">
        ${card.antworten.map((a, i) => `<span class="term is-correct">${card.reihenfolge ? `<span class="term-no">${i + 1}</span>` : ""}<span class="term-text">${escapeHtml(a)}</span></span>`).join("")}
        ${card.falsche.map((a) => `<span class="term is-dim"><span class="term-text">${escapeHtml(a)}</span></span>`).join("")}
      </div>` : `
      <div class="answers" style="margin-bottom:14px">
        ${card.antworten.map((a, i) => `
          <button type="button" class="answer${i === 0 ? " is-correct" : ""}" disabled>
            <span class="answer-key">${REVIEW_KEYS[i]}</span>
            <span>${escapeHtml(a)}</span>
          </button>`).join("")}
      </div>`}
      ${card.erklaerung ? `<div class="flash-explain" style="margin-bottom:14px">${escapeHtml(card.erklaerung)}</div>` : ""}
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px">
        ${reportedChip(flag)}
        ${reporterChip(flag)}
      </div>
      <p class="page-sub" style="margin-bottom:24px">${escapeHtml(flag.note)}</p>
      <div style="display:flex; flex-direction:column; gap:10px">
        <button class="btn btn-primary" id="edit-btn">Bearbeiten</button>
        <button class="btn btn-secondary" id="skip-btn">Überspringen</button>
        <button class="btn btn-danger" id="delete-btn">Löschen</button>
      </div>`;

    on("#skip-btn", "click", () => {
      // Bleibt offen: wandert ans Ende der aktuellen Runde, taucht also
      // erst wieder auf, wenn alle anderen offenen Meldungen gezeigt wurden.
      const [f] = flags.splice(idx, 1);
      flags.push(f);
      if (idx >= flags.length) idx = 0;
      renderCurrent();
    });

    on("#delete-btn", "click", () => {
      confirmDialog({
        title: "Karte löschen?",
        text: "Die Karte wird überall ausgeblendet – in beiden Lernmodi, in den Zählungen und in der Flag-Übersicht. Das lässt sich nicht rückgängig machen.",
        onYes: async () => {
          const now = new Date().toISOString();
          await setCardEdit({ cardId: flag.cardId, ts: now, editedBy: currentUser, deleted: true });
          await resolveOpenFlagsForCard(flag.cardId, now);
          sync();
          toast("Karte gelöscht");
          removeCardFromQueue(flag.cardId);
          renderCurrent();
        },
      });
    });

    on("#edit-btn", "click", () => renderEditView(flag, card));
  }

  function renderEditView(flag, card) {
    stage.innerHTML = `
      <header class="page-head">
        <p class="kicker">Meldung <b>${idx + 1}</b> von ${flags.length}</p>
        <h1 class="page-title">Karte bearbeiten</h1>
      </header>
      <div class="form-group">
        <label class="field-box">
          <span class="field-box-label">Frage</span>
          <textarea id="e-frage" rows="3">${escapeHtml(card.frage)}</textarea>
        </label>
        ${isTermCard(card) ? `
        <label class="field-box field-box-correct">
          <span class="field-box-label">Richtige Begriffe (einer pro Zeile${card.reihenfolge ? ", in richtiger Reihenfolge" : ""})</span>
          <textarea id="e-richtig" rows="5">${escapeHtml(card.antworten.join("\n"))}</textarea>
        </label>
        <label class="field-box">
          <span class="field-box-label">Falsche Begriffe (einer pro Zeile)</span>
          <textarea id="e-falsch" rows="4">${escapeHtml(card.falsche.join("\n"))}</textarea>
        </label>` : `
        <label class="field-box field-box-correct">
          <span class="field-box-label">Richtige Antwort</span>
          <input id="e-a0" type="text" value="${escapeHtml(card.antworten[0])}">
        </label>
        <label class="field-box">
          <span class="field-box-label">Falsche Antwort 1</span>
          <input id="e-a1" type="text" value="${escapeHtml(card.antworten[1])}">
        </label>
        <label class="field-box">
          <span class="field-box-label">Falsche Antwort 2</span>
          <input id="e-a2" type="text" value="${escapeHtml(card.antworten[2])}">
        </label>
        <label class="field-box">
          <span class="field-box-label">Falsche Antwort 3</span>
          <input id="e-a3" type="text" value="${escapeHtml(card.antworten[3])}">
        </label>
        `}
        <label class="field-box">
          <span class="field-box-label">Erklärung</span>
          <textarea id="e-erklaerung" rows="3">${escapeHtml(card.erklaerung ?? "")}</textarea>
        </label>
        <button class="btn btn-primary" id="save-edit">Speichern</button>
        <button class="btn btn-secondary" id="cancel-edit">Abbrechen</button>
      </div>`;

    on("#cancel-edit", "click", () => renderCardView(flag, card));
    on("#save-edit", "click", async () => {
      const frage = $("#e-frage").value.trim();
      const erklaerung = $("#e-erklaerung").value.trim();
      const lines = (id) => $(id).value.split("\n").map((l) => l.trim()).filter(Boolean);
      let antworten, falsche;
      if (isTermCard(card)) {
        antworten = lines("#e-richtig");
        falsche = lines("#e-falsch");
        if (!frage || antworten.length < 2 || falsche.length < 1) {
          toast("Bitte Frage, mindestens 2 richtige und 1 falschen Begriff eintragen");
          return;
        }
      } else {
        const a = ["#e-a0", "#e-a1", "#e-a2", "#e-a3"].map((id) => $(id).value.trim());
        if (!frage || a.some((x) => !x)) {
          toast("Bitte Frage und alle vier Antworten ausfüllen");
          return;
        }
        antworten = a;
      }
      const now = new Date().toISOString();
      await setCardEdit({
        cardId: flag.cardId,
        ts: now,
        editedBy: currentUser,
        deleted: false,
        frage,
        antworten,
        ...(falsche ? { falsche } : {}),
        erklaerung,
      });
      await resolveOpenFlagsForCard(flag.cardId, now);
      sync();
      toast("Karte gespeichert");
      removeCardFromQueue(flag.cardId);
      renderCurrent();
    });
  }

  renderCurrent();
}

// ---------- Statistik ----------

async function showStats() {
  const eventsByUser = { marius: await getAllEvents("marius"), agnessa: await getAllEvents("agnessa") };
  render("stats", {
    left: backButton(),
    body: `
      <header class="page-head">
        <p class="kicker">${USER_NAMEN[currentUser]}</p>
        <h1 class="page-title">Statistik</h1>
      </header>
      <div id="stats"></div>`,
  });
  on("#back", "click", showModes);
  renderStats($("#stats"), eventsByUser, currentUser);
}

// ---------- Einstellungen ----------

async function showSettings() {
  const cfg = await getSyncConfig();
  const status = !cfg.token
    ? `<span class="status-dot"></span><span class="status-text">Nicht eingerichtet</span>`
    : cfg.lastError
      ? `<span class="status-dot is-error"></span><span class="status-text error-text">${escapeHtml(cfg.lastError)}</span>`
      : cfg.lastSync
        ? `<span class="status-dot is-ok"></span><span class="status-text">Synchronisiert <strong>${formatWhen(cfg.lastSync)}</strong></span>`
        : `<span class="status-dot"></span><span class="status-text">Noch nicht synchronisiert</span>`;

  render("settings", {
    left: backButton(),
    body: `
      <header class="page-head"><h1 class="page-title">Einstellungen</h1></header>

      <h2 class="label">Nutzer</h2>
      <div class="group">
        <button class="row" id="switch-user">
          <span class="row-main">
            <span class="row-title">Nutzer wechseln</span>
            <span class="row-sub">Aktuell: ${USER_NAMEN[currentUser]}</span>
          </span>
          ${ICON.chevron}
        </button>
      </div>

      <h2 class="label">Synchronisierung</h2>
      <div class="group">
        <div class="status">${status}</div>
        <label class="field">
          <span class="field-label">GitHub-Token</span>
          <input id="token" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…" value="${escapeHtml(cfg.token)}">
        </label>
        <label class="field">
          <span class="field-label">Gist-ID</span>
          <input id="gist" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Wird beim ersten Sync angelegt" value="${escapeHtml(cfg.gistId)}">
        </label>
      </div>
      <p class="help">Auf dem ersten Gerät nur den Token eintragen – die Gist-ID entsteht automatisch. Auf jedem weiteren Gerät (bei beiden Nutzern) denselben Token und diese Gist-ID eintragen.</p>
      <div class="settings-actions"><button class="btn btn-secondary" id="save">Speichern und synchronisieren</button></div>

      <h2 class="label">Fortschritt (${USER_NAMEN[currentUser]})</h2>
      <div class="group">
        <button class="row row-danger" id="reset-levels"><span class="row-main"><span class="row-title">Alle Karten auf Stufe 1 zurücksetzen</span><span class="row-sub">Nur dein eigener Fortschritt, nicht die Karten selbst</span></span></button>
        <button class="row row-danger" id="reset-stats"><span class="row-main"><span class="row-title">Statistik löschen</span><span class="row-sub">Nur deine eigene Tagesstatistik</span></span></button>
      </div>`,
  });

  on("#back", "click", showModes);
  on("#switch-user", "click", showUserPick);
  on("#save", "click", async (e) => {
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = "Synchronisiere …";
    await setSyncConfig({ token: $("#token").value.trim(), gistId: $("#gist").value.trim() });
    await sync();
    showSettings();
  });
  on("#reset-levels", "click", () =>
    confirmDialog({
      title: "Alle Karten auf Stufe 1 zurücksetzen?",
      text: `Der gesamte Stufen-Fortschritt von ${USER_NAMEN[currentUser]} wird zurückgesetzt – auch auf synchronisierten Geräten. Die Karten selbst und der Fortschritt des anderen Nutzers bleiben unverändert.`,
      onYes: async () => {
        await resetLevelsForUser(currentUser);
        toast("Stufen zurückgesetzt");
        showSettings();
      },
    })
  );
  on("#reset-stats", "click", () =>
    confirmDialog({
      title: "Statistik löschen?",
      text: `Die Tagesstatistik von ${USER_NAMEN[currentUser]} wird gelöscht – auch auf synchronisierten Geräten. Der Stufen-Fortschritt bleibt unverändert.`,
      onYes: async () => {
        await resetStatsForUser(currentUser);
        toast("Statistik gelöscht");
        showSettings();
      },
    })
  );
}

function formatWhen(iso) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const today = new Date().toDateString() === d.toDateString();
  return today ? `heute, ${time}` : `${d.toLocaleDateString("de-DE", { day: "numeric", month: "long" })}, ${time}`;
}

// ---------- Dialog & Hinweis ----------

function confirmDialog({ title, text, onYes }) {
  const el = document.createElement("div");
  el.className = "backdrop";
  el.innerHTML = `
    <div class="dialog" role="alertdialog" aria-modal="true">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      <div class="dialog-actions">
        <button class="btn btn-secondary" data-answer="no">Nein</button>
        <button class="btn btn-danger" data-answer="yes">Ja</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('[data-answer="no"]').focus();
  const close = () => el.remove();
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  el.querySelector('[data-answer="no"]').addEventListener("click", close);
  el.querySelector('[data-answer="yes"]').addEventListener("click", async () => {
    close();
    await onYes();
  });
}

// Blockierende Ersteinrichtung: ohne Token liefe man ohne Synchronisierung,
// ohne es zu merken. Kein Abbrechen/Wegklicken möglich – erst nach dem
// Speichern geht es weiter (siehe init()).
function requireTokenDialog() {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "backdrop";
    el.innerHTML = `
      <div class="dialog" role="alertdialog" aria-modal="true">
        <h3>GitHub-Token hinterlegen</h3>
        <p>Ohne Token wird nicht synchronisiert – dein Fortschritt bliebe allein auf diesem Gerät. Am besten gleich einrichten, bevor es losgeht (geht auch später jederzeit über die Einstellungen).</p>
        <label class="field">
          <span class="field-label">GitHub-Token</span>
          <input id="req-token" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…">
        </label>
        <label class="field">
          <span class="field-label">Gist-ID (nur auf weiteren Geräten nötig)</span>
          <input id="req-gist" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Auf dem ersten Gerät leer lassen">
        </label>
        <div class="dialog-actions" style="margin-top:18px">
          <button class="btn btn-secondary" data-answer="later">Später</button>
          <button class="btn btn-primary" id="req-save" disabled>Speichern</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    const tokenInput = el.querySelector("#req-token");
    const saveBtn = el.querySelector("#req-save");
    const close = () => { el.remove(); resolve(); };
    tokenInput.addEventListener("input", () => { saveBtn.disabled = !tokenInput.value.trim(); });
    tokenInput.focus();
    el.addEventListener("click", (e) => { if (e.target === el) close(); });
    el.querySelector('[data-answer="later"]').addEventListener("click", close);
    saveBtn.addEventListener("click", async () => {
      const token = tokenInput.value.trim();
      if (!token) return;
      saveBtn.disabled = true;
      saveBtn.textContent = "Speichere …";
      await setSyncConfig({ token, gistId: el.querySelector("#req-gist").value.trim() });
      close();
    });
  });
}

function toast(message, action) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = action ? "toast has-action" : "toast";
  el.setAttribute("role", "status");
  el.innerHTML = `<span>${escapeHtml(message)}</span>${action ? `<button>${escapeHtml(action.label)}</button>` : ""}`;
  document.body.appendChild(el);
  if (action) el.querySelector("button").addEventListener("click", action.run);
  else setTimeout(() => el.remove(), 2600);
}

// ---------- Start ----------

// Für gezieltes Testen aus der Konsole (siehe SPEC.md, Abschnitt Motivations-Overlay).
window.__lernapp = { showMotivOverlay };

async function init() {
  const index = await fetch("content/index.json").then((r) => r.json());
  allContentCards = index.cards ?? [];

  currentUser = await getCurrentUser();
  if (!currentUser || !USERS.includes(currentUser)) {
    await showUserPick();
  } else {
    await showModes();
  }

  const cfg = await getSyncConfig();
  if (!cfg.token) await requireTokenDialog();

  sync().then((res) => { if (res?.changed && (current === "modes" || current === "gebiet" || current === "stufe")) showModes(); });
  window.addEventListener("online", () => sync());

  if ("serviceWorker" in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.register("sw.js");
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return;
      toast("Neue Version verfügbar", { label: "Neu laden", run: () => location.reload() });
    });
  }
}

init();

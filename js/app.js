// Routing und Bildschirme. Vorbild: ukr-app js/app.js (gleicher Rahmen aus
// Kopfleiste/Seite/Dock, gleiche Hilfsfunktionen für Dialog und Hinweis).
import { renderFlashcard, buildQueue, countByStufe, countByGebiet, pickWeightedCard, filterByPrio } from "./cards.js";
import { renderQuizCard } from "./quiz.js";
import { renderStats, countToday } from "./stats.js";
import {
  USERS,
  GEBIETE,
  STUFEN,
  PRIOS,
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
  up: svg(`<path d="M7 12.5l5-5 5 5M7 18l5-5 5 5"/>`, `stroke-width="2"`),
};

// Untere Leiste der Lernmodi. „Falsch“ und „Richtig“ teilen sich die Breite
// je zur Hälfte; der „Direkt in Stufe 4“-Knopf nimmt seinen Platz nur von
// „Richtig“ bzw. „Weiter“, die Trennung Falsch/Richtig bleibt in der Mitte.
const FAST_BTN = `<button type="button" class="btn btn-fasttrack" id="fasttrack" disabled aria-label="Direkt in Stufe 4 (schon sicher gekonnt)" title="Direkt in Stufe 4">${ICON.up}</button>`;
const DOCK_CARDS = `
  <div class="dock-col">
    <div class="dock-row dock-row-split">
      <button type="button" class="btn btn-wrong" id="wrong" disabled>Falsch</button>
      <div class="dock-pair">
        <button type="button" class="btn btn-correct btn-fill" id="richtig" disabled>Richtig</button>
        ${FAST_BTN}
      </div>
    </div>
    <span class="dock-progress" id="progress"></span>
  </div>`;
const DOCK_QUIZ = `
  <div class="dock-col">
    <div class="dock-row">
      <button type="button" class="btn btn-primary btn-fill" id="next" disabled>Weiter</button>
      ${FAST_BTN}
    </div>
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

function render(name, { left = "", right = "", body = "", dock = "" }) {
  current = name;
  root.innerHTML = `
    <header class="bar"><div class="bar-inner">
      <div class="bar-side">${left}</div>
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

async function priosMap(user) {
  const prios = await getAllPrios(user);
  return new Map(prios.map((p) => [p.cardId, p]));
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
  const openFlags = currentUser === "marius" ? await getOpenFlags() : [];

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

  const rows = STUFEN.map((stufe) => {
    const n = counts[stufe] ?? 0;
    const available = n > 0;
    return `
      <button class="row" data-stufe="${stufe}" ${available ? "" : "disabled"}>
        <span class="row-lead">${stufe}</span>
        <span class="row-main">
          <span class="row-title">Stufe ${stufe}</span>
          <span class="row-sub">${available ? plural(n, "Karte", "Karten") : "Noch keine Karten"}</span>
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
    right: `<button class="icon-btn" id="flag-btn" aria-label="Karte melden">${ICON.flag}</button><span class="bar-crumb"><b>Stufe ${stufe}</b> · ${GEBIET_NAMEN[gebiet]}</span>`,
    body: `<div id="stage"></div>`,
    dock: DOCK_CARDS,
  });

  on("#back", "click", async () => { await sync(); showStufePick("cards", gebiet, allowedPrios); });

  let i = 0;
  let currentCard = null;
  let skipCurrent = null;
  const stage = $("#stage");
  const progress = $("#progress");
  const dockRow = $(".dock-row");
  const wrongBtn = $("#wrong");
  const richtigBtn = $("#richtig");
  const fastBtn = $("#fasttrack");

  on("#flag-btn", "click", () => {
    if (!currentCard) return;
    flagDialog(currentCard).then((flagged) => { if (flagged) skipCurrent?.(); });
  });

  async function step() {
    if (i >= queue.length) {
      currentCard = null;
      stage.innerHTML = `
        <div class="empty">
          <p class="empty-title">Stufe abgeschlossen</p>
          <p class="empty-sub">Alle Karten dieser Stufe sind für diesen Durchgang bearbeitet.</p>
        </div>`;
      progress.textContent = `${queue.length} von ${queue.length} bearbeitet`;
      dockRow.hidden = true;
      await sync();
      return;
    }
    dockRow.hidden = false;
    wrongBtn.disabled = true;
    richtigBtn.disabled = true;
    fastBtn.disabled = true;
    progress.textContent = `${i} von ${queue.length} bearbeitet`;
    const card = queue[i];
    currentCard = card;
    renderFlashcard(stage, card, {
      onRevealed: () => { wrongBtn.disabled = false; richtigBtn.disabled = false; fastBtn.disabled = false; },
      prio: effectivePrio(card, prios),
      onPrioChange: (prio) => changePrio(prios, card, prio),
    });
    const result = await new Promise((resolve) => {
      skipCurrent = () => resolve({ flagged: true });
      wrongBtn.onclick = () => { if (!wrongBtn.disabled) resolve({ correct: false }); };
      richtigBtn.onclick = () => { if (!richtigBtn.disabled) resolve({ correct: true }); };
      fastBtn.onclick = () => { if (!fastBtn.disabled) resolve({ fastTrack: true }); };
    });
    skipCurrent = null;
    wrongBtn.onclick = null;
    richtigBtn.onclick = null;
    fastBtn.onclick = null;
    i++;
    if (result.flagged) { step(); return; }
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
    right: `<button class="icon-btn" id="flag-btn" aria-label="Karte melden">${ICON.flag}</button><span class="bar-crumb"><b>Stufe ${stufe}</b> · ${GEBIET_NAMEN[gebiet]}</span>`,
    body: `<div id="stage"></div>`,
    dock: DOCK_QUIZ,
  });

  on("#back", "click", async () => { await sync(); showStufePick("quiz", gebiet, allowedPrios); });

  let i = 0;
  let currentCard = null;
  let skipCurrent = null;
  const stage = $("#stage");
  const progress = $("#progress");
  const dockRow = $(".dock-row");
  const nextBtn = $("#next");
  const fastBtn = $("#fasttrack");

  on("#flag-btn", "click", () => {
    if (!currentCard) return;
    flagDialog(currentCard).then((flagged) => { if (flagged) skipCurrent?.(); });
  });

  async function step() {
    if (i >= queue.length) {
      currentCard = null;
      stage.innerHTML = `
        <div class="empty">
          <p class="empty-title">Stufe abgeschlossen</p>
          <p class="empty-sub">Alle Karten dieser Stufe sind für diesen Durchgang bearbeitet.</p>
        </div>`;
      progress.textContent = `${queue.length} von ${queue.length} bearbeitet`;
      dockRow.hidden = true;
      await sync();
      return;
    }
    dockRow.hidden = false;
    nextBtn.disabled = true;
    fastBtn.disabled = true;
    progress.textContent = `${i} von ${queue.length} bearbeitet`;
    const card = queue[i];
    currentCard = card;
    let outcome = null;
    renderQuizCard(stage, card, {
      onAnswered: (correct) => { outcome = { correct }; nextBtn.disabled = false; fastBtn.disabled = false; },
      prio: effectivePrio(card, prios),
      onPrioChange: (prio) => changePrio(prios, card, prio),
    });
    const result = await new Promise((resolve) => {
      skipCurrent = () => resolve({ flagged: true });
      nextBtn.onclick = () => { if (outcome) resolve(outcome); };
      fastBtn.onclick = () => { if (!fastBtn.disabled) resolve({ fastTrack: true }); };
    });
    skipCurrent = null;
    nextBtn.onclick = null;
    fastBtn.onclick = null;
    i++;
    if (result.flagged) { step(); return; }
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
    right: `<button class="icon-btn" id="flag-btn" aria-label="Karte melden">${ICON.flag}</button><span class="bar-crumb"><b>Automatisch</b> · ${GEBIET_NAMEN[gebiet]}</span>`,
    body: `<div id="stage"></div>`,
    dock: mode === "cards" ? DOCK_CARDS : DOCK_QUIZ,
  });

  on("#back", "click", async () => { await sync(); showGebietPick(`${mode}-auto`); });

  let answered = 0;
  let currentCard = null;
  let lastKey = null;
  let skipCurrent = null;
  const stage = $("#stage");
  const progress = $("#progress");

  on("#flag-btn", "click", () => {
    if (!currentCard) return;
    flagDialog(currentCard).then((flagged) => { if (flagged) skipCurrent?.(); });
  });

  async function step() {
    if (pool.length === 0) {
      currentCard = null;
      stage.innerHTML = `
        <div class="empty">
          <p class="empty-title">Keine Karten verfügbar</p>
          <p class="empty-sub">In diesem Rechtsgebiet gibt es aktuell keine Karten.</p>
        </div>`;
      progress.textContent = `${answered} bearbeitet`;
      return;
    }
    progress.textContent = `${answered} bearbeitet`;
    const levels = await levelsMap(currentUser);
    const prios = await priosMap(currentUser);
    const card = pickWeightedCard(pool, levels, prios, lastKey);
    currentCard = card;
    lastKey = cardKey(card);

    let result;
    if (mode === "cards") {
      const wrongBtn = $("#wrong");
      const richtigBtn = $("#richtig");
      const fastBtn = $("#fasttrack");
      wrongBtn.disabled = true;
      richtigBtn.disabled = true;
      fastBtn.disabled = true;
      renderFlashcard(stage, card, {
        onRevealed: () => { wrongBtn.disabled = false; richtigBtn.disabled = false; fastBtn.disabled = false; },
        prio: effectivePrio(card, prios),
        onPrioChange: (prio) => changePrio(prios, card, prio),
      });
      result = await new Promise((resolve) => {
        skipCurrent = () => resolve({ flagged: true });
        wrongBtn.onclick = () => { if (!wrongBtn.disabled) resolve({ correct: false }); };
        richtigBtn.onclick = () => { if (!richtigBtn.disabled) resolve({ correct: true }); };
        fastBtn.onclick = () => { if (!fastBtn.disabled) resolve({ fastTrack: true }); };
      });
      wrongBtn.onclick = null;
      richtigBtn.onclick = null;
      fastBtn.onclick = null;
    } else {
      const nextBtn = $("#next");
      const fastBtn = $("#fasttrack");
      nextBtn.disabled = true;
      fastBtn.disabled = true;
      let outcome = null;
      renderQuizCard(stage, card, {
        onAnswered: (correct) => { outcome = { correct }; nextBtn.disabled = false; fastBtn.disabled = false; },
        prio: effectivePrio(card, prios),
        onPrioChange: (prio) => changePrio(prios, card, prio),
      });
      result = await new Promise((resolve) => {
        skipCurrent = () => resolve({ flagged: true });
        nextBtn.onclick = () => { if (outcome) resolve(outcome); };
        fastBtn.onclick = () => { if (!fastBtn.disabled) resolve({ fastTrack: true }); };
      });
      nextBtn.onclick = null;
      fastBtn.onclick = null;
    }
    skipCurrent = null;
    if (result.flagged) {
      const idx = pool.findIndex((c) => cardKey(c) === lastKey);
      if (idx >= 0) pool.splice(idx, 1);
      step();
      return;
    }
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
        <label class="field-box">
          <span class="field-box-label">Frage</span>
          <textarea id="f-frage" rows="3" placeholder="z. B. Unter welchen Voraussetzungen …"></textarea>
        </label>
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
        <label class="field-box">
          <span class="field-box-label">Erklärung</span>
          <textarea id="f-erklaerung" rows="3" placeholder="Kurze Begründung, Norm, Fundstelle …"></textarea>
        </label>
        <button class="btn btn-primary" id="save">Anlegen</button>
      </div>`,
  });

  on("#back", "click", () => showGebietPick("create"));
  on("#save", "click", async () => {
    const frage = $("#f-frage").value.trim();
    const a0 = $("#f-a0").value.trim();
    const a1 = $("#f-a1").value.trim();
    const a2 = $("#f-a2").value.trim();
    const a3 = $("#f-a3").value.trim();
    const erklaerung = $("#f-erklaerung").value.trim();
    if (!frage || !a0 || !a1 || !a2 || !a3) {
      toast("Bitte Frage und alle vier Antworten ausfüllen");
      return;
    }
    const uuid = crypto.randomUUID();
    const card = {
      uuid,
      id: uuid,
      gebiet,
      frage,
      antworten: [a0, a1, a2, a3],
      erklaerung,
      creator: currentUser,
      ts: new Date().toISOString(),
    };
    await addUserCard(card);
    sync();
    toast("Karte angelegt");
    $("#f-frage").value = "";
    $("#f-a0").value = "";
    $("#f-a1").value = "";
    $("#f-a2").value = "";
    $("#f-a3").value = "";
    $("#f-erklaerung").value = "";
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

async function showFlagReview() {
  await sync();

  let flags = (await getOpenFlags()).sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  let idx = 0;

  render("flag-review", {
    left: backButton(),
    body: `<div id="stage"></div>`,
  });
  on("#back", "click", async () => { await sync(); showModes(); });

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
      <div class="answers" style="margin-bottom:14px">
        ${card.antworten.map((a, i) => `
          <button type="button" class="answer${i === 0 ? " is-correct" : ""}" disabled>
            <span class="answer-key">${REVIEW_KEYS[i]}</span>
            <span>${escapeHtml(a)}</span>
          </button>`).join("")}
      </div>
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
      const a0 = $("#e-a0").value.trim();
      const a1 = $("#e-a1").value.trim();
      const a2 = $("#e-a2").value.trim();
      const a3 = $("#e-a3").value.trim();
      const erklaerung = $("#e-erklaerung").value.trim();
      if (!frage || !a0 || !a1 || !a2 || !a3) {
        toast("Bitte Frage und alle vier Antworten ausfüllen");
        return;
      }
      const now = new Date().toISOString();
      await setCardEdit({
        cardId: flag.cardId,
        ts: now,
        editedBy: currentUser,
        deleted: false,
        frage,
        antworten: [a0, a1, a2, a3],
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
  const events = await getAllEvents(currentUser);
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
  renderStats($("#stats"), events);
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

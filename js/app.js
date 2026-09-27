// Routing und Bildschirme. Vorbild: ukr-app js/app.js (gleicher Rahmen aus
// Kopfleiste/Seite/Dock, gleiche Hilfsfunktionen für Dialog und Hinweis).
import { renderFlashcard, buildQueue, countByStufe, countByGebiet } from "./cards.js";
import { renderQuizCard } from "./quiz.js";
import { renderStats, countToday } from "./stats.js";
import {
  USERS,
  GEBIETE,
  STUFEN,
  getCurrentUser,
  setCurrentUser,
  getAllUserCards,
  addUserCard,
  getAllLevels,
  setLevel,
  getAllEvents,
  addEvent,
} from "./store.js";
import { getSyncConfig, setSyncConfig, sync, resetStatsForUser, resetLevelsForUser } from "./sync.js";
import { escapeHtml } from "./tokens.js";

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
};

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

async function allCards() {
  const userCards = await getAllUserCards();
  return allContentCards.concat(userCards);
}

async function levelsMap(user) {
  const levels = await getAllLevels(user);
  return new Map(levels.map((l) => [l.cardId, l]));
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
          <span class="user-dot"></span>
          <span class="user-name">Marius</span>
          <span class="user-sub">Erstes Staatsexamen</span>
        </button>
        <button class="user-card" data-user="agnessa">
          <span class="user-dot"></span>
          <span class="user-name">Agnessa</span>
          <span class="user-sub">Erstes Staatsexamen</span>
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
      </div>`,
  });

  on("#to-stats", "click", showStats);
  on("#to-settings", "click", showSettings);
  on("#mode-cards", "click", () => showGebietPick("cards"));
  on("#mode-quiz", "click", () => showGebietPick("quiz"));
  on("#mode-create", "click", () => showGebietPick("create"));
}

// ---------- Rechtsgebiet ----------

async function showGebietPick(mode) {
  const cards = await allCards();
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
        ${available ? ICON.chevron : `<span class="badge">Noch keine Karten</span>`}
      </button>`;
  }).join("");

  render("gebiet", {
    left: backButton(),
    body: `
      <header class="page-head">
        <p class="kicker">${modeLabel(mode)}</p>
        <h1 class="page-title">${title}</h1>
      </header>
      <div class="group">${rows}</div>`,
  });

  on("#back", "click", showModes);
  root.querySelectorAll("[data-gebiet]:not(:disabled)").forEach((b) =>
    b.addEventListener("click", () => {
      if (mode === "create") showCreate(b.dataset.gebiet);
      else showStufePick(mode, b.dataset.gebiet);
    })
  );
}

function modeLabel(mode) {
  if (mode === "cards") return "Karteikarten";
  if (mode === "quiz") return "Frage-Antwort";
  return "Karten anlegen";
}

// ---------- Stufe ----------

async function showStufePick(mode, gebiet) {
  const cards = await allCards();
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
      if (mode === "cards") showFlashcardMode(gebiet, stufe);
      else showQuizMode(gebiet, stufe);
    })
  );
}

// ---------- Bewertung einer Karte (gemeinsam für beide Lernmodi) ----------

async function answerCard(mode, card, correct) {
  const now = new Date().toISOString();
  const newStufe = correct ? Math.min(5, (await currentStufeOf(card)) + 1) : 1;
  await setLevel(currentUser, card.id, newStufe, now);

  const todayBefore = countToday(await getAllEvents(currentUser));
  await addEvent({ id: crypto.randomUUID(), user: currentUser, ts: now, cardId: card.id, correct, mode });
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
  return levels.get(card.id)?.stufe ?? 1;
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

// ---------- Karteikarten-Modus ----------

async function showFlashcardMode(gebiet, stufe) {
  sessionStreak = 0;
  await sync();

  const cards = await allCards();
  const levels = await levelsMap(currentUser);
  const queue = buildQueue(cards, gebiet, stufe, levels);

  render("flashcards", {
    left: backButton("Modus verlassen"),
    right: `<span class="bar-crumb"><b>Stufe ${stufe}</b> · ${GEBIET_NAMEN[gebiet]}</span>`,
    body: `<div id="stage"></div>`,
    dock: `
      <div class="dock-status">
        <span class="dock-text" id="progress"></span>
      </div>`,
  });

  on("#back", "click", async () => { await sync(); showStufePick("cards", gebiet); });

  let i = 0;
  const stage = $("#stage");
  const progress = $("#progress");

  async function step() {
    if (i >= queue.length) {
      stage.innerHTML = `
        <div class="empty">
          <p class="empty-title">Stufe abgeschlossen</p>
          <p class="empty-sub">Alle Karten dieser Stufe sind für diesen Durchgang bearbeitet.</p>
        </div>`;
      progress.textContent = `${queue.length} von ${queue.length} bearbeitet`;
      await sync();
      return;
    }
    progress.textContent = `${i} von ${queue.length} bearbeitet`;
    const card = queue[i];
    const correct = await renderFlashcard(stage, card);
    await answerCard("cards", card, correct);
    i++;
    step();
  }
  step();
}

// ---------- Frage-Antwort-Modus ----------

async function showQuizMode(gebiet, stufe) {
  sessionStreak = 0;
  await sync();

  const cards = await allCards();
  const levels = await levelsMap(currentUser);
  const queue = buildQueue(cards, gebiet, stufe, levels);

  render("quiz-mode", {
    left: backButton("Modus verlassen"),
    right: `<span class="bar-crumb"><b>Stufe ${stufe}</b> · ${GEBIET_NAMEN[gebiet]}</span>`,
    body: `<div id="stage"></div>`,
    dock: `
      <div class="dock-status">
        <span class="dock-text" id="progress"></span>
      </div>`,
  });

  on("#back", "click", async () => { await sync(); showStufePick("quiz", gebiet); });

  let i = 0;
  const stage = $("#stage");
  const progress = $("#progress");

  async function step() {
    if (i >= queue.length) {
      stage.innerHTML = `
        <div class="empty">
          <p class="empty-title">Stufe abgeschlossen</p>
          <p class="empty-sub">Alle Karten dieser Stufe sind für diesen Durchgang bearbeitet.</p>
        </div>`;
      progress.textContent = `${queue.length} von ${queue.length} bearbeitet`;
      await sync();
      return;
    }
    progress.textContent = `${i} von ${queue.length} bearbeitet`;
    const card = queue[i];
    const correct = await renderQuizCard(stage, card);
    await answerCard("quiz", card, correct);
    i++;
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
    const card = {
      uuid: crypto.randomUUID(),
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

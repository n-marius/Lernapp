// Lokale Datenhaltung (IndexedDB), Vorbild: ukr-app js/store.js.
//
// Gespeichert wird pro Gerät:
//  - settings          Schlüssel/Wert (u. a. aktueller Nutzer, Sync-Zugang)
//  - userCards         von Marius/Agnessa selbst angelegte Karten (geteilter Inhalt)
//  - levels            Leitner-Stufe je Nutzer und Karte: { key: "user:cardId", user, cardId, stufe, ts }
//  - prios             persönliche Prio-Änderung je Nutzer und Karte (überschreibt die
//                       Grund-Prio der Karte nur für diesen Nutzer): { key, user, cardId, prio, ts }
//  - events            bearbeitete Karten je Nutzer (für die Tagesstatistik), append-only
//  - flags             Meldungen zu Karten ("Frage" oder "Antwort" ist falsch/unklar):
//                       { id, cardId, field: "frage"|"antwort", note, flaggedBy, ts, status: "open"|"resolved" }
//  - cardEdits         Korrekturen/Löschungen von Karten, ein Eintrag je Karte:
//                       { cardId, ts, editedBy, deleted, frage?, antworten?: [4], erklaerung? }
//
// Der Grundbestand an Karten (content/*.json) wird NICHT hier gespeichert,
// sondern beim Start als content/index.json geladen (siehe js/app.js).

const DB_NAME = "lernapp";
const DB_VERSION = 3;
const STORE_SETTINGS = "settings";
const STORE_USER_CARDS = "userCards";
const STORE_LEVELS = "levels";
const STORE_PRIOS = "prios";
const STORE_EVENTS = "events";
const STORE_FLAGS = "flags";
const STORE_CARD_EDITS = "cardEdits";

export const USERS = ["marius", "agnessa"];
export const GEBIETE = ["zivilgericht", "strafrecht", "rechtsanwalt", "verwaltungsrecht"];
export const STUFEN = [1, 2, 3, 4, 5];
export const PRIOS = ["hoch", "normal", "niedrig"];

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_USER_CARDS)) {
        db.createObjectStore(STORE_USER_CARDS, { keyPath: "uuid" });
      }
      if (!db.objectStoreNames.contains(STORE_LEVELS)) {
        const store = db.createObjectStore(STORE_LEVELS, { keyPath: "key" });
        store.createIndex("user", "user", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PRIOS)) {
        const store = db.createObjectStore(STORE_PRIOS, { keyPath: "key" });
        store.createIndex("user", "user", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const store = db.createObjectStore(STORE_EVENTS, { keyPath: "id" });
        store.createIndex("user", "user", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_FLAGS)) {
        const store = db.createObjectStore(STORE_FLAGS, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("cardId", "cardId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CARD_EDITS)) {
        db.createObjectStore(STORE_CARD_EDITS, { keyPath: "cardId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;
function getDb() {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

async function tx(storeName, mode) {
  const db = await getDb();
  const t = db.transaction(storeName, mode);
  return { t, store: t.objectStore(storeName) };
}

function levelKey(user, cardId) {
  return `${user}:${cardId}`;
}

// Eindeutiger Schlüssel einer Karte, unabhängig davon, ob sie aus dem
// Grundbestand (Feld `id`) oder von einem Nutzer angelegt wurde (Feld `uuid`).
export function cardKey(card) {
  return card.id ?? card.uuid;
}

// ---------- Einstellungen ----------

export async function getSetting(key, fallback = null) {
  const { store } = await tx(STORE_SETTINGS, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
    req.onerror = () => reject(req.error);
  });
}

export async function setSetting(key, value) {
  const { t, store } = await tx(STORE_SETTINGS, "readwrite");
  store.put({ key, value });
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getCurrentUser() {
  return getSetting("currentUser", null);
}

export async function setCurrentUser(user) {
  return setSetting("currentUser", user);
}

// ---------- Nutzer angelegte Karten ----------

export async function addUserCard(card) {
  const { t, store } = await tx(STORE_USER_CARDS, "readwrite");
  store.put(card);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve(card);
    t.onerror = () => reject(t.error);
  });
}

export async function getAllUserCards() {
  const { store } = await tx(STORE_USER_CARDS, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Vereinigung nach uuid (append-only, es werden keine Karten bearbeitet oder gelöscht).
export async function mergeUserCards(remoteCards) {
  const { t, store } = await tx(STORE_USER_CARDS, "readwrite");
  for (const c of remoteCards) store.put(c);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// ---------- Leitner-Stufen ----------

export async function getLevel(user, cardId) {
  const { store } = await tx(STORE_LEVELS, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.get(levelKey(user, cardId));
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllLevels(user) {
  const { store } = await tx(STORE_LEVELS, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.index("user").getAll(IDBKeyRange.only(user));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function setLevel(user, cardId, stufe, ts) {
  const { t, store } = await tx(STORE_LEVELS, "readwrite");
  store.put({ key: levelKey(user, cardId), user, cardId, stufe, ts });
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// CRDT-Merge: pro Karte gewinnt die Version mit dem späteren Zeitstempel.
// Einträge, die vor oder bei levelsResetAt entstanden sind, gelten als
// zurückgesetzt (Stufe 1) und werden lokal entfernt.
export async function mergeLevels(user, remoteLevels, levelsResetAt) {
  const local = await getAllLevels(user);
  const localByCard = new Map(local.map((l) => [l.cardId, l]));
  const { t, store } = await tx(STORE_LEVELS, "readwrite");
  for (const [cardId, remote] of Object.entries(remoteLevels ?? {})) {
    if (levelsResetAt && remote.ts <= levelsResetAt) continue;
    const existing = localByCard.get(cardId);
    if (!existing || remote.ts > existing.ts) {
      store.put({ key: levelKey(user, cardId), user, cardId, stufe: remote.stufe, ts: remote.ts });
    }
  }
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// Entfernt alle Stufen-Einträge eines Nutzers, die vor oder bei resetAt entstanden sind
// (Stufen-Reset: die Karte gilt danach wieder als Stufe 1).
export async function deleteLevelsUpTo(user, resetAt) {
  const stale = (await getAllLevels(user)).filter((l) => l.ts <= resetAt);
  if (stale.length === 0) return;
  const { t, store } = await tx(STORE_LEVELS, "readwrite");
  for (const l of stale) store.delete(l.key);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function clearAllLevels(user) {
  const all = await getAllLevels(user);
  const { t, store } = await tx(STORE_LEVELS, "readwrite");
  for (const l of all) store.delete(l.key);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// ---------- Persönliche Prio (nur für den jeweiligen Nutzer) ----------
// Die Grund-Prio einer Karte kommt aus dem Kartenbestand (Feld `prio`,
// Grundbestand) bzw. ist „normal" (selbst angelegte Karten). Durch Antippen
// des Prio-Symbols kann jeder Nutzer die Prio für sich selbst ändern, ohne
// die Karte oder die Sicht des anderen Nutzers zu beeinflussen.

export async function getAllPrios(user) {
  const { store } = await tx(STORE_PRIOS, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.index("user").getAll(IDBKeyRange.only(user));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function setPrio(user, cardId, prio, ts) {
  const { t, store } = await tx(STORE_PRIOS, "readwrite");
  store.put({ key: levelKey(user, cardId), user, cardId, prio, ts });
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// CRDT-Merge: pro Karte gewinnt die Version mit dem späteren Zeitstempel (wie bei den Stufen).
export async function mergePrios(user, remotePrios) {
  const local = await getAllPrios(user);
  const localByCard = new Map(local.map((p) => [p.cardId, p]));
  const { t, store } = await tx(STORE_PRIOS, "readwrite");
  for (const [cardId, remote] of Object.entries(remotePrios ?? {})) {
    const existing = localByCard.get(cardId);
    if (!existing || remote.ts > existing.ts) {
      store.put({ key: levelKey(user, cardId), user, cardId, prio: remote.prio, ts: remote.ts });
    }
  }
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// Effektive Prio einer Karte für einen Nutzer: persönliche Änderung, sonst die Grund-Prio der Karte.
export function effectivePrio(card, priosByCard) {
  return priosByCard?.get(cardKey(card))?.prio ?? card.prio ?? "normal";
}

export function nextPrio(prio) {
  if (prio === "hoch") return "normal";
  if (prio === "normal") return "niedrig";
  return "hoch";
}

// ---------- Statistik-Ereignisse ----------

export async function addEvent(event) {
  const { t, store } = await tx(STORE_EVENTS, "readwrite");
  store.put(event);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve(event);
    t.onerror = () => reject(t.error);
  });
}

export async function getAllEvents(user) {
  const { store } = await tx(STORE_EVENTS, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.index("user").getAll(IDBKeyRange.only(user));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function mergeEvents(user, remoteEvents, resetAt) {
  const { t, store } = await tx(STORE_EVENTS, "readwrite");
  for (const e of remoteEvents) {
    if (e.user !== user) continue;
    if (resetAt && e.ts <= resetAt) continue;
    store.put(e);
  }
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function deleteEventsUpTo(user, resetAt) {
  const stale = (await getAllEvents(user)).filter((e) => e.ts <= resetAt);
  if (stale.length === 0) return;
  const { t, store } = await tx(STORE_EVENTS, "readwrite");
  for (const e of stale) store.delete(e.id);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// ---------- Meldungen (Flags) ----------
// Jede Meldung bezieht sich auf eine Karte und ein Feld ("frage" oder
// "antwort"). Offene Meldungen (status "open") blenden die betroffene Karte
// für ALLE Nutzer aus allen Kartenlisten aus, bis sie im Modus „Flaggs
// beheben" bearbeitet oder die Karte gelöscht wird (siehe applyOverridesAndFilter).

export async function addFlag(flag) {
  const { t, store } = await tx(STORE_FLAGS, "readwrite");
  store.put(flag);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve(flag);
    t.onerror = () => reject(t.error);
  });
}

export async function getFlag(id) {
  const { store } = await tx(STORE_FLAGS, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllFlags() {
  const { store } = await tx(STORE_FLAGS, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getOpenFlags() {
  return (await getAllFlags()).filter((f) => f.status === "open");
}

// Setzt alle offenen Meldungen einer Karte auf "resolved" (nach Bearbeiten
// oder Löschen der Karte). Der neue Zeitstempel sorgt dafür, dass sich diese
// Änderung beim Zusammenführen (CRDT, späterer Zeitstempel gewinnt) korrekt
// gegenüber älteren, noch offenen Ständen durchsetzt.
export async function resolveOpenFlagsForCard(cardId, ts) {
  const open = (await getAllFlags()).filter((f) => f.cardId === cardId && f.status === "open");
  for (const f of open) await addFlag({ ...f, status: "resolved", ts });
}

// CRDT-Merge: pro Meldung (nach id) gewinnt die Version mit dem späteren
// Zeitstempel, genau wie bei den Kartenstufen.
export async function mergeFlags(remoteFlags) {
  for (const [id, remote] of Object.entries(remoteFlags ?? {})) {
    const existing = await getFlag(id);
    if (!existing || remote.ts > existing.ts) await addFlag({ ...remote, id });
  }
}

// ---------- Korrekturen/Löschungen einzelner Karten (cardEdits) ----------
// Ein Eintrag je Karte, überschreibt beim Anzeigen/Lernen die entsprechenden
// Felder der Basis-Karte (egal ob Grundbestand oder von einem Nutzer
// angelegt). `deleted: true` blendet die Karte überall aus.

export async function getCardEdit(cardId) {
  const { store } = await tx(STORE_CARD_EDITS, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.get(cardId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllCardEdits() {
  const { store } = await tx(STORE_CARD_EDITS, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function setCardEdit(edit) {
  const { t, store } = await tx(STORE_CARD_EDITS, "readwrite");
  store.put(edit);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve(edit);
    t.onerror = () => reject(t.error);
  });
}

// CRDT-Merge: pro Karte (cardId) gewinnt die Version mit dem späteren Zeitstempel.
export async function mergeCardEdits(remoteEdits) {
  for (const [cardId, remote] of Object.entries(remoteEdits ?? {})) {
    const existing = await getCardEdit(cardId);
    if (!existing || remote.ts > existing.ts) await setCardEdit({ ...remote, cardId });
  }
}

function mergeCardWithEdit(card, edit) {
  if (!edit) return card;
  // Wurde die Karte im Repo nach der In-App-Korrektur inhaltlich überarbeitet
  // (`korrigiert`), gilt die neuere Repo-Fassung; die ältere Korrektur ist überholt.
  if (card.korrigiert && edit.ts < card.korrigiert) return card;
  return {
    ...card,
    frage: edit.frage ?? card.frage,
    antworten: edit.antworten ?? card.antworten,
    falsche: edit.falsche ?? card.falsche,
    erklaerung: edit.erklaerung ?? card.erklaerung,
  };
}

// Zentrale Funktion, die JEDE Kartenliste durchläuft (Karteikarten- und
// Frage-Antwort-Warteschlange, Rechtsgebiets-/Stufenzählung): wendet
// cardEdits-Korrekturen an und blendet Karten mit `deleted: true` oder
// mindestens einer offenen Meldung global aus, für alle Nutzer.
export async function applyOverridesAndFilter(cards) {
  const editsByCard = new Map((await getAllCardEdits()).map((e) => [e.cardId, e]));
  const openCardIds = new Set((await getOpenFlags()).map((f) => f.cardId));
  const out = [];
  for (const c of cards) {
    const key = cardKey(c);
    const edit = editsByCard.get(key);
    if (edit?.deleted) continue;
    if (openCardIds.has(key)) continue;
    const base = c.id === key ? c : { ...c, id: key };
    out.push(mergeCardWithEdit(base, edit));
  }
  return out;
}

// Für den Modus „Flaggs beheben": liefert eine Karte (mit bereits
// angewendeten Korrekturen) anhand ihrer cardId, unabhängig davon, ob sie
// gerade eine offene Meldung hat (die soll hier ja gerade bearbeitet werden).
export async function overlayCardById(baseCards, cardId) {
  const base = baseCards.find((c) => cardKey(c) === cardId);
  if (!base) return null;
  const edit = await getCardEdit(cardId);
  const normalized = base.id === cardId ? base : { ...base, id: cardId };
  return mergeCardWithEdit(normalized, edit);
}

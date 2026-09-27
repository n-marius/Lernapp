// Lokale Datenhaltung (IndexedDB), Vorbild: ukr-app js/store.js.
//
// Gespeichert wird pro Gerät:
//  - settings          Schlüssel/Wert (u. a. aktueller Nutzer, Sync-Zugang)
//  - userCards         von Marius/Agnessa selbst angelegte Karten (geteilter Inhalt)
//  - levels            Leitner-Stufe je Nutzer und Karte: { key: "user:cardId", user, cardId, stufe, ts }
//  - events            bearbeitete Karten je Nutzer (für die Tagesstatistik), append-only
//
// Der Grundbestand an Karten (content/*.json) wird NICHT hier gespeichert,
// sondern beim Start als content/index.json geladen (siehe js/app.js).

const DB_NAME = "lernapp";
const DB_VERSION = 1;
const STORE_SETTINGS = "settings";
const STORE_USER_CARDS = "userCards";
const STORE_LEVELS = "levels";
const STORE_EVENTS = "events";

export const USERS = ["marius", "agnessa"];
export const GEBIETE = ["zivilgericht", "strafrecht", "rechtsanwalt", "verwaltungsrecht"];
export const STUFEN = [1, 2, 3, 4, 5];

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
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const store = db.createObjectStore(STORE_EVENTS, { keyPath: "id" });
        store.createIndex("user", "user", { unique: false });
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

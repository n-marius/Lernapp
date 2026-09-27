// Gist-Sync (ein gemeinsames, privates Gist für beide Nutzer).
// Vorbild: ukr-app js/sync.js, hier erweitert um mehrere Nutzer und um die
// von den Nutzern selbst angelegten Karten.
//
// Datei im Gist: stats.json
// {
//   "v": 1,
//   "cards": [ { uuid, gebiet, frage, antworten: [4], erklaerung, creator, ts }, ... ],
//   "users": {
//     "marius":  { "resetAt": null, "levelsResetAt": null, "levels": { "<cardId>": { "stufe": 1, "ts": "…" } }, "events": [ { id, ts, cardId, correct, mode } ] },
//     "agnessa": { … }
//   }
// }
//
// Merge-Regeln:
//  - cards: Vereinigung nach uuid (append-only, Karten werden nie geändert oder gelöscht).
//  - je Nutzer levels: pro Karte gewinnt der Eintrag mit dem späteren Zeitstempel (CRDT, kein Konflikt möglich).
//  - je Nutzer events: Vereinigung nach id (append-only), Einträge <= resetAt werden verworfen.
//  - je Nutzer resetAt / levelsResetAt: jeweils der spätere Wert aus lokal und Gist gilt auf allen Geräten.
import {
  USERS,
  getSetting,
  setSetting,
  getAllUserCards,
  mergeUserCards,
  getAllLevels,
  mergeLevels,
  deleteLevelsUpTo,
  clearAllLevels,
  getAllEvents,
  mergeEvents,
  deleteEventsUpTo,
} from "./store.js";

const API = "https://api.github.com";
const FILE = "stats.json";
let inflight = null;

export async function getSyncConfig() {
  return {
    token: await getSetting("gistToken", ""),
    gistId: await getSetting("gistId", ""),
    lastSync: await getSetting("lastSync", null),
    lastError: await getSetting("lastSyncError", null),
  };
}

export async function setSyncConfig({ token, gistId }) {
  if (token !== undefined) await setSetting("gistToken", token);
  if (gistId !== undefined) await setSetting("gistId", gistId);
}

// Mehrere gleichzeitige Aufrufe teilen sich einen Lauf (verhindert doppelt angelegte Gists).
export function sync() {
  if (!inflight) inflight = run().finally(() => { inflight = null; });
  return inflight;
}

export async function resetStatsForUser(user) {
  const now = new Date().toISOString();
  await setSetting(`resetAt_${user}`, now);
  await deleteEventsUpTo(user, now);
  await sync();
}

export async function resetLevelsForUser(user) {
  const now = new Date().toISOString();
  await setSetting(`levelsResetAt_${user}`, now);
  await clearAllLevels(user);
  await sync();
}

async function levelsAsObject(user) {
  const levels = await getAllLevels(user);
  return Object.fromEntries(levels.map((l) => [l.cardId, { stufe: l.stufe, ts: l.ts }]));
}

async function run() {
  const { token, gistId } = await getSyncConfig();
  if (!token) return { skipped: true };
  if (!navigator.onLine) return { offline: true };

  try {
    let id = gistId;
    let remote = { cards: [], users: {} };

    if (id) {
      const res = await fetch(`${API}/gists/${encodeURIComponent(id)}`, { headers: headers(token), cache: "no-store" });
      if (!res.ok) throw new Error(describe(res.status, "Laden"));
      const gist = await res.json();
      const content = gist.files?.[FILE]?.content;
      if (content) {
        const parsed = JSON.parse(content);
        remote = { cards: parsed.cards ?? [], users: parsed.users ?? {} };
      }
    }

    // Karten: einfache Vereinigung nach uuid.
    const beforeCards = await getAllUserCards();
    await mergeUserCards(remote.cards);

    let changed = false;
    const usersOut = {};

    for (const user of USERS) {
      const remoteUser = remote.users[user] ?? {};

      const localResetAt = await getSetting(`resetAt_${user}`, null);
      const resetAt = [localResetAt, remoteUser.resetAt].filter(Boolean).sort().at(-1) ?? null;
      if (resetAt && resetAt !== localResetAt) {
        await setSetting(`resetAt_${user}`, resetAt);
        await deleteEventsUpTo(user, resetAt);
      }

      const localLevelsResetAt = await getSetting(`levelsResetAt_${user}`, null);
      const levelsResetAt = [localLevelsResetAt, remoteUser.levelsResetAt].filter(Boolean).sort().at(-1) ?? null;
      if (levelsResetAt && levelsResetAt !== localLevelsResetAt) {
        await setSetting(`levelsResetAt_${user}`, levelsResetAt);
        await deleteLevelsUpTo(user, levelsResetAt);
      }

      const beforeEvents = await getAllEvents(user);
      await mergeEvents(user, remoteUser.events ?? [], resetAt);
      const mergedEvents = (await getAllEvents(user)).filter((e) => !resetAt || e.ts > resetAt);

      await mergeLevels(user, remoteUser.levels ?? {}, levelsResetAt);
      const mergedLevels = await levelsAsObject(user);

      if (mergedEvents.length !== beforeEvents.length) changed = true;
      if (Object.keys(mergedLevels).length !== Object.keys(remoteUser.levels ?? {}).length) changed = true;

      usersOut[user] = { resetAt, levelsResetAt, levels: mergedLevels, events: mergedEvents };
    }

    const mergedCards = await getAllUserCards();
    if (mergedCards.length !== beforeCards.length) changed = true;
    if (mergedCards.length !== remote.cards.length) changed = true;

    const needsWrite = !id || changed;

    if (needsWrite) {
      const body = {
        description: "Karteikarten Staatsexamen · Fortschritt und Karten",
        public: false,
        files: { [FILE]: { content: JSON.stringify({ v: 1, cards: mergedCards, users: usersOut }, null, 2) } },
      };
      const res = await fetch(id ? `${API}/gists/${encodeURIComponent(id)}` : `${API}/gists`, {
        method: id ? "PATCH" : "POST",
        headers: headers(token),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(describe(res.status, "Speichern"));
      id = (await res.json()).id;
      await setSetting("gistId", id);
    }

    await setSetting("lastSync", new Date().toISOString());
    await setSetting("lastSyncError", null);
    return { ok: true, changed };
  } catch (err) {
    const message = err instanceof TypeError ? "Keine Verbindung zu GitHub." : String(err.message ?? err);
    await setSetting("lastSyncError", message);
    return { ok: false, error: message };
  }
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

function describe(status, action) {
  if (status === 401) return "Token ungültig oder abgelaufen.";
  if (status === 403) return "Token hat keine Berechtigung für Gists.";
  if (status === 404) return "Gist nicht gefunden – Gist-ID prüfen.";
  return `${action} fehlgeschlagen (HTTP ${status}).`;
}

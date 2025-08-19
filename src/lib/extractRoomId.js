// src/lib/extractRoomId.js

// Accept the IDs your backend generates (e.g. 6 uppercase hex chars like FB5075)
export function isValidId(v) {
  return typeof v === "string" && /^[0-9A-F]{4,10}$/.test(v);
}

// Heuristics for extracting an id from arbitrary JSON/headers/text.
export function extractRoomId(responseLike) {
  if (!responseLike) return undefined;

  const data = responseLike.data ?? responseLike;
  const headers = responseLike?.headers?.get
    ? Object.fromEntries(responseLike.headers.entries())
    : (responseLike.headers || {});
  const rawText = responseLike.rawText || "";

  // 1) Try common shapes in order
  const candidates = [
    data,
    data?.data,
    data?.result,
    data?.payload,
    data?.room,
    Array.isArray(data) ? data[0] : null,
  ].filter(Boolean);

  for (const c of candidates) {
    const v = pickId(c);
    if (isValidId(v)) return v;
  }

  // 2) Deep search anywhere in the object
  const deep = deepFindId(data);
  if (isValidId(deep)) return deep;

  // 3) Look for a Location header like /room/ABC123
  const locHeader = headers.location || headers.Location;
  const fromLoc = extractFromUrlish(locHeader);
  if (isValidId(fromLoc)) return fromLoc;

  // 4) Try any url-ish strings or simple id assignments in raw text
  const fromTextUrl = extractFromUrlish(rawText);
  if (isValidId(fromTextUrl)) return fromTextUrl;

  const fromAssign = matchIdAssignment(rawText);
  if (isValidId(fromAssign)) return fromAssign;

  return undefined;
}

/* ----------------------------- helpers ----------------------------- */

function pickId(o) {
  if (!o || typeof o !== "object") return undefined;

  const keys = [
    "id", "_id",
    "roomId", "room_id",
    "sessionId", "session_id",
    "receiptId", "receipt_id",
    "room", // sometimes it's just a string
    "slug", // some backends use slugs as ids
  ];

  for (const k of keys) {
    const id = normalizeId(o?.[k]);
    if (id) return id;
  }

  // fall through nested common containers
  const nested = o?.room || o?.data || o?.result || o?.payload;
  if (nested) return pickId(nested);

  return undefined;
}

function deepFindId(o, seen = new Set()) {
  if (!o || typeof o !== "object" || seen.has(o)) return undefined;
  seen.add(o);

  for (const [k, v] of Object.entries(o)) {
    const id = normalizeId(v, k);
    if (id) return id;
  }
  for (const v of Object.values(o)) {
    if (typeof v === "object") {
      const found = deepFindId(v, seen);
      if (found) return found;
    }
  }
  return undefined;
}

function normalizeId(value, keyHint = "") {
  if (value == null) return undefined;

  if (typeof value === "string") {
    const fromUrl = extractFromUrlish(value);
    if (fromUrl) return fromUrl;

    const trimmed = value.trim();
    if (isValidId(trimmed)) return trimmed;
  }

  if (typeof value === "number") {
    const s = String(value);
    if (isValidId(s)) return s;
  }

  if (keyHint && /(^|_)(room)?id$/i.test(keyHint)) {
    const s = String(value);
    if (isValidId(s)) return s;
  }

  return undefined;
}

function extractFromUrlish(s) {
  if (typeof s !== "string") return undefined;
  // e.g. "/room/ABC123" or "https://x/room/ABC123"
  const m = s.match(/\/room\/([0-9A-F]{4,10})/i);
  return m ? m[1].toUpperCase() : undefined;
}

function matchIdAssignment(text) {
  if (typeof text !== "string" || !text) return undefined;
  // e.g. roomId: "ABC123", id=FB5075
  const m = text.match(
    /\b(roomId|room_id|sessionId|session_id|receiptId|receipt_id|id)\b\s*[:=]\s*["']?([0-9A-F]{4,10})["']?/i
  );
  return m ? m[2].toUpperCase() : undefined;
}

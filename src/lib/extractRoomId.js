// src/lib/extractRoomId.js

// Exported so pages can validate before navigating
export function isValidId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{4,}$/.test(id);
}

// Heuristics for extracting an id from arbitrary JSON or headers/text.
export function extractRoomId(responseLike) {
  if (!responseLike) return undefined;

  const data = responseLike.data ?? responseLike;
  const headers =
    responseLike?.headers?.get
      ? Object.fromEntries(responseLike.headers.entries())
      : (responseLike.headers || {});
  const rawText = responseLike.rawText || "";

  // 1) Direct keys we expect across a few common containers
  const candidates = [
    data,
    data?.data,
    data?.result,
    data?.payload,
    data?.room,
    Array.isArray(data) ? data[0] : undefined,
  ].filter(Boolean);

  for (const obj of candidates) {
    const direct = pickId(obj);
    if (direct) return direct;
  }

  // 2) Deep search anywhere in the object
  const deep = deepFindId(data);
  if (deep) return deep;

  // 3) Look for a Location header like /room/abc123
  const loc = headers.location || headers.Location;
  const fromLocation = extractFromUrlish(loc);
  if (fromLocation) return fromLocation;

  // 4) Try any url-ish strings or simple id assignments in raw text
  const fromTextUrl = extractFromUrlish(rawText);
  if (fromTextUrl) return fromTextUrl;

  const fromTextAssign = matchIdAssignment(rawText);
  if (fromTextAssign) return fromTextAssign;

  return undefined;
}

// ---- helpers ----

function pickId(o) {
  if (!o || typeof o !== "object") return undefined;
  const keys = [
    "roomId", "room_id",
    "id", "_id",
    "sessionId", "session_id",
    "receiptId", "receipt_id",
    "room",
    "slug",
  ];
  for (const k of keys) {
    const v = o?.[k];
    const id = normalizeId(v, k);
    if (id) return id;
  }
  // nested common containers
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
    if (/^[A-Za-z0-9_-]{4,}$/.test(value)) return value.trim();
  }
  if (typeof value === "number") return String(value);

  if (keyHint && /(^|_)(room)?id$/i.test(keyHint)) {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return undefined;
}

function extractFromUrlish(s) {
  if (typeof s !== "string") return undefined;
  const m = s.match(/\/room\/([A-Za-z0-9_-]{4,})/);
  return m ? m[1] : undefined;
}

function matchIdAssignment(text) {
  if (typeof text !== "string" || !text) return undefined;
  const m = text.match(
    /\b(roomId|room_id|sessionId|session_id|receiptId|receipt_id|id)\b\s*[:=]\s*["']?([A-Za-z0-9_-]{4,})["']?/
  );
  return m ? m[2] : undefined;
}

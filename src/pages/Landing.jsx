// src/lib/extractRoomId.js

// Heuristics for extracting an id from arbitrary JSON, headers, or raw text.
export function extractRoomId(responseLike) {
  if (!responseLike) return undefined;

  const data = responseLike.data ?? responseLike;
  const rawText = responseLike.rawText || "";
  const getHeader =
    responseLike?.headers?.get
      ? (k) => responseLike.headers.get(k)
      : (k) => responseLike?.headers?.[k];

  // 1) Try common containers in order (without mixing ?? and ||)
  const direct =
    pickId(data) ||
    pickId(data?.data) ||
    pickId(data?.result) ||
    pickId(data?.payload) ||
    pickId(data?.room) ||
    (Array.isArray(data) ? pickId(data[0]) : undefined);
  if (direct) return direct;

  // 2) Deep scan anywhere in the object
  const deep = deepFindId(data);
  if (deep) return deep;

  // 3) Location header like /room/abc123
  const loc = getHeader("location") || getHeader("Location");
  const fromLoc = extractFromUrlish(loc);
  if (fromLoc) return fromLoc;

  // 4) Raw text fallbacks
  const fromTextUrl = extractFromUrlish(rawText);
  if (fromTextUrl) return fromTextUrl;

  const fromAssign = matchIdAssignment(rawText);
  if (fromAssign) return fromAssign;

  return undefined;
}

// ---- helpers ----

function pickId(o) {
  if (!o || typeof o !== "object") return undefined;
  const candidates = [
    "roomId", "room_id",
    "id", "_id",
    "sessionId", "session_id",
    "receiptId", "receipt_id",
    "room",
    "slug",
  ];
  for (const k of candidates) {
    const id = normalizeId(o[k], k);
    if (id) return id;
  }
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
    if (/^[A-Za-z0-9_-]{4,}$/.test(value.trim())) return value.trim();
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

// src/lib/extractRoomId.js

// Public: basic shape check (backend creates 6-char hex like B0A414, but allow general ids too)
export function isValidId(s) {
   return typeof v === "string" && /^[0-9A-F]{4,10}$/.test(v);
}

// ---- helpers ----
function extractFromUrlish(s) {
  if (typeof s !== "string") return undefined;
  // match ".../room/ABC123" or "https://.../room/ABC123"
  const m = s.match(/\/room\/([A-Za-z0-9_-]{2,})/);
  return m ? m[1] : undefined;
}

function matchIdAssignment(text) {
  if (typeof text !== "string" || !text) return undefined;
  // e.g. roomId: "abc123", room_id='xyz', id=abcd-123
  const m = text.match(
    /\b(roomId|room_id|sessionId|session_id|receiptId|receipt_id|id)\b\s*[:=]\s*["']?([A-Za-z0-9_-]{2,})["']?/
  );
  return m ? m[2] : undefined;
}

function normalizeId(value, keyHint = "") {
  if (value == null) return undefined;

  if (typeof value === "string") {
    // Try URLish first
    const fromUrl = extractFromUrlish(value);
    if (fromUrl) return fromUrl;

     const trimmed = value.trim();

    // raw id
    if (/^[A-Z0-9_-]{4,10}$/.test(trimmed)) return trimmed;
  }

  if (typeof value === "number") return String(value);

  // If key looks id-like and value is primitive
  if (keyHint && /(^|_)(room)?id$/i.test(keyHint)) {
    if (typeof value === "string") return value.trim();
      }

  return undefined;
}
  


function pickId(o) {
  if (!o || typeof o !== "object") return undefined;

  // direct candidate keys
  const candidates = [
    "roomId", "room_id",
    "id", "_id",
    "sessionId", "session_id",
    "receiptId", "receipt_id",
    "room", // sometimes room itself is an id string
    "slug",
  ];

  for (const k of candidates) {
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

  // key/value heuristics
  for (const [k, v] of Object.entries(o)) {
    const id = normalizeId(v, k);
    if (id) return id;
  }

  // traverse deeper
  for (const v of Object.values(o)) {
    if (typeof v === "object") {
      const found = deepFindId(v, seen);
      if (found) return found;
    }
  }
  return undefined;
}
export function isValidId(v) {
  return typeof v === "string" && /^[0-9A-F]{4,10}$/.test(v); // 4–10 uppercase hex/underscore/dash; tweak if needed
}
// -------------------- main API --------------------
export function extractRoomId(responseLike) {
  if (!responseLike) return undefined;

  const data = responseLike.data ?? responseLike;
  const headers = responseLike?.headers || {};
  const rawText = responseLike.rawText || "";

  // 1) Common shapes (evaluate each separately; no mixing ?? with ||)
  const direct =
    pickId(data) ??
    pickId(data?.data) ??
    pickId(data?.result) ??
    pickId(data?.payload) ??
    pickId(data?.room) ??
    (Array.isArray(data) ? pickId(data[0]) : undefined);
  if (direct) return direct;

  // 2) Deep search anywhere in the object
  const deep = deepFindId(data);
  if (deep) return deep;

  // 3) Location header like /room/abc123
  const loc = headers.location || headers.Location;
  const fromLocation = extractFromUrlish(loc);
  if (fromLocation) return fromLocation;

  // 4) Raw text hints
  const fromTextUrl = extractFromUrlish(rawText);
  if (fromTextUrl) return fromTextUrl;

  const fromTextAssign = matchIdAssignment(rawText);
  if (fromTextAssign) return fromTextAssign;

  return undefined;
}

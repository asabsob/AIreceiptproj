// src/lib/extractRoomId.js
export function isValidId(v) {
  // backend newRoomId() creates uppercase hex
  return typeof v === "string" && /^[0-9A-F]{4,10}$/.test(v); 
}

export function extractRoomId(responseLike) {
  if (!responseLike) return;
  const data = responseLike.data ?? responseLike;
  const headers = responseLike?.headers?.get
    ? Object.fromEntries(responseLike.headers.entries())
    : (responseLike.headers || {});
  const rawText = responseLike.rawText || "";

  const direct = pickId(data && (data.data || data.result || data.payload || data.room || data));
  if (isValidId(direct)) return direct;

  const deep = deepFindId(data);
  if (isValidId(deep)) return deep;

  const loc = headers.location || headers.Location;
  const fromLoc = extractFromUrlish(loc);
  if (isValidId(fromLoc)) return fromLoc;

  const fromUrl = extractFromUrlish(rawText);
  if (isValidId(fromUrl)) return fromUrl;

  const fromAssign = matchIdAssignment(rawText);
  if (isValidId(fromAssign)) return fromAssign;

  return;
}

function pickId(o) {
  if (!o || typeof o !== "object") return;
  const keys = ["roomId","room_id","id","_id","sessionId","session_id","receiptId","receipt_id","room","slug"];
  for (const k of keys) {
    const v = o?.[k];
    const id = normalizeId(v);
    if (id) return id;
  }
  const nested = o?.room || o?.data || o?.result || o?.payload;
  if (nested) return pickId(nested);
}

function deepFindId(o, seen = new Set()) {
  if (!o || typeof o !== "object" || seen.has(o)) return;
  seen.add(o);
  for (const [k, v] of Object.entries(o)) {
    const id = normalizeId(v);
    if (id) return id;
    if (v && typeof v === "object") {
      const found = deepFindId(v, seen);
      if (found) return found;
    }
  }
}

function normalizeId(value) {
  if (typeof value !== "string") return;              // ← do NOT accept numbers anymore
  const fromUrl = extractFromUrlish(value);
  if (fromUrl) return fromUrl;
  if (/^[A-F0-9]{4,10}$/.test(value)) return value.trim();
}

function extractFromUrlish(s) {
  if (typeof s !== "string") return;
  const m = s.match(/\/room\/([A-F0-9]{4,10})/);
  return m?.[1];
}

function matchIdAssignment(text) {
  if (typeof text !== "string" || !text) return;
  const m = text.match(/\b(roomId|room_id|sessionId|session_id|receiptId|receipt_id|id)\b\s*[:=]\s*["']?([A-F0-9]{4,10})["']?/);
  return m?.[2];
}

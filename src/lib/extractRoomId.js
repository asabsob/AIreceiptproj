// src/lib/extractRoomId.js
export function isValidId(v) {
  return typeof v === "string" && /^[0-9A-Z_-]{4,}$/.test(v);
}

export function extractRoomId(responseLike) {
  if (!responseLike) return;

  const data = responseLike.data ?? responseLike;
  const headers =
    responseLike?.headers?.get
      ? Object.fromEntries(responseLike.headers.entries())
      : (responseLike.headers || {});
  const rawText = responseLike.rawText || "";

  // direct fields
  const direct = pickId(
    data && (data.data || data.result || data.payload || data.room || data)
  );
  if (direct) return direct;

  // deep search
  const deep = deepFindId(data);
  if (deep) return deep;

  // Location header (/room/ABC123)
  const loc = headers.location || headers.Location;
  const fromLoc = extractFromUrlish(loc);
  if (fromLoc) return fromLoc;

  // raw text url-ish or assignments
  const fromUrl = extractFromUrlish(rawText);
  if (fromUrl) return fromUrl;

  const fromAssign = matchIdAssignment(rawText);
  if (fromAssign) return fromAssign;

  return;
}

function pickId(o) {
  if (!o || typeof o !== "object") return;
  const keys = ["roomId","room_id","id","_id","sessionId","session_id","receiptId","receipt_id","room","slug"];
  for (const k of keys) {
    const v = o?.[k];
    const id = normalizeId(v, k);
    if (id) return id;
  }
  const nested = o?.room || o?.data || o?.result || o?.payload;
  if (nested) return pickId(nested);
}

function deepFindId(o, seen = new Set()) {
  if (!o || typeof o !== "object" || seen.has(o)) return;
  seen.add(o);
  for (const [k, v] of Object.entries(o)) {
    const id = normalizeId(v, k);
    if (id) return id;
    if (v && typeof v === "object") {
      const found = deepFindId(v, seen);
      if (found) return found;
    }
  }
}

function normalizeId(value, keyHint = "") {
  if (value == null) return;
  if (typeof value === "string") {
    const fromUrl = extractFromUrlish(value);
    if (fromUrl) return fromUrl;
    if (/^[A-Za-z0-9_-]{4,}$/.test(value)) return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (keyHint && /(^|_)(room)?id$/i.test(keyHint)) {
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
}

function extractFromUrlish(s) {
  if (typeof s !== "string") return;
  const m = s.match(/\/room\/([A-Za-z0-9_-]{4,})/);
  return m?.[1];
}

function matchIdAssignment(text) {
  if (typeof text !== "string" || !text) return;
  const m = text.match(/\b(roomId|room_id|sessionId|session_id|receiptId|receipt_id|id)\b\s*[:=]\s*["']?([A-Za-z0-9_-]{4,})["']?/);
  return m?.[2];
}

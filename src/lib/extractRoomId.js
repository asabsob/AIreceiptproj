// Heuristics for extracting an id from arbitrary JSON or headers/text.

export function isValidId(v) {
  // allow 1–64 chars, letters/numbers/_/-, and NO dots (prevents 41.46)
  return typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
}

export function extractRoomId(responseLike) {
  if (!responseLike) return undefined;

  const data = responseLike.data ?? responseLike;
  const headers =
    responseLike?.headers?.get
      ? Object.fromEntries(responseLike.headers.entries())
      : (responseLike.headers || {});
  const rawText = responseLike.rawText || "";

  // 1) Try common containers in order (no ?? with ||)
  const roots = [
    data,
    data?.data,
    data?.result,
    data?.payload,
    data?.room,
    Array.isArray(data) ? data[0] : null,
  ].filter((x) => x != null);

  for (const root of roots) {
    const id = pickId(root);
    if (isValidId(id)) return id;
  }

  // 2) Deep search
  const deep = deepFindId(data);
  if (isValidId(deep)) return deep;

  // 3) Location header like /room/abc or /session/123
  const fromLocation = extractFromUrlish(headers.location || headers.Location);
  if (isValidId(fromLocation)) return fromLocation;

  // 4) Raw text
  const fromTextUrl = extractFromUrlish(rawText);
  if (isValidId(fromTextUrl)) return fromTextUrl;

  const fromTextAssign = matchIdAssignment(rawText);
  if (isValidId(fromTextAssign)) return fromTextAssign;

  return undefined;
}

/* -------------------- helpers -------------------- */

function pickId(o) {
  if (!o || typeof o !== "object") return undefined;

  // direct keys we trust
  const candidates = [
    "roomId", "room_id",
    "id", "_id",
    "sessionId", "session_id", "session", // <— added "session"
    "receiptId", "receipt_id",
    "room", "slug",
  ];
  for (const k of candidates) {
    const v = o?.[k];
    const id = normalizeId(v, k);
    if (isValidId(id)) return id;
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
    if (isValidId(id)) return id;
  }
  for (const v of Object.values(o)) {
    if (typeof v === "object") {
      const found = deepFindId(v, seen);
      if (isValidId(found)) return found;
    }
  }
  return undefined;
}

function normalizeId(value, keyHint = "") {
  if (value == null) return undefined;

  // never confuse amounts with ids
  if (keyHint && /(total|subtotal|amount|price|tax|grand|balance)/i.test(keyHint)) {
    return undefined;
  }

  if (typeof value === "string") {
    // reject anything with dots to avoid 41.46
    if (value.includes(".")) return undefined;

    // allow extracting from url-ish strings
    const fromUrl = extractFromUrlish(value);
    if (fromUrl) return fromUrl;

    if (/^[A-Za-z0-9_-]{1,64}$/.test(value)) return value.trim();
    return undefined;
  }

  if (typeof value === "number") {
    // allow pure numbers ONLY when the key looks like an id or "session"/"room"
    if (keyHint && /(^|_)(room|session|receipt)?id$/i.test(keyHint) || /^(room|session)$/i.test(keyHint)) {
      const s = String(value);
      if (/^[0-9]{1,64}$/.test(s)) return s; // still rejects decimals
    }
    return undefined;
  }

  return undefined;
}

function extractFromUrlish(s) {
  if (typeof s !== "string") return undefined;
  // e.g. "/room/abc-123" or ".../session/42"
  const m = s.match(/\/(room|session)\/([A-Za-z0-9_-]{1,64})/);
  return m ? m[2] : undefined;
}

function matchIdAssignment(text) {
  if (typeof text !== "string" || !text) return undefined;
  // e.g. session: 42, roomId: "abc123", id=xyz_456
  const m = text.match(
    /\b(roomId|room_id|sessionId|session_id|session|receiptId|receipt_id|id)\b\s*[:=]\s*["']?([A-Za-z0-9_-]{1,64})["']?/
  );
  return m ? m[2] : undefined;
}

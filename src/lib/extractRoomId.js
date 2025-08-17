// Heuristics for extracting an id from arbitrary JSON or headers/text.

export function isValidId(v) {
  // only letters, numbers, underscore, dash; length 4–64
  return typeof v === "string" && /^[A-Za-z0-9_-]{4,64}$/.test(v);
}

export function extractRoomId(responseLike) {
  if (!responseLike) return undefined;

  const data = responseLike.data ?? responseLike;
  const headers =
    responseLike?.headers?.get
      ? Object.fromEntries(responseLike.headers.entries())
      : (responseLike.headers || {});
  const rawText = responseLike.rawText || "";

  // ---- 1) Try common containers in order (NO nullish/|| mixing) ----
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

  // ---- 2) Deep search (only accept valid id-like values) ----
  const deep = deepFindId(data);
  if (isValidId(deep)) return deep;

  // ---- 3) Location header like /room/abc123 or /session/abc123 ----
  const fromLocation = extractFromUrlish(headers.location || headers.Location);
  if (isValidId(fromLocation)) return fromLocation;

  // ---- 4) Raw text: url-ish or id assignment ----
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
    "sessionId", "session_id",
    "receiptId", "receipt_id",
    "room",    // sometimes it's just a string id
    "slug",    // some backends use slugs
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

  // never treat amounts/prices/totals as IDs
  if (keyHint && /(total|subtotal|amount|price|tax|grand|balance)/i.test(keyHint)) {
    return undefined;
  }

  // If it’s a string, accept only strict id pattern (no dots/spaces)
  if (typeof value === "string") {
    // If it’s a URL, extract last segment after /room/ or /session/
    const fromUrl = extractFromUrlish(value);
    if (fromUrl) return fromUrl;

    if (/^[A-Za-z0-9_-]{4,64}$/.test(value)) return value.trim();
    return undefined;
  }

  // Numbers are ONLY allowed when the key looks like an id key
  if (typeof value === "number") {
    if ((keyHint && /(^|_)(room|session|receipt)?id$/i.test(keyHint))) {
      const s = String(value);
      // still reject decimals like 41.46
      if (/^[0-9]{4,64}$/.test(s)) return s;
    }
    return undefined;
  }

  return undefined;
}

function extractFromUrlish(s) {
  if (typeof s !== "string") return undefined;
  // e.g. "/room/abc-123" or ".../session/xyz_456"
  const m = s.match(/\/(room|session)\/([A-Za-z0-9_-]{4,64})/);
  return m ? m[2] : undefined;
}

function matchIdAssignment(text) {
  if (typeof text !== "string" || !text) return undefined;
  // e.g. roomId: "abc123", session_id='xyz_456', id=abcd-123
  const m = text.match(
    /\b(roomId|room_id|sessionId|session_id|receiptId|receipt_id|id)\b\s*[:=]\s*["']?([A-Za-z0-9_-]{4,64})["']?/
  );
  return m ? m[2] : undefined;
}

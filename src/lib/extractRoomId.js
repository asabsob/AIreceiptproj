// Heuristics for extracting an id from arbitrary JSON or headers/text.

export function isValidId(id) {
  // room ids look like slugs/tokens, not decimals
  return typeof id === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(id);
}

export function extractRoomId(responseLike) {
  if (!responseLike) return undefined;

  const data = responseLike.data ?? responseLike;
  const headers =
    responseLike?.headers?.get
      ? Object.fromEntries(responseLike.headers.entries())
      : (responseLike.headers || {});
  const rawText = responseLike.rawText || "";

  // 1) Direct keys we expect (and common nested containers)
  const direct = pickId(
    data?.data ??
    data?.result ??
    data?.payload ??
    data?.room ??
    data ??
    (Array.isArray(data) ? data[0] : null)
  );
  if (isValidId(direct)) return direct;

  // 2) Deep search anywhere in the object (strict about numbers)
  const deep = deepFindId(data);
  if (isValidId(deep)) return deep;

  // 3) Look for a Location header like /room/abc123
  const loc = headers.location || headers.Location;
  const fromLocation = extractFromUrlish(loc);
  if (isValidId(fromLocation)) return fromLocation;

  // 4) Try any url-ish strings or simple id assignments in raw text
  const fromTextUrl = extractFromUrlish(rawText);
  if (isValidId(fromTextUrl)) return fromTextUrl;

  const fromTextAssign = matchIdAssignment(rawText);
  if (isValidId(fromTextAssign)) return fromTextAssign;

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
    "room", // sometimes it's just a string
    "slug",
  ];
  for (const k of candidates) {
    const v = o?.[k];
    const id = normalizeId(v, k);
    if (isValidId(id)) return id;
  }
  // try nested common containers
  const nested = o?.room || o?.data || o?.result || o?.payload;
  if (nested) return pickId(nested);
  return undefined;
}

function deepFindId(o, seen = new Set()) {
  if (!o || typeof o !== "object" || seen.has(o)) return undefined;
  seen.add(o);

  for (const [k, v] of Object.entries(o)) {
    // ignore obvious money/qty fields
    if (/^(total|subtotal|tax|amount|qty|quantity|price|unit|line)$/i.test(k)) continue;

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

  if (typeof value === "string") {
    // from URL-ish strings
    const fromUrl = extractFromUrlish(value);
    if (fromUrl) return fromUrl;

    // direct token-like string
    if (/^[A-Za-z0-9_-]{4,}$/.test(value)) return value.trim();
    return undefined;
  }

  // Only accept numeric ids when the KEY is id-ish (prevents picking totals)
  if (typeof value === "number" && /(^|_)(room)?id$/i.test(keyHint)) {
    // prevent decimals like 41.46 from sneaking in
    if (Number.isInteger(value) && String(value).length >= 4) return String(value);
    return undefined;
  }

  return undefined;
}

function extractFromUrlish(s) {
  if (typeof s !== "string") return undefined;
  // e.g. "/room/abc-123", "https://x/room/xyz"
  const m = s.match(/\/room\/([A-Za-z0-9_-]{4,})/);
  return m ? m[1] : undefined;
}

function matchIdAssignment(text) {
  if (typeof text !== "string" || !text) return undefined;
  // e.g. roomId: "abc123", room_id='xyz', id=abcd-123
  const m = text.match(/\b(roomId|room_id|sessionId|session_id|receiptId|receipt_id|id)\b\s*[:=]\s*["']?([A-Za-z0-9_-]{4,})["']?/);
  return m ? m[2] : undefined;
}

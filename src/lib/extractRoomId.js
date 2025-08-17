// Heuristics for extracting an id from arbitrary JSON or headers/text.

export function extractRoomId(responseLike) {
  if (!responseLike) return undefined;

  const data = responseLike.data ?? responseLike;
  const headers =
    responseLike?.headers?.get
      ? Object.fromEntries(responseLike.headers.entries())
      : (responseLike.headers || {});
  const rawText = responseLike.rawText || "";

  // 1) Common shapes
  const direct = pickId(
    data ??
      {} ||
      data?.data ||
      data?.result ||
      data?.payload ||
      data?.room ||
      (Array.isArray(data) ? data[0] : null)
  );
  if (isValidId(direct)) return direct;

  // 2) Deep search anywhere in the object
  const deep = deepFindId(data);
  if (isValidId(deep)) return deep;

  // 3) Location header like /room/abc123 or /session/abc123
  const loc = headers.location || headers.Location;
  const fromLocation = extractFromUrlish(loc);
  if (isValidId(fromLocation)) return fromLocation;

  // 4) Try url-ish strings or "id = abc123" fragments in raw text
  const fromTextUrl = extractFromUrlish(rawText);
  if (isValidId(fromTextUrl)) return fromTextUrl;

  const fromTextAssign = matchIdAssignment(rawText);
  if (isValidId(fromTextAssign)) return fromTextAssign;

  return undefined;
}

// ---------------- helpers ----------------

function pickId(o) {
  if (!o || typeof o !== "object") return undefined;
  const candidates = [
    "roomId", "room_id",
    "id", "_id",
    "sessionId", "session_id",
    "session", // some backends use "session"
    "receiptId", "receipt_id",
    "roomCode", "code", "key",
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

  // If it’s a string that looks like a URL, pull the trailing segment
  if (typeof value === "string") {
    const fromUrl = extractFromUrlish(value);
    if (fromUrl) return fromUrl;

    // Otherwise accept id-ish strings only
    if (isValidId(value)) return value.trim();
  }

  // Numbers are accepted only if key looks like *id and value is an integer
  if (typeof value === "number" && /(^|_)(room|session|receipt)?id$/i.test(keyHint)) {
    if (Number.isInteger(value)) {
      return String(value);
    }
  }

  // If the key *explicitly* looks like an id key, accept primitive string
  if (keyHint && /(^|_)(room|session|receipt)?id$/i.test(keyHint)) {
    if (typeof value === "string" && isValidId(value)) return value;
  }

  return undefined;
}

function extractFromUrlish(s) {
  if (typeof s !== "string") return undefined;
  // e.g. "/room/abc-123" or "/session/xyz_789"
  const m = s.match(/\/(room|session)\/([A-Za-z0-9_-]{4,})/);
  return m ? m[2] : undefined;
}

function matchIdAssignment(text) {
  if (typeof text !== "string" || !text) return undefined;
  // e.g. roomId: "abc123", id='xyz_789'
  const m = text.match(
    /\b(roomId|room_id|sessionId|session_id|receiptId|receipt_id|id)\b\s*[:=]\s*["']?([A-Za-z0-9_-]{4,})["']?/,
  );
  return m ? m[2] : undefined;
}

// Stronger validation to avoid picking prices/names like "TEA" or "41.46"
export function isValidId(s) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (!t) return false;

  // Common id formats
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const hex24 = /^[0-9a-f]{24}$/i;                  // Mongo-like
  const ulid = /^[0-9A-HJKMNP-TV-Z]{26}$/;          // ULID
  const simple = /^[A-Za-z0-9_-]{4,64}$/;           // general case (>=4, no dots)

  return uuid.test(t) || hex24.test(t) || ulid.test(t) || simple.test(t);
}

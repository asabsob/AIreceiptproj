// src/lib/extractRoomId.js
const pick = (o) =>
  o?.roomId ?? o?.room_id ??
  o?.id ??
  o?.sessionId ?? o?.session_id ??
  o?.receiptId ?? o?.receipt_id;

export function extractRoomId(responseLike) {
  if (!responseLike) return undefined;

  // normalize axios/fetch/raw shapes
  const data = responseLike?.data ?? responseLike;
  const headers =
    responseLike?.headers?.get
      ? Object.fromEntries(responseLike.headers.entries()) // fetch Headers
      : responseLike?.headers ?? undefined;                // axios headers

  // Try common places
  const fromData =
    pick(data) ||
    pick(data?.room) ||
    pick(data?.data) ||
    pick(data?.result) ||
    pick(data?.payload) ||
    (Array.isArray(data) && pick(data[0])) ||
    (Array.isArray(data?.rooms) && pick(data.rooms[0]));

  if (fromData) return fromData;

  // Fallback: Location header e.g. /room/abc
  const loc = headers?.location ?? headers?.Location;
  if (typeof loc === "string") {
    const last = loc.split("/").filter(Boolean).pop();
    if (last) return last;
  }

  return undefined;
}

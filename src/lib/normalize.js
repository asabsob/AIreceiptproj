// src/lib/normalize.js
export function normalizeReceipt(parsed = {}) {
  const itemsIn = Array.isArray(parsed.items) ? parsed.items : [];

  const items = itemsIn.map((it) => {
    const name = String(it?.name ?? "").trim();
    const qty = Math.max(1, Number(it?.quantity ?? 1) || 1);

    // Prefer explicit unit_price. Otherwise use price.
    let unit = Number(it?.unit_price ?? it?.price ?? 0) || 0;

    // If OCR returned a line total in "price" and qty > 1, convert to unit.
    // (You asked to always treat it as line total in this case.)
    if (!("unit_price" in it) && qty > 1) {
      unit = unit / qty;
    }

    return { name, quantity: qty, price: +Number(unit).toFixed(3) };
  });

  // Subtotal/Tax/Total
  let subtotal =
    parsed.subtotal != null
      ? Number(parsed.subtotal)
      : +items.reduce((a, x) => a + x.price * x.quantity, 0).toFixed(3);

  const tax = parsed.tax != null ? Number(parsed.tax) : null;
  const total =
    parsed.total != null ? Number(parsed.total) : +(subtotal + (tax || 0)).toFixed(3);

  return { items, subtotal, tax, total };
}

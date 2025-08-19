// inside src/pages/Upload.jsx
async function handleFile(file) {
  const form = new FormData();
  form.append("file", file);

  // 1) Parse (optionally ask backend to create if it supports ?create=1)
  const res = await fetch(`${API_BASE}/parse?create=1`, { method: "POST", body: form });

  const headers = Object.fromEntries(res.headers.entries());
  const rawText = await res.clone().text().catch(() => "");
  const data = await res.json().catch(() => ({}));

  console.log("[parse] backend response", { headers, data });

  // Try to read an id straight from the parse response (Location/joinUrl/id, etc.)
  const idFromParse = extractRoomId({ data, headers, rawText });
  if (isValidId(idFromParse)) {
    navigate(`/room/${encodeURIComponent(idFromParse)}`);
    return;
  }

  // 2) Fallback: create a session from parsed items
  const items = Array.isArray(data?.items) ? data.items : [];
  if (items.length > 0) {
    console.log("[upload] creating session…", { itemsCount: items.length });

    const createRes = await fetch(`${API_BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          items,
          subtotal: data?.subtotal ?? null,
          tax: data?.tax ?? null,
          total: data?.total ?? null,
        },
      }),
    });

    if (!createRes.ok) {
      const txt = await createRes.text().catch(() => "");
      throw new Error(`Create session failed: ${createRes.status} ${txt}`);
    }

    const created = await createRes.json().catch(() => ({}));
    console.log("[upload] /session response", created);

    const id =
      extractRoomId({ data: created }) ||
      (String(created?.joinUrl || "").match(/\/room\/([A-Za-z0-9_-]{4,})/) || [])[1];

    if (isValidId(id)) {
      navigate(`/room/${encodeURIComponent(id)}`);
      return;
    }

    alert("Created a session but didn’t get a valid id. Check the /session response in Network.");
    return;
  }

  // 3) No id and no items — tell the user what to check
  alert(
    "Parse returned no items, so I couldn’t create a session.\n\n" +
      "Open DevTools → Network → the /parse request and check the Response.\n" +
      "It must include either an id (or Location header) OR { items:[...] }."
  );
}

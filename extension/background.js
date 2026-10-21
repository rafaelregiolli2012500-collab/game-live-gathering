// Relays events to the game server (background fetch avoids the page's CORS rules).
async function config() {
  const { server, token } = await chrome.storage.local.get(["server", "token"]);
  return { base: (server || "").trim().replace(/\/+$/, ""), token: (token || "").trim() };
}

async function post(path, payload) {
  const { base, token } = await config();
  if (!base || !token) return { ok: false, reason: "Configure o endereço do jogo e o código de conexão" };
  try {
    const res = await fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-extension-token": token },
      body: JSON.stringify(payload),
    });
    return await res.json().catch(() => ({ ok: false, reason: "Resposta inválida (" + res.status + ")" }));
  } catch (e) {
    return { ok: false, reason: "Sem conexão com o jogo: " + e.message };
  }
}
const send = (payload) => post("/api/public/extension/event", payload);

async function log(entry) {
  const { logs = [], stats = { gifts: 0, chats: 0, teams: 0, reads: 0 } } = await chrome.storage.local.get(["logs", "stats"]);
  stats.reads = (stats.reads || 0) + 1;
  if (entry.kind === "gift" && entry.ok) stats.gifts++;
  if (entry.kind === "chat") stats.chats++;
  if (entry.kind === "chat" && entry.ok) stats.teams++;
  await chrome.storage.local.set({ logs: [{ ...entry, at: Date.now() }, ...logs].slice(0, 50), stats });
}

const up = (v) => String(v || "").toUpperCase();
async function logResult(p, r, via) {
  const tag = via ? `[${via}] ` : "";
  if (r.kind === "gift" || p.type === "gift") {
    await log({ kind: "gift", ok: !!r.ok, text: tag + (r.ok ? `🎁 @${r.username || p.username} · ${r.gift} x${r.quantity || p.quantity || 1} → ${up(r.character)}` : `🎁 ${r.reason}`) });
  } else if (r.kind === "chat" || p.type === "chat") {
    if (r.assigned) await log({ kind: "chat", ok: true, text: tag + `💬 @${r.username || p.username} entrou no time ${up(r.assigned)}` });
    else if (!r.ok) await log({ kind: "chat", ok: false, text: tag + `💬 ${r.reason}` });
  } else if (!r.ok && r.reason && !/Sem palavra-chave/.test(r.reason)) {
    await log({ kind: "other", ok: false, text: tag + r.reason });
  }
}

// ---------- image reading (OCR) ----------
const ocrSeen = new Map(); // normalized row -> time
const ocrQty = new Map(); // user|gift -> {qty, at}
let ocrFirst = true;
let lastHash = "";
let ocrPausedUntil = 0;
const normKey = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9#]/g, "");

async function hash(text) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function captureArea(tab, msg) {
  const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 80 });
  const bitmap = await createImageBitmap(await (await fetch(shot)).blob());
  const sx = bitmap.width / msg.vw, sy = bitmap.height / msg.vh;
  const x = Math.max(0, msg.rect.x * sx), y = Math.max(0, msg.rect.y * sy);
  const w = Math.min(bitmap.width - x, msg.rect.w * sx), h = Math.min(bitmap.height - y, msg.rect.h * sy);
  const scale = Math.min(1, 1100 / Math.max(w, h));
  const canvas = new OffscreenCanvas(Math.round(w * scale), Math.round(h * scale));
  canvas.getContext("2d").drawImage(bitmap, x, y, w, h, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return "data:image/jpeg;base64," + btoa(bin);
}

async function runOcr(tab, msg) {
  if (Date.now() < ocrPausedUntil) return { ok: false };
  let image;
  try { image = await captureArea(tab, msg); } catch (e) { await log({ kind: "other", ok: false, text: "[OCR] Não consegui capturar a tela (deixe a aba da live visível): " + e.message }); ocrPausedUntil = Date.now() + 15000; return { ok: false }; }
  const h = await hash(image);
  if (h === lastHash) return { ok: true, same: true };
  lastHash = h;
  const res = await post("/api/public/extension/ocr", { image });
  await chrome.storage.local.set({ ocrLast: { at: Date.now(), ok: !!res.ok, rows: res.items?.length ?? 0, reason: res.reason || null } });
  if (!res.ok) { await log({ kind: "other", ok: false, text: "[OCR] " + res.reason }); ocrPausedUntil = Date.now() + 20000; return res; }
  const now = Date.now();
  for (const [k, t] of ocrSeen) if (now - t > 180000) ocrSeen.delete(k);
  const first = ocrFirst;
  ocrFirst = false;
  for (const it of res.items) {
    if (!it.username) continue;
    const key = normKey(it.username + "|" + it.text);
    if (ocrSeen.has(key)) continue;
    ocrSeen.set(key, now);
    if (it.kind === "gift") {
      const gk = normKey(it.username + "|" + (it.gift || it.text));
      const qty = Math.max(1, Math.min(999, it.quantity || 1));
      const prev = ocrQty.get(gk);
      const base = prev && now - prev.at < 30000 ? prev.qty : 0; // combo counter still growing
      ocrQty.set(gk, { qty: Math.max(qty, base), at: now });
      if (first || qty <= base) continue; // gifts already on screen when reading started are history
      const p = { type: "raw", text: `${it.username}\n${it.gift || ""} ${it.text}`.slice(0, 600), username: it.username, quantity: qty - base, event_id: "ocr-" + gk.slice(0, 60) + "-" + now.toString(36) };
      await logResult(p, await send(p), "OCR");
    } else {
      const p = { type: "raw", text: `${it.username}\n${it.text}`.slice(0, 600), username: it.username, event_id: "ocr-c-" + now.toString(36) };
      await logResult(p, await send(p), "OCR");
    }
  }
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.kind === "event") {
    send(msg.payload).then(async (result) => { await logResult(msg.payload, result, "TEXTO"); reply(result); });
    return true;
  }
  if (msg?.kind === "ocr" && sender.tab) {
    runOcr(sender.tab, msg).then(reply, () => reply({ ok: false }));
    return true;
  }
  if (msg?.kind === "ping") {
    send({ type: "ping" }).then(reply);
    return true;
  }
  if (msg?.kind === "ocr-reset") { ocrFirst = true; lastHash = ""; ocrSeen.clear(); ocrQty.clear(); reply({ ok: true }); }
});

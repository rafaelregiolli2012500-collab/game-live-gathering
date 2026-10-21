// Relays events to the game server (background fetch avoids the page's CORS rules).
async function send(payload) {
  const { server, token } = await chrome.storage.local.get(["server", "token"]);
  if (!server || !token) return { ok: false, reason: "Configure o endereço do jogo e o código de conexão" };
  try {
    const res = await fetch(server.replace(/\/+$/, "") + "/api/public/extension/event", {
      method: "POST",
      headers: { "content-type": "application/json", "x-extension-token": token },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({ ok: false, reason: "Resposta inválida (" + res.status + ")" }));
    return body;
  } catch (e) {
    return { ok: false, reason: "Sem conexão com o jogo: " + e.message };
  }
}

async function log(entry) {
  const { logs = [], stats = { gifts: 0, chats: 0, teams: 0 } } = await chrome.storage.local.get(["logs", "stats"]);
  if (entry.kind === "gift" && entry.ok) stats.gifts++;
  if (entry.kind === "chat") stats.chats++;
  if (entry.kind === "chat" && entry.ok) stats.teams++;
  await chrome.storage.local.set({ logs: [{ ...entry, at: Date.now() }, ...logs].slice(0, 40), stats });
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.kind === "event") {
    send(msg.payload).then(async (result) => {
      const p = msg.payload;
      if (p.type === "gift") await log({ kind: "gift", ok: !!result.ok, text: `@${p.username} · ${p.gift} x${p.quantity} → ${result.ok ? String(result.character).toUpperCase() : result.reason}` });
      if (p.type === "chat" && result.assigned) await log({ kind: "chat", ok: true, text: `@${p.username} entrou no time ${String(result.assigned).toUpperCase()}` });
      reply(result);
    });
    return true;
  }
  if (msg?.kind === "ping") {
    send({ type: "ping" }).then(reply);
    return true;
  }
});

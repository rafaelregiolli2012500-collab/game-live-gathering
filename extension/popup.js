const $ = (id) => document.getElementById(id);

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
async function toTab(msg) {
  const tab = await activeTab();
  try { return await chrome.tabs.sendMessage(tab.id, msg); } catch { return null; }
}

async function render() {
  const { server = "", token = "", logs = [], stats, paused, giftMap, chatMap } = await chrome.storage.local.get(["server", "token", "logs", "stats", "paused", "giftMap", "chatMap"]);
  $("server").value ||= server;
  $("token").value ||= token;
  $("pause").textContent = paused ? "RETOMAR" : "PAUSAR";
  $("logs").innerHTML = logs.length ? logs.map((l) => `<div class="${l.ok ? "ok" : "bad"}">${l.text.replace(/</g, "&lt;")}</div>`).join("") : "<small>Nada enviado ainda.</small>";
  if (stats) $("stats").textContent = `· ${stats.gifts} presentes · ${stats.teams} times`;
  const live = (await toTab({ kind: "status" })) || {};
  $("areas").innerHTML =
    `Presentes: ${giftMap ? (live.gift ? '<span class="ok">ativa nesta aba</span>' : '<span class="bad">salva, não encontrada nesta aba</span>') : "não escolhida"}<br/>` +
    `Chat: ${chatMap ? (live.chat ? '<span class="ok">ativa nesta aba</span>' : '<span class="bad">salva, não encontrada nesta aba</span>') : "não escolhida"}`;
}

$("save").onclick = async () => {
  await chrome.storage.local.set({ server: $("server").value.trim(), token: $("token").value.trim() });
  $("status").textContent = "Testando…";
  const res = await chrome.runtime.sendMessage({ kind: "ping" });
  $("status").className = res?.ok ? "ok" : "bad";
  $("status").textContent = res?.ok ? `Conectado ✔ Palavras: ${res.keywords.join(" / ")}` : res?.reason || "Falha ao conectar";
};
$("pickGift").onclick = async () => { if (await toTab({ kind: "pick", mode: "gift" })) window.close(); else $("areas").textContent = "Recarregue a página da live e tente de novo."; };
$("pickChat").onclick = async () => { if (await toTab({ kind: "pick", mode: "chat" })) window.close(); else $("areas").textContent = "Recarregue a página da live e tente de novo."; };
$("pause").onclick = async () => { const { paused } = await chrome.storage.local.get("paused"); await chrome.storage.local.set({ paused: !paused }); await toTab({ kind: "reattach" }); render(); };
$("reset").onclick = async () => { await chrome.storage.local.remove(["giftMap", "chatMap"]); await toTab({ kind: "reattach" }); render(); };

render();
setInterval(render, 2000);

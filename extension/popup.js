const $ = (id) => document.getElementById(id);

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
async function toTab(msg) {
  const tab = await activeTab();
  try { return await chrome.tabs.sendMessage(tab.id, msg); } catch { return null; }
}
const ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? `${s}s` : `${Math.round(s / 60)}min`; };

async function render() {
  const s = await chrome.storage.local.get(["server", "token", "logs", "stats", "paused", "giftMap", "chatMap", "ocrMap", "autoMode", "ocrMode", "ocrLast"]);
  $("server").value ||= s.server || "";
  $("token").value ||= s.token || "";
  $("autoMode").checked = s.autoMode !== false;
  $("ocrMode").checked = !!s.ocrMode;
  $("pause").textContent = s.paused ? "RETOMAR" : "PAUSAR";
  const logs = s.logs || [];
  $("logs").innerHTML = logs.length ? logs.map((l) => `<div class="${l.ok ? "ok" : "bad"}">${ago(l.at)} · ${l.text.replace(/</g, "&lt;")}</div>`).join("") : "<small>Nada enviado ainda. Quando alguém comentar #lula/#flavio ou mandar um presente, aparece aqui.</small>";
  if (s.stats) $("stats").textContent = `· ${s.stats.gifts} presentes · ${s.stats.teams} times`;
  const live = await toTab({ kind: "status" });
  const area = (m, found) => (m ? (found ? '<span class="ok">ativa</span>' : '<span class="bad">salva, não encontrada nesta aba</span>') : "não escolhida");
  $("areas").innerHTML = !live
    ? '<span class="bad">A extensão não está ativa nesta aba. Recarregue a página da live (F5).</span>'
    : `Leitura: ${live.observing ? '<span class="ok">lendo a página</span>' : '<span class="bad">parada</span>'}${s.ocrMode ? (s.ocrLast ? ` · OCR ${ago(s.ocrLast.at)} atrás (${s.ocrLast.ok ? s.ocrLast.rows + " linhas" : "falhou"})` : " · OCR aguardando") : ""}<br/>` +
      `Chat: ${area(s.chatMap, live.chat)} · Presentes: ${area(s.giftMap, live.gift)}${s.ocrMap ? ` · Imagem: ${area(s.ocrMap, live.ocr)}` : ""}`;
}

$("save").onclick = async () => {
  await chrome.storage.local.set({ server: $("server").value.trim(), token: $("token").value.trim() });
  $("status").textContent = "Testando…";
  const res = await chrome.runtime.sendMessage({ kind: "ping" });
  $("status").className = res?.ok ? "ok" : "bad";
  $("status").textContent = res?.ok ? `Conectado ✔ Palavras: ${res.keywords.join(" / ")}` : res?.reason || "Falha ao conectar";
  await toTab({ kind: "reattach" });
};
const pick = (mode) => async () => { if (await toTab({ kind: "pick", mode })) window.close(); else $("areas").textContent = "Recarregue a página da live (F5) e tente de novo."; };
$("pickGift").onclick = pick("gift");
$("pickChat").onclick = pick("chat");
$("pickOcr").onclick = pick("ocr");
$("autoMode").onchange = async (e) => { await chrome.storage.local.set({ autoMode: e.target.checked }); await toTab({ kind: "reattach" }); render(); };
$("ocrMode").onchange = async (e) => { await chrome.storage.local.set({ ocrMode: e.target.checked }); await chrome.runtime.sendMessage({ kind: "ocr-reset" }); render(); };
$("pause").onclick = async () => { const { paused } = await chrome.storage.local.get("paused"); await chrome.storage.local.set({ paused: !paused }); await toTab({ kind: "reattach" }); render(); };
$("reset").onclick = async () => { await chrome.storage.local.remove(["giftMap", "chatMap", "ocrMap"]); await toTab({ kind: "reattach" }); render(); };

render();
setInterval(render, 2000);

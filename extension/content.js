(() => {
  if (window.__bfaConnector) return;
  window.__bfaConnector = true;

  // ================= helpers =================
  const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, "\\$&"));
  let terms = ["#lula", "#flavio"]; // refreshed from the game (keywords + gift names + aliases)
  let enabled = true;
  let autoMode = true;

  function absolutePath(el) {
    const parts = [];
    for (let node = el; node && node.nodeType === 1 && node !== document.documentElement; node = node.parentElement) {
      const e2e = node.getAttribute("data-e2e");
      if (e2e) { parts.unshift(node.tagName.toLowerCase() + '[data-e2e="' + e2e + '"]'); if (document.querySelectorAll(parts.join(" ")).length === 1) break; continue; }
      if (node.id && !/\d{3,}/.test(node.id)) { parts.unshift("#" + esc(node.id)); break; }
      const parent = node.parentElement;
      const idx = parent ? [...parent.children].indexOf(node) + 1 : 1;
      parts.unshift(node.tagName.toLowerCase() + ":nth-child(" + idx + ")");
    }
    return parts.join(" > ").replace(/ > (\w+\[data-e2e)/g, " $1");
  }

  // Visible text of an element including image names (gift icons usually carry the gift name in alt/title).
  function fullText(el) {
    if (!el || el.nodeType !== 1) return "";
    let text = (el.innerText || el.textContent || "").trim();
    const extra = [...el.querySelectorAll("img[alt], img[title], [aria-label]")].slice(0, 6)
      .map((i) => i.getAttribute("alt") || i.getAttribute("title") || i.getAttribute("aria-label") || "")
      .filter((t) => t && t.length < 40 && !text.includes(t));
    if (el.tagName === "IMG") extra.push(el.alt || el.title || "");
    return [text, ...extra].filter(Boolean).join("\n").slice(0, 600);
  }

  const hasTerm = (text) => {
    const t = norm(text);
    return terms.some((term) => term && t.includes(term));
  };

  // From any node inside a message, climb to the whole message "row" (name + text), but not the whole list.
  function rowFor(node) {
    let el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return null;
    let best = el;
    for (let cur = el.parentElement, i = 0; cur && cur !== document.body && i < 6; cur = cur.parentElement, i++) {
      // Stop at a list: the parent holds several siblings that look like "best" (same tag + classes).
      const twins = [...cur.children].filter((c) => c.tagName === best.tagName && c.className === best.className && (c.innerText || "").trim().length > 8);
      if (twins.length >= 3) break;
      const t = (cur.innerText || "").trim();
      if (!t || t.length > 260 || t.split("\n").length > 6) break;
      best = cur;
    }
    return best;
  }

  // ================= sending =================
  const send = (payload) => chrome.runtime.sendMessage({ kind: "event", payload }).catch(() => {});
  const recent = new Map(); // text -> time, to drop repeated re-renders of the same message
  const rowQty = new WeakMap(); // row -> highest quantity already sent (gift combos "x1 → x5")
  const rowIds = new WeakMap();
  const rowText = new WeakMap();
  let seq = 0;

  function report(row, initial) {
    if (!enabled || !row || !row.isConnected) return;
    const text = fullText(row);
    if (!text || text.length > 600 || !hasTerm(text)) return;
    const qtyMatch = text.match(/[x×]\s*(\d{1,4})\b/i);
    const qty = qtyMatch ? Number(qtyMatch[1]) : 1;
    const prev = rowQty.get(row) || 0;
    const key = norm(text);
    const now = Date.now();
    if (qtyMatch) {
      if (qty <= prev) return;
      rowQty.set(row, qty);
    } else {
      const lastText = rowText.get(row);
      if (lastText === key) return; // same row, nothing new
      rowText.set(row, key);
      if (recent.has(key) && now - recent.get(key) < 2000) return; // same message re-rendered in a new box
    }
    recent.set(key, now);
    if (recent.size > 400) for (const [k, t] of recent) if (now - t > 60000) recent.delete(k);
    if (initial) return; // messages already on screen when we attached are history, not new events
    if (!rowIds.has(row)) rowIds.set(row, now.toString(36) + "-" + ++seq);
    send({ type: "raw", text, quantity: qtyMatch ? qty - prev : null, event_id: rowIds.get(row) + "-" + qty });
  }

  // ================= observers =================
  let observers = [];
  const pending = new Set();
  let flushTimer = 0;
  const queue = (node) => {
    const row = rowFor(node);
    if (row) pending.add(row);
    clearTimeout(flushTimer);
    // Small delay: sites fill the name, text and gift icon in separate steps.
    flushTimer = setTimeout(() => { const rows = [...pending]; pending.clear(); rows.forEach((r) => report(r, false)); }, 250);
  };

  function observe(root) {
    const obs = new MutationObserver((mutations) => {
      if (!enabled) return;
      for (const m of mutations) {
        if (m.type === "childList") m.addedNodes.forEach((n) => (n.nodeType === 1 || n.nodeType === 3) && queue(n));
        else queue(m.target);
      }
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["alt", "title", "aria-label", "src"] });
    observers.push({ obs, root });
  }

  function markExisting(root) {
    root.querySelectorAll("*").forEach((el) => { if (el.children.length <= 8 && (el.innerText || "").length < 260) report(el, true); });
  }

  async function attach() {
    observers.forEach((o) => o.obs.disconnect());
    observers = [];
    const s = await chrome.storage.local.get(["giftMap", "chatMap", "paused", "autoMode"]);
    enabled = !s.paused;
    autoMode = s.autoMode !== false;
    const roots = [s.giftMap, s.chatMap].filter(Boolean).map((m) => document.querySelector(m.container)).filter(Boolean);
    if (autoMode || !roots.length) {
      // Whole page: works even if the site rebuilds its chat panel.
      if (document.body) { markExisting(document.body); observe(document.body); }
    } else {
      roots.forEach((r) => { markExisting(r); observe(r); });
    }
  }

  // ================= area picker (1 click) =================
  let picker = null;
  function startPicker(mode) {
    stopPicker();
    const label = mode === "gift" ? "a área onde aparecem os PRESENTES" : mode === "chat" ? "a área do CHAT (comentários)" : "a área para LEITURA POR IMAGEM";
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;border:3px solid #ff2d8a;background:rgba(255,45,138,.15);border-radius:6px";
    const tip = document.createElement("div");
    tip.style.cssText = "position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%);background:#0d0f1a;color:#fff;font:600 14px system-ui;padding:10px 16px;border-radius:10px;border:2px solid #ff2d8a;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:90vw;text-align:center";
    tip.textContent = `⚔️ Clique em ${label}. Use ↑ para aumentar a seleção, Enter para confirmar, Esc para cancelar.`;
    document.documentElement.append(box, tip);
    let current = null;
    const paint = () => { if (!current) return; const r = current.getBoundingClientRect(); Object.assign(box.style, { top: r.top + "px", left: r.left + "px", width: r.width + "px", height: r.height + "px" }); };
    const move = (e) => { if (e.target === box || e.target === tip) return; current = e.target; paint(); };
    const save = async (el) => {
      stopPicker();
      const r = el.getBoundingClientRect();
      const area = { container: absolutePath(el), rect: { x: r.left, y: r.top, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight }, url: location.href };
      const key = mode === "gift" ? "giftMap" : mode === "chat" ? "chatMap" : "ocrMap";
      await chrome.storage.local.set({ [key]: area });
      toast("Área salva ✔ — os novos itens já serão lidos");
      attach();
    };
    const click = (e) => { e.preventDefault(); e.stopPropagation(); save(current || e.target); };
    const key = (e) => {
      if (e.key === "Escape") { stopPicker(); toast("Seleção cancelada"); }
      if (e.key === "ArrowUp" && current?.parentElement && current.parentElement !== document.body) { e.preventDefault(); current = current.parentElement; paint(); }
      if (e.key === "Enter" && current) { e.preventDefault(); save(current); }
    };
    document.addEventListener("mousemove", move, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key, true);
    picker = () => {
      document.removeEventListener("mousemove", move, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key, true);
      box.remove(); tip.remove();
    };
  }
  function stopPicker() { if (picker) { picker(); picker = null; } }

  function toast(text) {
    const t = document.createElement("div");
    t.textContent = text;
    t.style.cssText = "position:fixed;z-index:2147483647;bottom:20px;right:20px;background:#0d0f1a;color:#fff;font:600 13px system-ui;padding:10px 14px;border-radius:10px;border:2px solid #00e5ff";
    document.documentElement.append(t);
    setTimeout(() => t.remove(), 2600);
  }

  // ================= image reading (OCR) =================
  let ocrBusy = false;
  async function ocrTick() {
    const s = await chrome.storage.local.get(["ocrMode", "ocrMap", "chatMap", "giftMap", "paused"]);
    if (!s.ocrMode || s.paused || ocrBusy || document.hidden || window.top !== window) return;
    const area = s.ocrMap || s.chatMap || s.giftMap;
    let rect;
    const el = area && document.querySelector(area.container);
    if (el) { const r = el.getBoundingClientRect(); rect = { x: r.left, y: r.top, w: r.width, h: r.height }; }
    else if (area?.rect) rect = area.rect;
    else rect = { x: 0, y: 0, w: innerWidth, h: innerHeight };
    if (rect.w < 20 || rect.h < 20) return;
    ocrBusy = true;
    try { await chrome.runtime.sendMessage({ kind: "ocr", rect, dpr: devicePixelRatio, vw: innerWidth, vh: innerHeight }); } catch {}
    ocrBusy = false;
  }
  setInterval(ocrTick, 3500);

  // ================= messages & keep-alive =================
  async function refreshTerms() {
    const res = await chrome.runtime.sendMessage({ kind: "ping" }).catch(() => null);
    if (res?.ok && Array.isArray(res.terms) && res.terms.length) terms = res.terms.map(norm);
  }

  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg?.kind === "pick") { if (window.top === window) startPicker(msg.mode); reply({ ok: true }); }
    if (msg?.kind === "reattach") { refreshTerms(); attach(); reply({ ok: true }); }
    if (msg?.kind === "status") {
      chrome.storage.local.get(["giftMap", "chatMap", "ocrMap"]).then(({ giftMap, chatMap, ocrMap }) => reply({
        gift: !!(giftMap && document.querySelector(giftMap.container)),
        chat: !!(chatMap && document.querySelector(chatMap.container)),
        ocr: !!(ocrMap && document.querySelector(ocrMap.container)),
        auto: autoMode,
        observing: observers.length,
      }));
      return true;
    }
  });

  refreshTerms().then(attach);
  setInterval(refreshTerms, 60000);
  // Sites rebuild their panels constantly: re-attach when a watched root disappears.
  setInterval(() => { if (observers.some((o) => !o.root.isConnected) || (!observers.length && document.body)) attach(); }, 3000);
})();

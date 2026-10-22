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

  // Text of an element piece by piece (one line per text/image), so "name" and "comment" stay separate
  // even when the site puts them side by side. Gift icons usually carry the gift name in alt/title/src.
  function fullText(el) {
    if (!el || el.nodeType !== 1) return "";
    const parts = [];
    const seen = new Set();
    const push = (t) => {
      const v = (t || "").trim();
      if (!v || v.length > 60 || seen.has(v)) return;
      seen.add(v);
      parts.push(v);
    };
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = el; n && parts.length < 40; n = walker.nextNode()) {
      if (n.nodeType === 3) push(n.nodeValue);
      else if (n.nodeType === 1) {
        if (n.tagName === "SCRIPT" || n.tagName === "STYLE") continue;
        if (n.tagName === "IMG" || n.tagName === "IMAGE" || n.getAttribute("aria-label") || n.getAttribute("data-e2e")) {
          push(n.getAttribute("alt"));
          push(n.getAttribute("title"));
          push(n.getAttribute("aria-label"));
          // TikTok / live UIs often put the gift id in the image URL path
          const src = n.getAttribute("src") || n.getAttribute("data-src") || "";
          const file = src.split("/").pop() || "";
          const m = file.match(/([a-z][a-z0-9_-]{2,30})/i);
          if (m) push(m[1].replace(/[-_]/g, " "));
        }
      }
    }
    return parts.join("\n").slice(0, 600);
  }

  /** Quantity from live gift UIs: x5, ×5, 5x, "x 12", badge-only numbers next to gift text. */
  function parseQty(text) {
    const t = text || "";
    let m = t.match(/[x×]\s*(\d{1,4})\b/i) || t.match(/\b(\d{1,4})\s*[x×]\b/i);
    if (m) return Math.max(1, Math.min(999, Number(m[1])));
    // Isolated combo counter on its own line (common in gift toasts)
    m = t.match(/(?:^|\n)\s*(\d{1,4})\s*(?:\n|$)/);
    if (m) return Math.max(1, Math.min(999, Number(m[1])));
    return 1;
  }

  const isScroller = (el) => { const o = getComputedStyle(el).overflowY; return (o === "auto" || o === "scroll") && el.scrollHeight > 0; };
  let pickedRoots = [];
  let giftRoots = []; // specifically the gift area(s) — rows here are treated as gift candidates

  const hasTerm = (text) => {
    const t = norm(text);
    return terms.some((term) => term && t.includes(term));
  };

  const inGiftArea = (el) => giftRoots.some((r) => r.contains(el));

  // Gift-looking row even without a known term (used only inside the chosen gift area)
  const looksLikeGift = (text) => {
    const t = norm(text);
    if (!t || t.length < 2) return false;
    if (/[x×]\s*\d{1,4}\b/.test(t) || /\b\d{1,4}\s*[x×]\b/.test(t)) return true;
    if (/\b(enviou|mandou|sent|deu|gifted|enviado|presente|gift)\b/.test(t)) return true;
    return false;
  };

  // From any node inside a message, climb to the whole message "row" (name + text), but not the whole list.
  function rowFor(node) {
    let el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return null;
    let best = el;
    for (let cur = el.parentElement, i = 0; cur && cur !== document.body && i < 6; cur = cur.parentElement, i++) {
      // Stop at a list: the parent holds several siblings that look like "best" (same tag + classes).
      // Stop at the list itself: a scrolling box, a picked area, or a parent holding several boxes shaped like "best".
      if (isScroller(cur) || pickedRoots.includes(cur)) break;
      const twins = [...cur.children].filter((c) => c.tagName === best.tagName && c.className === best.className && c.children.length > 0);
      if (twins.length >= 2) break;
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
    if (!text || text.length > 600) return;
    const fromGiftArea = inGiftArea(row);
    // Accept: known keyword/gift name, OR any gift-like row inside the chosen gift area
    if (!hasTerm(text) && !(fromGiftArea && looksLikeGift(text))) return;

    const qty = parseQty(text);
    const hasExplicitQty = /[x×]\s*\d{1,4}\b|\b\d{1,4}\s*[x×]\b|(?:^|\n)\s*\d{1,4}\s*(?:\n|$)/i.test(text);
    const prev = rowQty.get(row) || 0;
    const key = norm(text);
    const now = Date.now();

    if (hasExplicitQty || fromGiftArea) {
      // Combo growth (x1 → x5): only send the delta once per increase
      if (qty <= prev) {
        // Still allow first non-qty text change inside gift area (name may appear before counter)
        if (prev > 0) return;
        const lastText = rowText.get(row);
        if (lastText === key) return;
        rowText.set(row, key);
        if (recent.has(key) && now - recent.get(key) < 2000) return;
      } else {
        rowQty.set(row, qty);
      }
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

    // Always send a positive quantity so the game receives the gift amount
    const delta = hasExplicitQty ? Math.max(1, qty - prev) : qty;
    send({
      type: "raw",
      text,
      quantity: delta,
      event_id: rowIds.get(row) + "-" + qty,
      // Hint for the server when this came from the gift panel
      ...(fromGiftArea ? { prefer_gift: true } : {}),
    });
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
    const s = await chrome.storage.local.get(["giftMap", "chatMap", "paused", "autoMode", "ocrMode"]);
    enabled = !s.paused;
    autoMode = s.autoMode !== false;
    const giftEl = s.giftMap ? document.querySelector(s.giftMap.container) : null;
    const chatEl = s.chatMap ? document.querySelector(s.chatMap.container) : null;
    giftRoots = giftEl ? [giftEl] : [];
    const roots = [giftEl, chatEl].filter(Boolean);
    pickedRoots = roots;
    if (s.ocrMode) return; // image reading is on: it sends everything, text reading would double the gifts
    if (autoMode) {
      // Whole page: works even if the site rebuilds its chat panel.
      // Still track giftRoots so prefer_gift / looksLikeGift work when area was chosen.
      if (document.body) { markExisting(document.body); observe(document.body); }
    } else {
      // Manual mode: observe only the chosen areas (gift + chat)
      roots.forEach((r) => { markExisting(r); observe(r); });
      // If only gift area was chosen, still observe it aggressively
      if (!roots.length && document.body) {
        markExisting(document.body);
        observe(document.body);
      }
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
  setInterval(async () => {
    const { ocrMode, autoMode: auto, giftMap, chatMap } = await chrome.storage.local.get(["ocrMode", "autoMode", "giftMap", "chatMap"]);
    const wanted = !ocrMode && (auto !== false || giftMap || chatMap);
    if (observers.some((o) => !o.root.isConnected) || (wanted && !observers.length) || (!wanted && observers.length)) attach();
  }, 3000);
})();

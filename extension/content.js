(() => {
  if (window.__bfaConnector) return;
  window.__bfaConnector = true;

  // ---------- selectors ----------
  const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, "\\$&"));
  const goodClasses = (el) => [...el.classList].filter((c) => c.length < 40 && !/^\d/.test(c)).slice(0, 3);

  function absolutePath(el) {
    const parts = [];
    for (let node = el; node && node.nodeType === 1 && node !== document.documentElement; node = node.parentElement) {
      if (node.id && !/\d{3,}/.test(node.id)) { parts.unshift("#" + esc(node.id)); break; }
      const parent = node.parentElement;
      const idx = parent ? [...parent.children].indexOf(node) + 1 : 1;
      parts.unshift(node.tagName.toLowerCase() + ":nth-child(" + idx + ")");
    }
    return parts.join(" > ");
  }

  // Path from a row down to a field, using tag + classes so it matches the same field in other rows.
  function relativePath(row, el) {
    const parts = [];
    for (let node = el; node && node !== row; node = node.parentElement) {
      const cls = goodClasses(node).map((c) => "." + esc(c)).join("");
      parts.unshift(node.tagName.toLowerCase() + cls);
    }
    return parts.join(" > ");
  }

  const rowOf = (container, el) => {
    let node = el;
    while (node && node.parentElement !== container) node = node.parentElement;
    return node;
  };

  const textOf = (el) => {
    if (!el) return "";
    const img = el.tagName === "IMG" ? el : el.querySelector("img");
    const text = (el.innerText || el.textContent || "").trim();
    return text || (img && (img.alt || img.title)) || el.getAttribute("aria-label") || el.title || "";
  };

  // ---------- picker ----------
  let picker = null;
  function startPicker(mode) {
    stopPicker();
    const steps = mode === "gift"
      ? [["container", "Clique na LISTA onde os presentes aparecem"], ["username", "Agora clique no NOME DO USUÁRIO em um presente"], ["gift", "Clique no NOME ou IMAGEM do presente"], ["quantity", "Clique na QUANTIDADE (ex: x5) — ou Esc para pular"]]
      : [["container", "Clique na LISTA do chat"], ["username", "Clique no NOME DO USUÁRIO em um comentário"], ["message", "Clique no TEXTO do comentário"]];
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;border:3px solid #ff2d8a;background:rgba(255,45,138,.15);border-radius:6px;transition:all .05s";
    const tip = document.createElement("div");
    tip.style.cssText = "position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%);background:#0d0f1a;color:#fff;font:600 14px system-ui;padding:10px 16px;border-radius:10px;border:2px solid #ff2d8a;box-shadow:0 8px 30px rgba(0,0,0,.5)";
    document.documentElement.append(box, tip);
    const result = {};
    let step = 0;
    const show = () => (tip.textContent = `⚔️ Brasil Fight Arena — ${steps[step][1]}  (${step + 1}/${steps.length})`);
    show();
    const move = (e) => {
      const el = e.target;
      if (!el || el === box || el === tip) return;
      const r = el.getBoundingClientRect();
      Object.assign(box.style, { top: r.top + "px", left: r.left + "px", width: r.width + "px", height: r.height + "px" });
    };
    const finish = async () => {
      stopPicker();
      const key = mode === "gift" ? "giftMap" : "chatMap";
      await chrome.storage.local.set({ [key]: { ...result, url: location.href } });
      toast(mode === "gift" ? "Área de presentes salva ✔" : "Área do chat salva ✔");
      attach();
    };
    const click = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;
      const [name] = steps[step];
      if (name === "container") {
        result.container = absolutePath(el);
        result._el = el;
      } else {
        const container = result._el;
        if (!container.contains(el) || el === container) { toast("Escolha um item DENTRO da lista selecionada"); return; }
        const row = rowOf(container, el);
        result[name] = row === el ? "" : relativePath(row, el);
      }
      step++;
      if (step >= steps.length) { delete result._el; finish(); } else show();
    };
    const key = (e) => {
      if (e.key !== "Escape") return;
      if (steps[step][0] === "quantity") { delete result._el; finish(); } else { stopPicker(); toast("Seleção cancelada"); }
    };
    document.addEventListener("mousemove", move, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key, true);
    picker = () => {
      document.removeEventListener("mousemove", move, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key, true);
      box.remove();
      tip.remove();
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

  // ---------- readers ----------
  const send = (payload) => chrome.runtime.sendMessage({ kind: "event", payload }).catch(() => {});
  const field = (row, path) => (path ? row.querySelector(path) : row);
  let observers = [];
  let enabled = true;

  function parseQuantity(text) {
    const m = text.match(/[x×]\s*(\d{1,4})/i) || text.match(/(\d{1,4})/);
    return m ? Number(m[1]) : 1;
  }

  function watch(map, onRow, onUpdate) {
    const container = document.querySelector(map.container);
    if (!container) return false;
    const seen = new WeakSet();
    [...container.children].forEach((row) => { seen.add(row); onUpdate && onUpdate(row, true); });
    const obs = new MutationObserver((mutations) => {
      if (!enabled) return;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.parentElement === container && !seen.has(node)) { seen.add(node); onRow(node); }
        }
        if (onUpdate) {
          const target = m.target.nodeType === 1 ? m.target : m.target.parentElement;
          const row = target && container.contains(target) && target !== container ? rowOf(container, target) : null;
          if (row && seen.has(row)) onUpdate(row, false);
        }
      }
    });
    obs.observe(container, { childList: true, subtree: true, characterData: true });
    observers.push(obs);
    return true;
  }

  async function attach() {
    observers.forEach((o) => o.disconnect());
    observers = [];
    const { giftMap, chatMap, paused } = await chrome.storage.local.get(["giftMap", "chatMap", "paused"]);
    enabled = !paused;

    if (giftMap) {
      const sent = new WeakMap();
      let rowSeq = 0;
      const rowIds = new WeakMap();
      const readGift = (row, initial) => {
        const username = textOf(field(row, giftMap.username)).split("\n")[0];
        const gift = textOf(field(row, giftMap.gift));
        const qtyText = giftMap.quantity ? textOf(field(row, giftMap.quantity)) : (row.innerText || "");
        const qty = parseQuantity(qtyText);
        if (!username || !gift) return;
        const prev = sent.get(row) || 0;
        sent.set(row, Math.max(prev, qty));
        if (initial || qty <= prev) return;
        if (!rowIds.has(row)) rowIds.set(row, Date.now().toString(36) + "-" + ++rowSeq);
        send({ type: "gift", username, gift: gift.slice(0, 120), quantity: qty - prev, event_id: rowIds.get(row) + "-" + qty });
      };
      if (!watch(giftMap, (row) => readGift(row, false), (row, initial) => readGift(row, initial))) retry();
    }
    if (chatMap) {
      const ok = watch(chatMap, (row) => {
        const username = textOf(field(row, chatMap.username)).split("\n")[0];
        const message = textOf(field(row, chatMap.message));
        if (username && message) send({ type: "chat", username, message: message.slice(0, 500) });
      });
      if (!ok) retry();
    }
  }

  let retryTimer = 0;
  function retry() { clearTimeout(retryTimer); retryTimer = setTimeout(attach, 3000); }

  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg?.kind === "pick") { startPicker(msg.mode); reply({ ok: true }); }
    if (msg?.kind === "reattach") { attach(); reply({ ok: true }); }
    if (msg?.kind === "status") {
      chrome.storage.local.get(["giftMap", "chatMap"]).then(({ giftMap, chatMap }) => reply({
        gift: !!(giftMap && document.querySelector(giftMap.container)),
        chat: !!(chatMap && document.querySelector(chatMap.container)),
      }));
      return true;
    }
  });

  attach();
  // TikTok re-renders panels; re-check every few seconds so the observer follows the new list.
  setInterval(async () => {
    const { giftMap, chatMap } = await chrome.storage.local.get(["giftMap", "chatMap"]);
    const missing = [giftMap, chatMap].some((m) => m && document.querySelector(m.container) && !observers.length);
    if (missing) attach();
  }, 5000);
})();

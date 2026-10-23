/**
 * Adaptador TikFinity
 *
 * Mecanismos reais documentados publicamente:
 * 1) Event API do app desktop TikFinity (stream de eventos — configuração no app).
 * 2) Webhook / HTTP local: muitos overlays apontam um URL; ouvimos em 127.0.0.1.
 * 3) Third-party actions API na porta 8832 (TikFinity chama o app) — opcional.
 *
 * Este módulo:
 * - Sobe um HTTP server local que recebe POST de webhook no formato TikFinity-like.
 * - Normaliza gift/chat e encaminha para a Edge Function.
 * - NÃO inventa WebSocket oficial sem URL configurada pelo usuário.
 *
 * Formato esperado (flexível):
 * { "event": "gift", "data": { uniqueId|username, giftName|gift_name, repeatCount|gift_count, diamondCount|coins, comment } }
 * ou payload já no formato da Edge Function.
 */
import http from "http";
import { config } from "./config.mjs";
import { logger } from "./logger.mjs";
import { ingestToEdge } from "./edge-ingest.mjs";
import { resolveCharacterKey, splitDestinations } from "./character.mjs";

const recentIds = new Map();

function rememberId(id) {
  const now = Date.now();
  recentIds.set(id, now);
  if (recentIds.size > 2000) {
    for (const [k, t] of recentIds) {
      if (now - t > 300_000) recentIds.delete(k);
    }
  }
}

function alreadySeen(id) {
  return recentIds.has(id);
}

export function normalizeTikFinityPayload(raw) {
  const root = raw?.data && typeof raw.data === "object" ? { ...raw, ...raw.data } : raw || {};
  const eventType = String(raw?.event || root.event || root.type || "gift").toLowerCase();

  const username = String(
    root.uniqueId || root.username || root.userId || root.user?.uniqueId || root.user?.username || "anon",
  ).replace(/^@+/, "");

  const nickname = String(root.nickname || root.user?.nickname || username);
  const giftName = String(root.giftName || root.gift_name || root.gift?.name || "").trim();
  const giftCount = Math.max(1, Number(root.repeatCount || root.gift_count || root.giftCount || 1) || 1);
  const coins = Number(root.diamondCount || root.coins || root.diamond_count || 0) || 0;
  const comment = String(root.comment || root.message || root.chat || "");
  const eventId = String(
    root.event_id ||
      root.eventId ||
      root.msgId ||
      root.msg_id ||
      root.transactionId ||
      `${username}-${giftName}-${giftCount}-${root.createTime || Date.now()}`,
  );

  return {
    eventType,
    event_id: eventId,
    username,
    nickname,
    gift_name: giftName,
    gift_count: giftCount,
    coins,
    comment,
    character_key: resolveCharacterKey(comment, root.character_key || null),
  };
}

export async function handleNormalizedGift(norm) {
  if (!norm.gift_name) {
    logger.warn("Evento sem gift_name ignorado", { event_id: norm.event_id });
    return { ok: false, reason: "missing_gift_name" };
  }
  if (alreadySeen(norm.event_id)) {
    return { ok: true, deduped: true };
  }

  const destinations = splitDestinations(norm.comment, norm.gift_count);
  if (destinations.length === 2) {
    for (let i = 0; i < 2; i++) {
      const eid = `${norm.event_id}-${destinations[i]}`;
      if (alreadySeen(eid)) continue;
      await ingestToEdge({
        ...norm,
        event_id: eid,
        gift_count: 1,
        character_key: destinations[i],
      });
      rememberId(eid);
    }
    rememberId(norm.event_id);
    return { ok: true, split: true };
  }

  await ingestToEdge({
    ...norm,
    character_key: destinations[0],
  });
  rememberId(norm.event_id);
  return { ok: true };
}

export function startTikFinityHttpServer(onStatus) {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "game-live-tikfinity-adapter" }));
      return;
    }

    if (req.method === "POST" && req.url?.startsWith(config.tikfinityWebhookPath)) {
      let body = "";
      for await (const chunk of req) body += chunk;
      try {
        const json = JSON.parse(body || "{}");
        const norm = normalizeTikFinityPayload(json);
        if (norm.eventType.includes("chat") || norm.eventType.includes("comment")) {
          // Comentários só atualizam character via backend se a Edge aceitar; aqui só gifts disparam golpes
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: true, ignored: "chat" }));
          return;
        }
        const result = await handleNormalizedGift(norm);
        onStatus?.({ type: "tikfinity", ok: true, lastEventId: norm.event_id });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        logger.error("TikFinity webhook error", { error: e instanceof Error ? e.message : String(e) });
        onStatus?.({ type: "tikfinity", ok: false, message: e instanceof Error ? e.message : String(e) });
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
      }
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  server.listen(config.tikfinityListenPort, config.tikfinityListenHost, () => {
    logger.info("TikFinity HTTP adapter listening", {
      host: config.tikfinityListenHost,
      port: config.tikfinityListenPort,
      path: config.tikfinityWebhookPath,
    });
    onStatus?.({
      type: "tikfinity",
      ok: true,
      message: `Ouvindo http://${config.tikfinityListenHost}:${config.tikfinityListenPort}${config.tikfinityWebhookPath}`,
    });
  });

  server.on("error", (err) => {
    logger.error("TikFinity server error", { error: err.message });
    onStatus?.({ type: "tikfinity", ok: false, message: err.message });
  });

  return server;
}

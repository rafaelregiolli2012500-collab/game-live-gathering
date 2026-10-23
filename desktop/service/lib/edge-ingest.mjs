import { config } from "./config.mjs";
import { logger } from "./logger.mjs";

/**
 * Envia evento normalizado para a Edge Function existente game-live-events.
 * Autenticação: header x-game-token = GAME_LIVE_TOKEN
 */
export async function ingestToEdge(payload) {
  if (!config.gameLiveToken) {
    throw new Error("GAME_LIVE_TOKEN não configurado");
  }
  const body = {
    event_id: payload.event_id,
    username: payload.username,
    nickname: payload.nickname ?? payload.username,
    gift_name: payload.gift_name,
    gift_count: payload.gift_count ?? 1,
    coins: payload.coins ?? 0,
    comment: payload.comment ?? "",
    character_key: payload.character_key ?? null,
  };

  const res = await fetch(config.edgeFunctionUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-game-token": config.gameLiveToken,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    logger.error("Edge Function rejeitou evento", { status: res.status, body: text.slice(0, 300) });
    throw new Error(json?.error || json?.message || `Edge HTTP ${res.status}`);
  }
  return json;
}

/**
 * Serviço principal Node — GAME.LIVE
 * Stdout: linhas JSON para o Electron (status / gift)
 * Stdin: ACK do jogo
 */
import { config, configStatus } from "./lib/config.mjs";
import { logger } from "./lib/logger.mjs";
import { startTikFinityHttpServer } from "./lib/tikfinity-adapter.mjs";
import { createQueueProcessor } from "./lib/queue-processor.mjs";
import { ingestToEdge } from "./lib/edge-ingest.mjs";

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

const status = configStatus();
if (!status.ok) {
  emit({
    type: "status",
    ok: false,
    state: "disconnected",
    message: `Configure desktop/service/.env — faltando: ${status.missing.join(", ")}`,
  });
  logger.warn("Credenciais incompletas", status);
} else {
  emit({
    type: "status",
    ok: true,
    state: "connected",
    message: "Supabase configurado · processador ativo",
    processorId: status.processorId,
  });
}

const processor = createQueueProcessor({
  deliverToGame(row) {
    emit({ type: "gift", row });
  },
  onStatus(s) {
    emit({ type: "status", ok: s.ok !== false, state: s.ok === false ? "error" : "connected", message: s.message || "", ...s });
  },
});

if (status.ok) {
  processor.start();
}

startTikFinityHttpServer((s) => {
  emit({ type: "status", ok: s.ok !== false, state: s.ok ? "connected" : "error", message: s.message || "TikFinity", channel: "tikfinity" });
});

// Comandos stdin
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  const parts = buf.split("\n");
  buf = parts.pop() || "";
  for (const line of parts) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.type === "ack") {
        void processor.onAck(msg.event_id, !!msg.ok, msg.error);
      } else if (msg.type === "test_ingest") {
        // Modo teste: injeta na Edge Function (não finge TikTok)
        void ingestToEdge({
          event_id: msg.event_id || `TEST-${Date.now()}`,
          username: msg.username || "jogador_teste",
          nickname: msg.nickname || "jogador_teste",
          gift_name: msg.gift_name || "Rosa",
          gift_count: msg.gift_count || 1,
          coins: msg.coins || 1,
          comment: msg.comment || "#lula",
          character_key: msg.character_key ?? "lula",
        })
          .then((r) => emit({ type: "status", ok: true, message: "Teste enviado à Edge Function", result: r }))
          .catch((e) => emit({ type: "status", ok: false, state: "error", message: e.message }));
      }
    } catch (e) {
      logger.error("stdin parse", { error: String(e) });
    }
  }
});

process.on("SIGINT", () => {
  processor.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  processor.stop();
  process.exit(0);
});

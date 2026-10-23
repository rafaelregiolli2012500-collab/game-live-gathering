import { config } from "./config.mjs";
import { logger } from "./logger.mjs";
import { claimPendingEvents, completeEvent, requeueExpiredProcessing } from "./supabase-client.mjs";

/**
 * Processador da fila: claim → entrega ao jogo (callback) → espera ACK → complete.
 */
export function createQueueProcessor({ deliverToGame, onStatus }) {
  const waitingAck = new Map(); // event_id -> { row, timer }
  let timer = null;
  let busy = false;

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      await requeueExpiredProcessing();
      const { rows, mode } = await claimPendingEvents(config.batchSize);
      if (rows.length) {
        logger.info("Eventos reservados", { count: rows.length, mode });
      }
      for (const row of rows) {
        const eid = String(row.event_id || row.id);
        if (waitingAck.has(eid)) continue;
        deliverToGame(row);
        const t = setTimeout(() => {
          // Sem ACK a tempo: libera para requeue via status processing expirado (RPC) ou marca failed
          waitingAck.delete(eid);
          logger.warn("ACK timeout — evento permanece processing para recuperação", { event_id: eid });
          onStatus?.({ type: "queue", message: `Timeout ACK ${eid}` });
        }, config.leaseSeconds * 1000);
        waitingAck.set(eid, { row, timer: t });
      }
      onStatus?.({
        type: "queue",
        ok: true,
        waiting: waitingAck.size,
        mode,
      });
    } catch (e) {
      logger.error("Poll falhou", { error: e instanceof Error ? e.message : String(e) });
      onStatus?.({ type: "queue", ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      busy = false;
    }
  }

  async function onAck(eventId, ok, errorMessage) {
    const entry = waitingAck.get(String(eventId));
    if (!entry) {
      logger.warn("ACK para evento desconhecido", { event_id: eventId });
      return;
    }
    clearTimeout(entry.timer);
    waitingAck.delete(String(eventId));
    try {
      await completeEvent(entry.row.id, ok, errorMessage);
      onStatus?.({ type: "queue", ok: true, message: `Concluído ${eventId}` });
    } catch (e) {
      onStatus?.({ type: "queue", ok: false, message: e instanceof Error ? e.message : String(e) });
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(tick, config.pollIntervalMs);
    void tick();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    for (const { timer: t } of waitingAck.values()) clearTimeout(t);
    waitingAck.clear();
  }

  return { start, stop, onAck, waitingCount: () => waitingAck.size };
}

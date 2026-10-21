import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { GiftEvent, LiveStatus } from "@/lib/live";
import { fetchIncomingGifts } from "@/lib/live.functions";
import { mergeGiftFeed } from "@/lib/gift-feed";

/** Live gift feed over Lovable Cloud realtime (replaces the old WebSocket channel). */
export function useGiftSocket(gameId: string) {
  const [events, setEvents] = useState<GiftEvent[]>([]);
  const [status, setStatus] = useState<LiveStatus>({ state: "reconnecting", mode: "demo", message: "Conectando ao canal de presentes…" });

  useEffect(() => {
    let stopped = false;
    let busy = false;
    let cursor = 0;
    const since = new Date().toISOString();
    const receive = (incoming: GiftEvent[]) => {
      if (stopped) return;
      setEvents((current) => mergeGiftFeed(current, incoming));
    };
    const recover = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const incoming = await fetchIncomingGifts({ data: { after: cursor, since } });
        receive(incoming);
        // Only polling advances this cursor: realtime may arrive out of order.
        for (const event of incoming) cursor = Math.max(cursor, event.sequence);
      } catch {
        if (!stopped) setStatus((current) => ({ ...current, message: "Recuperando conexão com os presentes…" }));
      } finally { busy = false; }
    };
    void recover();
    const timer = window.setInterval(recover, 1500);
    const channel = supabase
      .channel(`gifts-${gameId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_events", filter: `game_id=eq.${gameId}` }, (payload) => {
        const row = payload.new as { id: string; sequence: number; data: GiftEvent };
        const event = { ...row.data, id: row.id, sequence: row.sequence };
        receive([event]);
      })
      .subscribe((state) => {
        if (state === "SUBSCRIBED") void recover();
        else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") setStatus((c) => ({ ...c, state: "error", message: "Canal indisponível; a luta continua localmente" }));
        else if (state === "CLOSED") setStatus((c) => ({ ...c, state: "reconnecting", message: "Canal desconectado — tentando novamente" }));
      });
    return () => {
      stopped = true;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [gameId]);

  return { events, status };
}

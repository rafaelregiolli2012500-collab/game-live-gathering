import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { GiftEvent, LiveStatus } from "@/lib/live";

const MAX_EVENTS = 60;

/** Live gift feed over Lovable Cloud realtime (replaces the old WebSocket channel). */
export function useGiftSocket(gameId: string) {
  const [events, setEvents] = useState<GiftEvent[]>([]);
  const [status, setStatus] = useState<LiveStatus>({ state: "reconnecting", mode: "demo", message: "Conectando ao canal de presentes…" });
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const channel = supabase
      .channel(`gifts-${gameId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_events", filter: `game_id=eq.${gameId}` }, (payload) => {
        const row = payload.new as { id: string; sequence: number; data: GiftEvent };
        const event = { ...row.data, id: row.id, sequence: row.sequence };
        if (seen.current.has(event.event_id)) return;
        seen.current.add(event.event_id);
        setEvents((current) => [event, ...current].slice(0, MAX_EVENTS));
      })
      .subscribe((state) => {
        if (state === "SUBSCRIBED") setStatus({ state: "demo", mode: "demo", message: "DEMO ONLY — aguardando presentes simulados" });
        else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") setStatus((c) => ({ ...c, state: "error", message: "Canal indisponível; a luta continua localmente" }));
        else if (state === "CLOSED") setStatus((c) => ({ ...c, state: "reconnecting", message: "Canal desconectado — tentando novamente" }));
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gameId]);

  return { events, status };
}

import { useEffect, useState, useCallback } from "react";
import type { GiftEvent } from "@/lib/live";
import { mapQueueRowToGiftEvent, type LiveGameEventRow } from "@/lib/desktop-events";

export type DesktopBridgeState = "unavailable" | "disconnected" | "connected" | "error";

declare global {
  interface Window {
    desktopBridge?: {
      isDesktop: boolean;
      getStatus: () => Promise<{ ok: boolean; state: DesktopBridgeState; message: string }>;
      onGift: (handler: (payload: LiveGameEventRow) => void) => () => void;
      onStatus?: (handler: (status: { ok: boolean; state: string; message: string }) => void) => () => void;
      ackGift: (eventId: string, ok: boolean, error?: string) => Promise<void>;
      testIngest?: (payload: Record<string, unknown>) => Promise<{ ok: boolean; reason?: string }>;
    };
  }
}

export function useDesktopBridge(onGift: (event: GiftEvent) => void) {
  const [state, setState] = useState<DesktopBridgeState>("unavailable");
  const [message, setMessage] = useState("Navegador — use o app GAME.LIVE (desktop) para a fila live");

  const handleRow = useCallback(
    (row: LiveGameEventRow) => {
      const bridge = window.desktopBridge;
      try {
        const event = mapQueueRowToGiftEvent(row);
        onGift(event);
        void bridge?.ackGift(String(row.event_id || row.id), true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void bridge?.ackGift(String(row.event_id || row.id), false, msg);
      }
    },
    [onGift],
  );

  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge?.isDesktop) {
      setState("unavailable");
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const s = await bridge.getStatus();
        if (!cancelled) {
          setState(s.state);
          setMessage(s.message);
        }
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("Falha ao consultar serviço local");
        }
      }
    };
    void refresh();
    const iv = window.setInterval(refresh, 4000);
    const unsubGift = bridge.onGift(handleRow);
    const unsubStatus = bridge.onStatus?.((s) => {
      setState((s.state as DesktopBridgeState) || (s.ok ? "connected" : "error"));
      setMessage(s.message);
    });

    return () => {
      cancelled = true;
      window.clearInterval(iv);
      unsubGift();
      unsubStatus?.();
    };
  }, [handleRow]);

  return { state, message, isDesktop: Boolean(window.desktopBridge?.isDesktop) };
}

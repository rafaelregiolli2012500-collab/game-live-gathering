import type { GiftEvent } from "@/lib/live";

/** One ordered stream for realtime inserts and recovery polling. */
export function mergeGiftFeed(current: GiftEvent[], incoming: GiftEvent[]): GiftEvent[] {
  const events = new Map(current.map((event) => [event.event_id, event]));
  for (const event of incoming) events.set(event.event_id, event);
  return [...events.values()].sort((a, b) => b.sequence - a.sequence).slice(0, 60);
}

export type GiftDelivery = "queued" | "processing" | "completed";
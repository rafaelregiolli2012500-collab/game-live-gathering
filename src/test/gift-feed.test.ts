import { describe, expect, it } from "vitest";
import { mergeGiftFeed } from "@/lib/gift-feed";
import type { GiftEvent } from "@/lib/live";

const gift = (sequence: number): GiftEvent => ({
  id: `row-${sequence}`, event_id: `ext-${sequence}`, sequence,
  game_id: "main-arena", occurred_at: "2026-10-21T01:00:00.000Z",
  username: "maria", user_id: null, gift_id: "galaxy", gift_name: "Galáxia",
  quantity: 3, benefited_character: "lula", target_character: "flavio",
  action_name: "Genkidama", special_move: "genkidama", damage: 300,
  animation_ms: 5200, effect_intensity: 3, repeat_policy: "individual",
  reference_value: 1000, source: "provider", status: "processing",
});

describe("recovered gift delivery", () => {
  it("keeps user, gift, quantity and character from a recovered provider gift", () => {
    const [event] = mergeGiftFeed([], [gift(1)]);
    expect(event).toMatchObject({ username: "maria", gift_name: "Galáxia", quantity: 3, benefited_character: "lula", special_move: "genkidama" });
  });
  it("does not count the same gift twice from realtime and polling", () => {
    expect(mergeGiftFeed([gift(1)], [gift(1)])).toHaveLength(1);
  });
  it("recovers an older missed insert even if a newer realtime insert arrived first", () => {
    expect(mergeGiftFeed([gift(3)], [gift(1), gift(2), gift(3)]).map((event) => event.sequence)).toEqual([3, 2, 1]);
  });
});
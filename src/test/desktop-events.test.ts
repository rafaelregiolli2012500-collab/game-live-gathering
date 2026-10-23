import { describe, expect, it } from "vitest";
import { mapQueueRowToGiftEvent } from "@/lib/desktop-events";

describe("mapQueueRowToGiftEvent", () => {
  it("mapeia Rosa para lula", () => {
    const e = mapQueueRowToGiftEvent({
      id: "1",
      event_id: "TESTE_001",
      username: "jogador_teste",
      nickname: "jogador_teste",
      gift_name: "Rosa",
      gift_count: 1,
      coins: 1,
      comment: "#lula",
      character_key: "lula",
      status: "processing",
      created_at: new Date().toISOString(),
    });
    expect(e.gift_id).toBe("rose");
    expect(e.benefited_character).toBe("lula");
    expect(e.special_move).toBe("damage_boost");
    expect(e.event_id).toBe("TESTE_001");
  });

  it("character_key flavio", () => {
    const e = mapQueueRowToGiftEvent({
      id: "2",
      event_id: "E2",
      username: "u",
      nickname: "u",
      gift_name: "Galáxia",
      gift_count: 1,
      coins: 1000,
      comment: "",
      character_key: "flavio",
      status: "processing",
      created_at: null,
    });
    expect(e.gift_id).toBe("galaxy");
    expect(e.benefited_character).toBe("flavio");
    expect(e.special_move).toBe("genkidama");
  });

  it("presente desconhecido lança", () => {
    expect(() =>
      mapQueueRowToGiftEvent({
        id: "3",
        event_id: "E3",
        username: "u",
        nickname: null,
        gift_name: "PerfumeInexistente",
        gift_count: 1,
        coins: 0,
        comment: null,
        character_key: "lula",
        status: "pending",
        created_at: null,
      }),
    ).toThrow(/sem golpe/i);
  });
});

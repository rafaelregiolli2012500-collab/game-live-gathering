import { describe, expect, it } from "vitest";
import { DEFAULT_LIVE_CONFIG } from "@/lib/live";
import { classifyRaw, detectKeyword, guessUsername, matchRule, parseQuantity } from "@/lib/gift-bridge.server";

const kw = { keyword_lula: "#lula", keyword_flavio: "#flavio" };

describe("keyword detector", () => {
  it("#lula assigns Lula", () => expect(detectKeyword("bora #Lula", kw)).toBe("lula"));
  it("#flavio assigns Flávio, accents ignored", () => expect(detectKeyword("vai #Flávio!!", kw)).toBe("flavio"));
  it("last keyword wins", () => expect(detectKeyword("#flavio não, #lula", kw)).toBe("lula"));
  it("no keyword returns null", () => expect(detectKeyword("oi gente", kw)).toBeNull());
});

describe("gift matching", () => {
  const rules = DEFAULT_LIVE_CONFIG.rules;
  it("matches Portuguese name", () => expect(matchRule(rules, "Rosa")?.gift_id).toBe("rose"));
  it("matches English TikTok name inside text", () => expect(matchRule(rules, "sent Galaxy")?.gift_id).toBe("galaxy"));
  it("prefers TikTok Universe", () => expect(matchRule(rules, "TikTok Universe")?.gift_id).toBe("universe"));
  it("unknown gift is not matched", () => expect(matchRule(rules, "Perfume")).toBeUndefined());
});

describe("parseQuantity", () => {
  it("reads xN", () => expect(parseQuantity("Rosa x5")).toBe(5));
  it("reads ×N", () => expect(parseQuantity("Galaxy ×12")).toBe(12));
  it("reads Nx", () => expect(parseQuantity("enviou Martelo 3x")).toBe(3));
  it("reads isolated line number", () => expect(parseQuantity("joao\nRosa\n7")).toBe(7));
  it("defaults to 1", () => expect(parseQuantity("enviou Rosa")).toBe(1));
});

describe("raw page text", () => {
  const rules = DEFAULT_LIVE_CONFIG.rules;
  it("two-line comment row → chat for that user", () =>
    expect(classifyRaw("maria_22\nvamos #lula", kw, rules)).toEqual({ kind: "chat", username: "maria_22", message: "maria_22\nvamos #lula" }));
  it("'name: text' row gives the name", () => expect(guessUsername("joao: bora #flavio")).toBe("joao"));
  it("gift row reads gift and quantity", () =>
    expect(classifyRaw("joao\nenviou Galaxy\nx3", kw, rules)).toEqual({ kind: "gift", username: "joao", gift: "Galáxia", quantity: 3 }));
  it("gift row with Nx quantity", () =>
    expect(classifyRaw("ana\nmandou Rosa 5x", kw, rules)).toEqual({ kind: "gift", username: "ana", gift: "Rosa", quantity: 5 }));
  it("preferGift classifies gift even when keyword is present", () =>
    expect(classifyRaw("pedro\nenviou Galáxia x2 #lula", kw, rules, null, true)).toEqual({
      kind: "gift",
      username: "pedro",
      gift: "Galáxia",
      quantity: 2,
    }));
  it("a viewer named rosa_22 is not a Rose gift", () => expect(classifyRaw("rosa_22\noi gente", kw, rules)).toBeNull());
  it("level badges are not the username", () => expect(guessUsername("12\npedro\nmandou Rosa x2")).toBe("pedro"));
});

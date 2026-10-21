import { describe, expect, it } from "vitest";
import { DEFAULT_LIVE_CONFIG } from "@/lib/live";
import { detectKeyword, matchRule } from "@/lib/gift-bridge.server";

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

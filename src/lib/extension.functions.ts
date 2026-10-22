import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { GiftEvent } from "@/lib/live";

export interface ExtensionPanelData {
  token: string;
  keyword_lula: string;
  keyword_flavio: string;
  default_character: "none" | "lula" | "flavio";
  last_seen_at: string | null;
  teams: { username: string; character: "lula" | "flavio"; source_text: string | null; updated_at: string }[];
  gifts: GiftEvent[];
  activity: { id: number; kind: string; ok: boolean; text: string; created_at: string }[];
  images: { image_key: string; preview: string | null; image_url: string | null; gift_id: string | null; guess: string | null; source: string }[];
  rules: { gift_id: string; gift_name: string }[];
}

export const getExtensionPanel = createServerFn({ method: "GET" }).handler(async (): Promise<ExtensionPanelData> => {
  const bridge = await import("@/lib/gift-bridge.server");
  const db = await bridge.getAdmin();
  const s = await bridge.readSettings(db);
  const { data } = await db.from("viewer_teams").select("username, character, source_text, updated_at").eq("game_id", bridge.GAME_ID).order("updated_at", { ascending: false }).limit(30);
  const { data: rows, error } = await db.from("live_events").select("id, sequence, data").eq("game_id", bridge.GAME_ID).eq("data->>source", "provider").order("sequence", { ascending: false }).limit(30);
  if (error) throw new Error("Não foi possível ler os presentes recebidos");
  const gifts = (rows ?? []).map((row) => ({ ...(row.data as unknown as GiftEvent), id: row.id, sequence: row.sequence }));
  const { data: activity } = await db.from("extension_activity").select("id, kind, ok, text, created_at").eq("game_id", bridge.GAME_ID).order("created_at", { ascending: false }).limit(20);
  const { data: images } = await db.from("gift_images").select("image_key, preview, image_url, gift_id, guess, source").eq("game_id", bridge.GAME_ID).order("updated_at", { ascending: false }).limit(30);
  const config = await bridge.readConfig(db);
  const rules = config.rules.filter((r) => r.enabled).map((r) => ({ gift_id: r.gift_id, gift_name: r.gift_name }));
  return { activity: activity ?? [], images: images ?? [], rules, token: s.token, keyword_lula: s.keyword_lula, keyword_flavio: s.keyword_flavio, default_character: s.default_character, last_seen_at: s.last_seen_at, teams: (data ?? []) as ExtensionPanelData["teams"], gifts };
});

export const updateExtensionSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      keyword_lula: z.string().trim().min(1).max(40),
      keyword_flavio: z.string().trim().min(1).max(40),
      default_character: z.enum(["none", "lula", "flavio"]),
      regenerate_token: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const bridge = await import("@/lib/gift-bridge.server");
    const db = await bridge.getAdmin();
    await bridge.readSettings(db);
    const { regenerate_token, ...rest } = data;
    const { error } = await db.from("extension_settings").update({ ...rest, ...(regenerate_token ? { token: bridge.newToken() } : {}), updated_at: new Date().toISOString() }).eq("id", "default");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearViewerTeams = createServerFn({ method: "POST" }).handler(async () => {
  const bridge = await import("@/lib/gift-bridge.server");
  const db = await bridge.getAdmin();
  await db.from("viewer_teams").delete().eq("game_id", bridge.GAME_ID);
  return { ok: true };
});

/** Manually maps a gift icon seen on the live to a game gift (or "" to ignore it). */
export const setGiftImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ image_key: z.string().min(1).max(200), gift_id: z.string().max(60) }).parse(input))
  .handler(async ({ data }) => {
    const bridge = await import("@/lib/gift-bridge.server");
    const db = await bridge.getAdmin();
    const { error } = await db.from("gift_images").update({ gift_id: data.gift_id || null, source: "manual", updated_at: new Date().toISOString() }).eq("game_id", bridge.GAME_ID).eq("image_key", data.image_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

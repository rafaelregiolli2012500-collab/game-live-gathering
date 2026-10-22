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
}

export const getExtensionPanel = createServerFn({ method: "GET" }).handler(async (): Promise<ExtensionPanelData> => {
  const bridge = await import("@/lib/gift-bridge.server");
  const db = await bridge.getAdmin();
  const s = await bridge.readSettings(db);
  const { data } = await db.from("viewer_teams").select("username, character, source_text, updated_at").eq("game_id", bridge.GAME_ID).order("updated_at", { ascending: false }).limit(30);
  const { data: rows, error } = await db.from("live_events").select("id, sequence, data").eq("game_id", bridge.GAME_ID).eq("data->>source", "provider").order("sequence", { ascending: false }).limit(30);
  if (error) throw new Error("Não foi possível ler os presentes recebidos");
  const gifts = (rows ?? []).map((row) => ({ ...(row.data as unknown as GiftEvent), id: row.id, sequence: row.sequence }));
  return { token: s.token, keyword_lula: s.keyword_lula, keyword_flavio: s.keyword_flavio, default_character: s.default_character, last_seen_at: s.last_seen_at, teams: (data ?? []) as ExtensionPanelData["teams"], gifts };
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

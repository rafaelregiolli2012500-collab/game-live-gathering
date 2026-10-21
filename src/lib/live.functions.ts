import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { DEFAULT_LIVE_CONFIG } from "@/lib/live";
import type { GiftEvent, LiveConfig, LiveStatus, RoundResult } from "@/lib/live";

const GAME_ID = "main-arena";
const CONFIG_ID = "default";
const RULES_VERSION = 9;
const character = z.enum(["lula", "flavio"]);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function readConfig(): Promise<LiveConfig> {
  const db = await admin();
  const { data, error } = await db.from("live_config").select("data").eq("id", CONFIG_ID).maybeSingle();
  if (error) throw new Error(error.message);
  const stored = data?.data as LiveConfig | undefined;
  if (stored && (stored.rules_version ?? 1) >= RULES_VERSION) return stored;
  const config: LiveConfig = stored
    ? {
        ...stored,
        rules: [
          ...DEFAULT_LIVE_CONFIG.rules,
          ...(stored.rules ?? []).filter((r) => !DEFAULT_LIVE_CONFIG.rules.some((d) => d.gift_id === r.gift_id)),
        ],
        rules_version: RULES_VERSION,
        combat: { ...DEFAULT_LIVE_CONFIG.combat, ...stored.combat },
      }
    : DEFAULT_LIVE_CONFIG;
  await db.from("live_config").upsert({ id: CONFIG_ID, data: config as never });
  return config;
}

export const fetchLiveConfig = createServerFn({ method: "GET" }).handler(async () => readConfig());

const ruleSchema = z.object({
  gift_id: z.string().min(1).max(60),
  gift_name: z.string().min(1).max(60),
  reference_value: z.number().int().min(0).max(1_000_000),
  action_name: z.string().max(80),
  damage: z.number().int().min(0).max(10_000),
  animation_ms: z.number().int().min(100).max(15_000),
  effect_intensity: z.number().min(0.1).max(3),
  target_character: z.enum(["opponent", "lula", "flavio"]),
  enabled: z.boolean(),
  repeat_policy: z.enum(["individual", "group"]),
  special_move: z.enum(["none", "hadouken", "shoryuken", "ultra_hadouken", "domain", "invocadores", "genkidama", "damage_boost", "defense_boost"]),
});

export const updateLiveConfig = createServerFn({ method: "POST" })
  .inputValidator((input: LiveConfig) =>
    z.object({
      id: z.string(),
      integration_mode: z.enum(["demo", "live"]),
      rules: z.array(ruleSchema).max(100),
      rules_version: z.number(),
      combat: z.record(z.string(), z.unknown()),
    }).parse(input) as unknown as LiveConfig,
  )
  .handler(async ({ data }) => {
    const config = { ...data, id: CONFIG_ID, combat: { ...DEFAULT_LIVE_CONFIG.combat, ...data.combat } };
    const db = await admin();
    const { error } = await db.from("live_config").upsert({ id: CONFIG_ID, data: config as never, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return config;
  });

export const fetchLiveStatus = createServerFn({ method: "GET" }).handler(async (): Promise<LiveStatus> => {
  const config = await readConfig();
  return config.integration_mode === "demo"
    ? { state: "demo", mode: "demo", message: "Modo DEMO ativo — sem conexão real com TikTok" }
    : { state: "disconnected", mode: "live", message: "Conector real não configurado" };
});

function toEvent(row: { id: string; sequence: number; data: unknown }): GiftEvent {
  return { ...(row.data as GiftEvent), id: row.id, sequence: row.sequence };
}

export const fetchLiveEvents = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db.from("live_events").select("id, sequence, data").eq("game_id", GAME_ID).order("sequence", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toEvent);
});

/** Recover missed realtime inserts without replaying gifts from before this page opened. */
export const fetchIncomingGifts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({
    after: z.number().int().min(0),
    since: z.string().datetime(),
  }).parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: rows, error } = await db.from("live_events")
      .select("id, sequence, data").eq("game_id", GAME_ID)
      .gt("sequence", data.after).gte("created_at", data.since)
      .order("sequence", { ascending: true }).limit(100);
    if (error) throw new Error("Não foi possível recuperar os presentes");
    return (rows ?? []).map(toEvent);
  });

export const sendDemoGift = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      gift_id: z.string().min(1).max(60),
      username: z.string().trim().min(1).max(32),
      quantity: z.number().int().min(1).max(999),
      benefited_character: character,
      event_id: z.string().max(120).optional(),
      user_id: z.string().max(120).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const config = await readConfig();
    if (config.integration_mode !== "demo") throw new Error("Simulação disponível apenas no modo DEMO");
    const rule = config.rules.find((r) => r.gift_id === data.gift_id && r.enabled);
    if (!rule) throw new Error("Presente sem associação ativa");
    const eventId = data.event_id ?? `demo-${crypto.randomUUID()}`;
    const target = rule.target_character === "opponent" ? (data.benefited_character === "lula" ? "flavio" : "lula") : rule.target_character;
    const payload = {
      game_id: GAME_ID,
      event_id: eventId,
      occurred_at: new Date().toISOString(),
      username: data.username,
      user_id: data.user_id ?? null,
      gift_id: rule.gift_id,
      gift_name: rule.gift_name,
      quantity: data.quantity,
      benefited_character: data.benefited_character,
      target_character: target,
      action_name: rule.action_name,
      damage: rule.damage,
      animation_ms: rule.animation_ms,
      effect_intensity: rule.effect_intensity,
      repeat_policy: rule.repeat_policy,
      special_move: rule.special_move,
      reference_value: rule.reference_value,
      source: "demo",
      status: "processing",
    };
    const db = await admin();
    const existing = await db.from("live_events").select("id, sequence, data").eq("game_id", GAME_ID).eq("event_id", eventId).maybeSingle();
    if (existing.data) return toEvent(existing.data);
    const { data: row, error } = await db.from("live_events").insert({ game_id: GAME_ID, event_id: eventId, data: payload as never }).select("id, sequence, data").single();
    if (error) throw new Error(error.message);
    return toEvent(row);
  });

export const fetchRoundResults = createServerFn({ method: "GET" }).handler(async (): Promise<RoundResult[]> => {
  const db = await admin();
  const { data, error } = await db.from("round_results").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, contributors: (r.contributors as string[]) ?? [] })) as RoundResult[];
});

export const saveRoundResult = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      game_id: z.string().min(1).max(80).default(GAME_ID),
      session_id: z.string().min(1).max(120),
      round: z.number().int().min(1),
      winner: character,
      loser: character,
      contributors: z.array(z.string().max(64)).max(500).default([]),
      gifts_count: z.number().int().min(0).default(0),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("round_results").upsert(data, { onConflict: "game_id,session_id,round", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    const { data: row } = await db.from("round_results").select("*").eq("game_id", data.game_id).eq("session_id", data.session_id).eq("round", data.round).single();
    return { ...row, contributors: (row?.contributors as string[]) ?? [] } as RoundResult;
  });

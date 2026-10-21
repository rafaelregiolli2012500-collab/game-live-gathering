import { DEFAULT_LIVE_CONFIG } from "@/lib/live";
import type { CharacterId, GiftEvent, GiftRule, LiveConfig } from "@/lib/live";

export const GAME_ID = "main-arena";
const SETTINGS_ID = "default";

type Admin = Awaited<ReturnType<typeof getAdmin>>;
export async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface ExtensionSettings {
  token: string;
  keyword_lula: string;
  keyword_flavio: string;
  default_character: "none" | CharacterId;
  last_seen_at: string | null;
}

export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return "bfa_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function readSettings(db: Admin): Promise<ExtensionSettings> {
  const { data } = await db.from("extension_settings").select("*").eq("id", SETTINGS_ID).maybeSingle();
  if (data) return data as ExtensionSettings;
  const row = { id: SETTINGS_ID, token: newToken() };
  const { data: created, error } = await db.from("extension_settings").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return created as ExtensionSettings;
}

export async function readConfig(db: Admin): Promise<LiveConfig> {
  const { data } = await db.from("live_config").select("data").eq("id", "default").maybeSingle();
  return (data?.data as LiveConfig | undefined) ?? DEFAULT_LIVE_CONFIG;
}

export const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** English TikTok names for the default catalogue, so the extension works with either UI language. */
const ALIASES: Record<string, string[]> = {
  rose: ["rose", "rosa"],
  heart: ["heart", "coracao", "heart me", "finger heart"],
  donut: ["donut", "doughnut", "rosquinha"],
  lion: ["lion", "leao"],
  universe: ["universe", "tiktok universe", "universo"],
  hammer: ["hammer", "martelo"],
  galaxy: ["galaxy", "galaxia"],
};

export function matchRule(rules: GiftRule[], giftText: string): GiftRule | undefined {
  const text = normalize(giftText);
  if (!text) return undefined;
  const enabled = rules.filter((r) => r.enabled);
  const names = (r: GiftRule) => [normalize(r.gift_name), normalize(r.gift_id), ...(ALIASES[r.gift_id] ?? [])];
  return (
    enabled.find((r) => names(r).includes(text)) ??
    // Longest name contained in the text wins ("tiktok universe" before "universe").
    enabled
      .flatMap((r) => names(r).map((n) => ({ r, n })))
      .filter(({ n }) => n.length >= 3 && new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(text))
      .sort((a, b) => b.n.length - a.n.length)[0]?.r
  );
}

/** Returns the character a chat message is cheering for, or null. */
export function detectKeyword(message: string, settings: Pick<ExtensionSettings, "keyword_lula" | "keyword_flavio">): CharacterId | null {
  const text = normalize(message);
  const lula = normalize(settings.keyword_lula);
  const flavio = normalize(settings.keyword_flavio);
  const iL = lula ? text.lastIndexOf(lula) : -1;
  const iF = flavio ? text.lastIndexOf(flavio) : -1;
  if (iL < 0 && iF < 0) return null;
  return iL > iF ? "lula" : "flavio";
}

export const cleanUsername = (value: string) => value.replace(/^@+/, "").trim().slice(0, 32);

export async function ingestChat(db: Admin, settings: ExtensionSettings, username: string, message: string) {
  const character = detectKeyword(message, settings);
  if (!character) return { assigned: null };
  const user = cleanUsername(username);
  if (!user) return { assigned: null };
  const { error } = await db.from("viewer_teams").upsert(
    { game_id: GAME_ID, username: normalize(user), character, source_text: message.slice(0, 200), updated_at: new Date().toISOString() },
    { onConflict: "game_id,username" },
  );
  if (error) throw new Error(error.message);
  return { assigned: character };
}

export async function ingestGift(
  db: Admin,
  settings: ExtensionSettings,
  input: { username: string; gift: string; quantity: number; event_id: string },
): Promise<{ ok: true; event: GiftEvent } | { ok: false; reason: string }> {
  const config = await readConfig(db);
  const rule = matchRule(config.rules, input.gift);
  if (!rule) return { ok: false, reason: `Presente "${input.gift}" não está no mapa de presentes` };
  const username = cleanUsername(input.username) || "anonimo";
  const { data: team } = await db.from("viewer_teams").select("character").eq("game_id", GAME_ID).eq("username", normalize(username)).maybeSingle();
  const benefited = (team?.character as CharacterId | undefined) ?? (settings.default_character === "none" ? null : settings.default_character);
  if (!benefited) return { ok: false, reason: `@${username} ainda não escolheu personagem (${settings.keyword_lula} ou ${settings.keyword_flavio})` };
  const target: CharacterId = rule.target_character === "opponent" ? (benefited === "lula" ? "flavio" : "lula") : rule.target_character;
  const eventId = `ext-${input.event_id}`.slice(0, 120);
  const existing = await db.from("live_events").select("id, sequence, data").eq("game_id", GAME_ID).eq("event_id", eventId).maybeSingle();
  if (existing.data) return { ok: true, event: { ...(existing.data.data as GiftEvent), id: existing.data.id, sequence: existing.data.sequence } };
  const payload = {
    game_id: GAME_ID,
    event_id: eventId,
    occurred_at: new Date().toISOString(),
    username,
    user_id: null,
    gift_id: rule.gift_id,
    gift_name: rule.gift_name,
    quantity: Math.max(1, Math.min(999, Math.floor(input.quantity) || 1)),
    benefited_character: benefited,
    target_character: target,
    action_name: rule.action_name,
    damage: rule.damage,
    animation_ms: rule.animation_ms,
    effect_intensity: rule.effect_intensity,
    repeat_policy: rule.repeat_policy,
    special_move: rule.special_move,
    reference_value: rule.reference_value,
    source: "provider",
    status: "processing",
  };
  const { data: row, error } = await db.from("live_events").insert({ game_id: GAME_ID, event_id: eventId, data: payload as never }).select("id, sequence, data").single();
  if (error) throw new Error(error.message);
  return { ok: true, event: { ...(row.data as GiftEvent), id: row.id, sequence: row.sequence } };
}

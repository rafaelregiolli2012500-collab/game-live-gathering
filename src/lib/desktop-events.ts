import type { CharacterId, GiftEvent } from "@/lib/live";
import { DEFAULT_LIVE_CONFIG } from "@/lib/live";

export interface LiveGameEventRow {
  id: string;
  event_id: string;
  username: string | null;
  nickname: string | null;
  gift_name: string | null;
  gift_count: number | null;
  coins: number | null;
  comment: string | null;
  character_key: string | null;
  status: string | null;
  created_at: string | null;
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function pickCharacter(key: string | null | undefined): CharacterId {
  const k = (key || "").toLowerCase().trim();
  if (k === "lula") return "lula";
  if (k === "flavio" || k === "flávio") return "flavio";
  return Math.random() < 0.5 ? "lula" : "flavio";
}

export function mapQueueRowToGiftEvent(row: LiveGameEventRow, rules = DEFAULT_LIVE_CONFIG.rules): GiftEvent {
  const name = (row.gift_name || "").trim();
  const n = normalize(name);
  const rule =
    rules.find((r) => r.enabled && normalize(r.gift_name) === n) ||
    rules.find((r) => r.enabled && r.gift_id === n) ||
    rules.find((r) => r.enabled && n.includes(r.gift_id));

  if (!rule) {
    throw new Error(`Presente sem golpe configurado: "${name}"`);
  }

  const benefited = pickCharacter(row.character_key);
  const target: CharacterId =
    rule.target_character === "opponent" ? (benefited === "lula" ? "flavio" : "lula") : rule.target_character;
  const quantity = Math.max(1, Math.min(999, Math.floor(Number(row.gift_count) || 1)));
  const eventId = String(row.event_id || row.id);

  return {
    id: eventId,
    game_id: "main-arena",
    sequence: 0,
    event_id: eventId,
    occurred_at: row.created_at || new Date().toISOString(),
    username: (row.username || row.nickname || "anonimo").replace(/^@+/, "").slice(0, 32),
    user_id: null,
    gift_id: rule.gift_id,
    gift_name: rule.gift_name,
    quantity,
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
}

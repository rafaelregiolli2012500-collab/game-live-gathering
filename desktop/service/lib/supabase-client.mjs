import { createClient } from "@supabase/supabase-js";
import { config } from "./config.mjs";
import { logger } from "./logger.mjs";

let client = null;

export function getSupabase() {
  if (!config.supabaseUrl || !config.supabaseKey) {
    throw new Error("Supabase não configurado (SUPABASE_URL / chave)");
  }
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/**
 * Tenta RPC claim_live_game_events; se não existir, fallback select+update (menos seguro).
 */
export async function claimPendingEvents(limit) {
  const sb = getSupabase();
  const { data: rpcData, error: rpcError } = await sb.rpc("claim_live_game_events", {
    p_limit: limit,
    p_processor_id: config.processorId,
    p_lease_seconds: config.leaseSeconds,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    return { rows: rpcData, mode: "rpc" };
  }

  if (rpcError && !/could not find|function|does not exist/i.test(rpcError.message || "")) {
    logger.warn("RPC claim falhou", { error: rpcError.message });
  }

  // Fallback: SELECT pending ORDER BY created_at, depois UPDATE para processing
  const { data, error } = await sb
    .from("live_game_events")
    .select("id,event_id,username,nickname,gift_name,gift_count,coins,comment,character_key,status,created_at")
    .eq("status", config.statusPending)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const claimed = [];
  for (const row of data || []) {
    const { data: updated, error: upErr } = await sb
      .from("live_game_events")
      .update({ status: config.statusProcessing })
      .eq("id", row.id)
      .eq("status", config.statusPending)
      .select("id,event_id,username,nickname,gift_name,gift_count,coins,comment,character_key,status,created_at")
      .maybeSingle();
    if (!upErr && updated) claimed.push(updated);
  }
  return { rows: claimed, mode: "fallback" };
}

export async function completeEvent(id, ok, errorMessage) {
  const sb = getSupabase();
  const status = ok ? config.statusDone : config.statusFailed;
  const patch = { status };
  // Campos opcionais se existirem no schema (ignorados se coluna não existir)
  const { error } = await sb.from("live_game_events").update(patch).eq("id", id);
  if (error) {
    logger.error("Falha ao concluir evento", { id, error: error.message, errorMessage });
    throw error;
  }
}

export async function requeueExpiredProcessing() {
  const sb = getSupabase();
  const { error } = await sb.rpc("requeue_expired_live_game_events", {
    p_lease_seconds: config.leaseSeconds,
  });
  if (error && !/could not find|function|does not exist/i.test(error.message || "")) {
    logger.warn("requeue RPC indisponível", { error: error.message });
  }
}

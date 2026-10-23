import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.join(__dirname, "..");

export function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvFile(path.join(serviceRoot, ".env"));

function num(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  serviceRoot,
  processorId: process.env.PROCESSOR_ID || `proc-${process.pid}`,
  supabaseUrl: process.env.SUPABASE_URL || "https://cudjcpheouvumwalslff.supabase.co",
  /** Prefer a restricted key; service_role only for local streamer machine if no RPC exists */
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "",
  gameLiveToken: process.env.GAME_LIVE_TOKEN || "",
  edgeFunctionUrl:
    process.env.EDGE_FUNCTION_URL ||
    "https://cudjcpheouvumwalslff.supabase.co/functions/v1/game-live-events",
  pollIntervalMs: num("POLL_INTERVAL_MS", 1500),
  batchSize: Math.max(1, Math.min(50, num("BATCH_SIZE", 10))),
  leaseSeconds: num("LEASE_SECONDS", 60),
  maxAttempts: num("MAX_ATTEMPTS", 5),
  statusPending: process.env.STATUS_PENDING || "pending",
  statusProcessing: process.env.STATUS_PROCESSING || "processing",
  statusDone: process.env.STATUS_DONE || "done",
  statusFailed: process.env.STATUS_FAILED || "failed",
  /** TikFinity local Event API / webhook listen */
  tikfinityListenHost: process.env.TIKFINITY_LISTEN_HOST || "127.0.0.1",
  tikfinityListenPort: num("TIKFINITY_LISTEN_PORT", 8787),
  tikfinityWebhookPath: process.env.TIKFINITY_WEBHOOK_PATH || "/tikfinity/event",
  /** Optional: TikFinity Event API WebSocket URL if user configures it */
  tikfinityWsUrl: process.env.TIKFINITY_WS_URL || "",
};

export function configStatus() {
  const missing = [];
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseKey) missing.push("SUPABASE_SERVICE_ROLE_KEY (ou chave com permissão de fila)");
  if (!config.gameLiveToken) missing.push("GAME_LIVE_TOKEN (para POST na Edge Function)");
  return {
    ok: missing.length === 0,
    missing,
    processorId: config.processorId,
    supabaseUrl: config.supabaseUrl,
    hasKey: Boolean(config.supabaseKey),
    hasToken: Boolean(config.gameLiveToken),
  };
}

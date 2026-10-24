import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-game-token",
};

const bodySchema = z.object({
  event_id: z.string().min(1).max(120),
  username: z.string().max(80).nullish(),
  nickname: z.string().max(80).nullish(),
  gift_name: z.string().min(1).max(120),
  gift_count: z.number().int().min(1).max(999).default(1),
  coins: z.number().int().min(0).max(10_000_000).default(0),
  comment: z.string().max(500).nullish(),
  character_key: z.enum(["lula", "flavio"]).nullish(),
});

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

/**
 * Entrada de presentes do app desktop GAME.LIVE (TikFinity → serviço local → aqui).
 * Autenticação: header x-game-token deve ser igual ao segredo GAME_LIVE_TOKEN.
 * Insere na fila live_game_events; o serviço desktop reserva (claim) e entrega ao jogo.
 */
export const Route = createFileRoute("/api/public/game-live-events")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const expected = process.env["GAME_LIVE_TOKEN"] ?? "";
        const token = request.headers.get("x-game-token") ?? "";
        if (!expected || !token || token !== expected) {
          return json({ ok: false, error: "Token inválido" }, 401);
        }
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "Dados inválidos" }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const body = parsed.data;
        const { data, error } = await supabaseAdmin
          .from("live_game_events")
          .upsert(
            {
              event_id: body.event_id,
              username: body.username ?? null,
              nickname: body.nickname ?? body.username ?? null,
              gift_name: body.gift_name,
              gift_count: body.gift_count,
              coins: body.coins,
              comment: body.comment ?? null,
              character_key: body.character_key ?? null,
              status: "pending",
            },
            { onConflict: "event_id", ignoreDuplicates: true },
          )
          .select("id, event_id, status")
          .maybeSingle();
        if (error) return json({ ok: false, error: "Falha ao enfileirar presente" }, 500);
        return json({ ok: true, queued: true, event_id: body.event_id, id: data?.id ?? null });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-extension-token",
};

const bodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("gift"), username: z.string().max(80), gift: z.string().min(1).max(120), quantity: z.number().int().min(1).max(999), event_id: z.string().min(1).max(100) }),
  z.object({ type: z.literal("chat"), username: z.string().min(1).max(80), message: z.string().min(1).max(500) }),
  // Raw text read from the page (DOM text or OCR); the server decides if it is a comment or a gift.
  z.object({ type: z.literal("raw"), text: z.string().min(1).max(600), username: z.string().max(80).nullish(), quantity: z.number().int().min(1).max(999).nullish(), event_id: z.string().min(1).max(100) }),
  z.object({ type: z.literal("ping") }),
]);

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

export const Route = createFileRoute("/api/public/extension/event")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const bridge = await import("@/lib/gift-bridge.server");
        const db = await bridge.getAdmin();
        const settings = await bridge.readSettings(db);
        const token = request.headers.get("x-extension-token") ?? "";
        if (!token || token !== settings.token) return json({ ok: false, reason: "Código de conexão inválido" }, 401);
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, reason: "Dados inválidos" }, 400);
        await db.from("extension_settings").update({ last_seen_at: new Date().toISOString() }).eq("id", "default");
        const body = parsed.data;
        if (body.type === "ping") {
          const config = await bridge.readConfig(db);
          return json({ ok: true, keywords: [settings.keyword_lula, settings.keyword_flavio], gifts: config.rules.filter((r) => r.enabled).map((r) => r.gift_name), terms: bridge.matchTerms(config.rules, settings) });
        }
        if (body.type === "chat") return json({ ok: true, kind: "chat", ...(await bridge.ingestChat(db, settings, body.username, body.message)) });
        let gift: { username: string; gift: string; quantity: number; event_id: string } = body as never;
        if (body.type === "raw") {
          const config = await bridge.readConfig(db);
          const found = bridge.classifyRaw(body.text, settings, config.rules, body.username);
          if (!found) return json({ ok: false, kind: "none", reason: "Sem palavra-chave nem presente conhecido" });
          if (found.kind === "chat") {
            if (!found.username) return json({ ok: false, kind: "chat", reason: "Nome do usuário não encontrado" });
            return json({ ok: true, kind: "chat", username: found.username, ...(await bridge.ingestChat(db, settings, found.username, found.message)) });
          }
          gift = { username: found.username, gift: found.gift, quantity: body.quantity ?? found.quantity, event_id: body.event_id };
        }
        const result = await bridge.ingestGift(db, settings, gift);
        return json(result.ok ? { ok: true, kind: "gift", username: gift.username, gift: result.event.gift_name, quantity: gift.quantity, character: result.event.benefited_character } : { ...result, kind: "gift", username: gift.username });
      },
    },
  },
});

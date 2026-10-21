import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-extension-token",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
const bodySchema = z.object({ image: z.string().startsWith("data:image/").max(3_000_000) });

/** Image reading (OCR) for the extension: returns the rows it can read; the extension then sends them as events. */
export const Route = createFileRoute("/api/public/extension/ocr")({
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
        if (!parsed.success) return json({ ok: false, reason: "Imagem inválida" }, 400);
        const config = await bridge.readConfig(db);
        const { readLiveImage } = await import("@/lib/ocr.server");
        try {
          const items = await readLiveImage(parsed.data.image, config.rules.filter((r) => r.enabled).map((r) => r.gift_name), [settings.keyword_lula, settings.keyword_flavio], request.signal);
          return json({ ok: true, items });
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          const message = e instanceof Error ? e.message : String(e);
          return json({ ok: false, reason: status === 402 ? "Créditos de IA esgotados" : status === 429 ? "Muitas leituras, aguarde" : "Falha na leitura por imagem: " + message.slice(0, 160) }, status && status >= 400 && status < 600 ? status : 500);
        }
      },
    },
  },
});

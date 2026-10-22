import { createOpenAI } from "@ai-sdk/openai";
import { jsonSchema, Output, streamText } from "ai";

export interface OcrItem {
  kind: "chat" | "gift";
  username: string;
  text: string;
  gift: string | null;
  quantity: number | null;
}

const schema = jsonSchema<{ items: OcrItem[] }>({
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "username", "text", "gift", "quantity"],
        properties: {
          kind: { type: "string", enum: ["chat", "gift"] },
          username: { type: "string" },
          text: { type: "string" },
          gift: { type: ["string", "null"] },
          quantity: { type: ["integer", "null"] },
        },
      },
    },
  },
});

/** Reads a screenshot of a TikTok-style live chat/gift area and returns every visible row. */
export async function readLiveImage(dataUrl: string, giftNames: string[], keywords: string[], signal?: AbortSignal): Promise<OcrItem[]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    output: Output.object({ schema }),
    ...(signal ? { abortSignal: signal } : {}),
    maxRetries: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "This is a screenshot of a live stream chat / gift feed. List every visible row, top to bottom. " +
              "For each row give the viewer's username exactly as written (without @), the full row text, " +
              `kind "gift" if the row shows a gift being sent (gift name or icon, often with xN), otherwise "chat". ` +
              `Known gift names (Portuguese or English): ${giftNames.join(", ")}. If the gift is one of these, write that name in "gift"; otherwise the visible gift name or null. ` +
              `quantity = the xN number for gifts, else null. Keep hashtags like ${keywords.join(" ")} exactly in text. Return an empty list if nothing is readable.`,
          },
          { type: "image", image: new URL(dataUrl) },
        ],
      },
    ],
    providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", include: ["reasoning.encrypted_content"] } },
  });
  const out = await result.output;
  return (out?.items ?? []).slice(0, 40);
}

const giftSchema = jsonSchema<{ gift_id: string; guess: string }>({
  type: "object",
  additionalProperties: false,
  required: ["gift_id", "guess"],
  properties: { gift_id: { type: "string" }, guess: { type: "string" } },
});

/** Recognises one gift icon (e.g. a TikTok gift image) against the game's gift list. */
export async function identifyGiftImage(dataUrl: string, rules: { gift_id: string; gift_name: string }[]): Promise<{ gift_id: string | null; guess: string | null }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const list = rules.map((r) => `${r.gift_id} = ${r.gift_name}`).join("; ");
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    output: Output.object({ schema: giftSchema }),
    maxRetries: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "This is the icon of a gift sent in a live stream (usually a TikTok gift). " +
              `Which of these gifts is it? ${list}. Answer gift_id with one of the ids above (TikTok: Rose=rose, Heart Me/Finger Heart=heart, Doughnut=donut, Lion=lion, TikTok Universe=universe, Galaxy=galaxy), ` +
              `or "none" if it is not one of them. guess = the gift's real name as you recognise it (e.g. "Rose", "GG", "Ice Cream Cone").`,
          },
          { type: "image", image: new URL(dataUrl) },
        ],
      },
    ],
    providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", include: ["reasoning.encrypted_content"] } },
  });
  const out = await result.output;
  const id = out?.gift_id && out.gift_id !== "none" && rules.some((r) => r.gift_id === out.gift_id) ? out.gift_id : null;
  return { gift_id: id, guess: out?.guess?.slice(0, 60) || null };
}

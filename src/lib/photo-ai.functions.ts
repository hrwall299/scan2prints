import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["layout", "fit", "focus_x", "focus_y", "zoom", "reason"],
  properties: {
    layout: { type: "string", enum: ["1-up", "2-up", "4-up", "6-up", "passport"] },
    fit: { type: "string", enum: ["cover", "contain"] },
    focus_x: { type: "number", description: "Horizontal focus point of the main subject, 0=left, 1=right" },
    focus_y: { type: "number", description: "Vertical focus point of the main subject, 0=top, 1=bottom" },
    zoom: { type: "number", description: "Crop zoom 1 to 2.5; 1 = no extra zoom" },
    reason: { type: "string", description: "One short sentence for the customer" },
  },
};

const INSTRUCTIONS = `You are a photo print assistant for an A4 print shop. Look at the photo and recommend:
- layout: "passport" only for a frontal head-and-shoulders ID-style portrait on a plain background; "1-up" for detailed landscapes or group shots; "2-up" for landscape-orientation photos; "4-up" for typical snapshots; "6-up" for small keepsakes/simple subjects.
- fit: "cover" to fill the box (crop edges) unless important content touches the edges, then "contain".
- focus_x/focus_y: where the main subject (e.g. faces) is, so cropping keeps it.
- zoom: 1 unless the subject is small and should be tightened (passport usually 1.3-1.8 to frame the face).
Reply with one short plain-language reason.`;

export type PhotoAdvice = { layout: "1-up" | "2-up" | "4-up" | "6-up" | "passport"; fit: "cover" | "contain"; focus_x: number; focus_y: number; zoom: number; reason: string };

export const recommendPhotoLayout = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ image: z.string().regex(/^data:image\/(jpeg|png);base64,/).max(2_000_000) }).parse(d))
  .handler(async ({ data }): Promise<PhotoAdvice> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI suggestions are not configured.");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions: INSTRUCTIONS,
        input: [{ role: "user", content: [{ type: "input_text", text: "Recommend a print layout and crop for this photo." }, { type: "input_image", image_url: data.image }] }],
        text: { format: { type: "json_schema", name: "photo_advice", strict: true, schema } },
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        stream: true,
        store: false,
      }),
    });
    if (!res.ok || !res.body) {
      let msg = "";
      try { const j = await res.json(); msg = j?.error?.message ?? j?.message ?? ""; } catch { /* ignore */ }
      if (res.status === 429) throw new Error("Too many AI requests right now — please try again in a minute.");
      if (res.status === 402) throw new Error(msg || "AI credits have run out for this shop.");
      throw new Error(msg || `AI suggestion failed (${res.status}).`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "", final = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const p = line.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try {
          const ev = JSON.parse(p);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
          else if (ev.type === "response.output_text.done") final = ev.text ?? "";
          else if (ev.type === "error" || ev.type === "response.failed") throw new Error(ev.error?.message ?? ev.response?.error?.message ?? "AI suggestion failed.");
        } catch (e) { if (e instanceof Error && !(e instanceof SyntaxError)) throw e; }
      }
    }
    const out = final || text;
    if (!out) throw new Error("The AI could not analyse this photo.");
    const a = JSON.parse(out) as PhotoAdvice;
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || lo));
    return { ...a, focus_x: clamp(a.focus_x, 0, 1), focus_y: clamp(a.focus_y, 0, 1), zoom: clamp(a.zoom, 1, 2.5) };
  });

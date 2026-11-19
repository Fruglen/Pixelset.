// Server side Google Gemini helper. Owner's rule (Nov 18, 2026): every AI
// feature in the app goes through this one helper, keyed on GEMINI_API_KEY
// from the environment. The key is never sent to the browser and Gemini is
// never called from client code; API routes call these functions instead.
// When the key is absent the features show an honest "AI is not connected"
// state, exactly like the other env gated integrations (Instagram, Resend).

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.0-flash";
}

export class GeminiNotConnectedError extends Error {
  constructor() {
    super("AI is not connected. Set GEMINI_API_KEY on the server to enable AI features.");
    this.name = "GeminiNotConnectedError";
  }
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function generate(parts: GeminiPart[], opts: { json?: boolean; temperature?: number; maxTokens?: number }): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiNotConnectedError();
  const model = geminiModel();
  const res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: opts.maxTokens ?? 1024,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

/** Plain text generation (writing assistant, copy help). */
export async function geminiText(prompt: string, opts: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
  return generate([{ text: prompt }], opts);
}

/** JSON generation: asks Gemini for a JSON document and parses it. */
export async function geminiJson<T>(prompt: string, opts: { temperature?: number; maxTokens?: number } = {}): Promise<T> {
  const raw = await generate([{ text: prompt }], { ...opts, json: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1)) as T;
    throw new Error("Gemini did not return valid JSON");
  }
}

export interface GeminiImage {
  mimeType: string; // e.g. image/jpeg
  dataBase64: string;
}

/** Vision generation over one or more images plus a text prompt. */
export async function geminiVision(
  prompt: string,
  images: GeminiImage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const parts: GeminiPart[] = [{ text: prompt }];
  for (const img of images) parts.push({ inline_data: { mime_type: img.mimeType, data: img.dataBase64 } });
  return generate(parts, opts);
}

/** Vision generation that returns parsed JSON. */
export async function geminiVisionJson<T>(
  prompt: string,
  images: GeminiImage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<T> {
  const parts: GeminiPart[] = [{ text: prompt }];
  for (const img of images) parts.push({ inline_data: { mime_type: img.mimeType, data: img.dataBase64 } });
  const raw = await generate(parts, { ...opts, json: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1)) as T;
    const aStart = raw.indexOf("[");
    const aEnd = raw.lastIndexOf("]");
    if (aStart >= 0 && aEnd > aStart) return JSON.parse(raw.slice(aStart, aEnd + 1)) as T;
    throw new Error("Gemini did not return valid JSON");
  }
}

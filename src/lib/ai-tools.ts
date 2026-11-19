// Open-source AI tools wiring (background removal, object removal,
// upscaling, face restore). These run on a self-hosted inference endpoint
// (for example a small server running rembg / LaMa / Real-ESRGAN /
// GFPGAN). There is NO hosted endpoint yet: when AI_TOOLS_ENDPOINT is
// unset the tools report a clear "not connected" state and never fake a
// result. When it is set, POST /api/editor/ai-tools forwards the photo to
// it and saves the returned image as a new copy in the photo's own set.
//
// Endpoint contract (JSON in, JSON out):
//   POST {endpoint}
//   { "tool": "background-remove" | "object-remove" | "upscale" | "face-restore",
//     "image": "<base64 jpeg/png>",
//     "mask": "<base64 png>" | null }
//   -> 200 { "image": "<base64 jpeg/png>" }

export const AI_TOOLS = [
  { id: "background-remove", label: "Remove background" },
  { id: "object-remove", label: "Remove object" },
  { id: "upscale", label: "Upscale" },
  { id: "face-restore", label: "Restore face" },
] as const;

export type AiToolId = (typeof AI_TOOLS)[number]["id"];

export function aiToolsEndpoint(): string {
  return (process.env.AI_TOOLS_ENDPOINT || "").trim();
}

export function aiToolsConfigured(): boolean {
  return aiToolsEndpoint().length > 0;
}

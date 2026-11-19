import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { geminiConfigured, geminiText, GeminiNotConnectedError } from "@/lib/gemini";
import { localPolish } from "@/lib/text-polish";

export const runtime = "nodejs";

// Night build (Website): the AI writing assistant for page copy. Runs on
// Google Gemini through src/lib/gemini.ts (GEMINI_API_KEY). Until the key
// is connected only the mechanical polish runs, locally, and the other
// actions answer with the honest not connected state.

const ACTIONS: Record<string, { label: string; instruction: string }> = {
  rewrite: { label: "Rewrite", instruction: "Rewrite this website copy to be clearer and more compelling, keeping the same meaning and roughly the same length." },
  shorten: { label: "Shorten", instruction: "Shorten this website copy to about half its length, keeping the key message and any call to action." },
  expand: { label: "Expand", instruction: "Expand this website copy with one or two natural supporting sentences, keeping the same voice. Do not invent facts, names, prices or claims." },
  formal: { label: "More formal", instruction: "Rewrite this website copy in a more formal, professional tone, keeping the same meaning and length." },
  friendly: { label: "Friendlier", instruction: "Rewrite this website copy in a warmer, friendlier tone, keeping the same meaning and length." },
  polish: { label: "Fix and polish", instruction: "Fix spelling, grammar and punctuation in this website copy and polish the phrasing lightly. Keep the meaning, voice and length." },
};

export async function GET() {
  return NextResponse.json({ aiConnected: geminiConfigured(), actions: Object.entries(ACTIONS).map(([id, a]) => ({ id, label: a.label })) });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = ACTIONS[String(body.action ?? "")];
  const text = String(body.text ?? "").slice(0, 4000);
  if (!action) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (!text.trim()) return NextResponse.json({ error: "Write something first, then ask AI to help" }, { status: 400 });

  if (!geminiConfigured()) {
    if (body.action === "polish") {
      return NextResponse.json({ text: localPolish(text), aiConnected: false, note: "Polished locally. AI is not connected yet, so this was a mechanical clean up only." });
    }
    return NextResponse.json(
      { error: "AI is not connected yet. Add a Gemini API key on the server to switch the writing assistant on.", aiConnected: false },
      { status: 503 }
    );
  }
  try {
    const out = await geminiText(
      `${action.instruction}\n\nReturn only the finished copy, no quotes, no explanation.\n\nCopy:\n${text}`,
      { maxTokens: 1200, temperature: 0.6 }
    );
    return NextResponse.json({ text: out.trim(), aiConnected: true });
  } catch (e) {
    if (e instanceof GeminiNotConnectedError) {
      return NextResponse.json({ error: "AI is not connected yet.", aiConnected: false }, { status: 503 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI request failed" }, { status: 502 });
  }
}

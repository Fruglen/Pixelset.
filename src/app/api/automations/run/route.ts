import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { runAutomations } from "@/lib/automations";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("send_documents");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const summaries = await runAutomations(user.id);
  return NextResponse.json({ summaries });
}

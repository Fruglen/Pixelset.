import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import PresetsClient from "./presets-client";

export const dynamic = "force-dynamic";

export default async function PresetsPage() {
  const user = (await getCurrentUser())!;
  const presets = await db.preset.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });
  return (
    <PresetsClient
      presets={presets.map((p) => ({ id: p.id, name: p.name, settings: p.settings }))}
    />
  );
}

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { activeRole, PERMISSION_LABELS, roleHas, ROLES } from "@/lib/team";
import TeamClient from "./team-client";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const user = (await getCurrentUser())!;
  const members = await db.teamMember.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });

  return (
    <TeamClient
      owner={{ name: user.name, email: user.email }}
      members={members.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role }))}
      workingAs={activeRole()}
      matrix={ROLES.map((role) => ({
        role,
        permissions: PERMISSION_LABELS.map((p) => ({ label: p.label, allowed: roleHas(role, p.id) })),
      }))}
    />
  );
}

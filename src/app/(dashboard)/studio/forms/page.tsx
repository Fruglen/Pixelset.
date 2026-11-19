import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormsClient } from "./forms-client";

export const dynamic = "force-dynamic";

export default async function LeadFormsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const forms = await db.leadForm.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return (
    <FormsClient
      forms={forms.map((f) => ({ id: f.id, name: f.name, token: f.token, active: f.active, submissions: f.submissions }))}
    />
  );
}

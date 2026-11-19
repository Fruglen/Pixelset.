import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProjectsBoard } from "./projects-board";
import { syncWebsiteLeads } from "@/lib/studio-flow";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Night build: website form submissions open Inquiry cards here too.
  await syncWebsiteLeads(user.id).catch(() => 0);

  const [projects, contacts] = await Promise.all([
    db.project.findMany({
      where: { userId: user.id },
      include: { contact: true, booking: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    db.contact.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
  ]);

  return (
    <ProjectsBoard
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        stage: p.stage,
        notes: p.notes,
        contactName: p.contact?.name ?? "",
        bookingStart: p.booking?.startsAt.toISOString() ?? "",
      }))}
      contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}

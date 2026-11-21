import { redirect } from "next/navigation";
import { getCurrentSession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSupportOwner } from "@/lib/support";
import { SupportBubble } from "@/components/support-bubble";
import { Sidebar, TopBar } from "./nav";
import { PageFade } from "./page-fade";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // the person actually signed in (a team member's own login, or the owner)
  const session = await getCurrentSession();
  const login = session ? await db.user.findUnique({ where: { id: session.userId }, select: { email: true } }) : null;
  const loginEmail = login?.email || user.email;

  return (
    <div className="dash min-h-screen bg-paper">
      <Sidebar supportInbox={isSupportOwner(loginEmail)} />
      <div className="md:pl-60">
        <TopBar name={user.name} businessName={user.businessName} />
        <main className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto">
          <PageFade>{children}</PageFade>
        </main>
      </div>
      <SupportBubble email={loginEmail} />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar, TopBar } from "./nav";
import { PageFade } from "./page-fade";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="dash min-h-screen bg-paper">
      <Sidebar />
      <div className="md:pl-60">
        <TopBar name={user.name} businessName={user.businessName} />
        <main className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto">
          <PageFade>{children}</PageFade>
        </main>
      </div>
    </div>
  );
}

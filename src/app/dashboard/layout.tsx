import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ToastHost } from "@/components/ui/Toast";
import ProfileGuard from "@/components/dashboard/ProfileGuard";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <ProfileGuard>
      <div className="flex min-h-dvh flex-col md:flex-row">
        <Sidebar userEmail={user.email} />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">
            {children}
          </main>
        </div>
        <ToastHost />
      </div>
    </ProfileGuard>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import WaStatusChip from "@/components/dashboard/WaStatusChip";

export const navItems: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/dashboard/create", label: "Create", icon: "plus" },
  { href: "/dashboard/history", label: "History", icon: "history" },
  { href: "/dashboard/connect", label: "Connect", icon: "phone" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast("Signed out.", "info");
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-stone-200/80 bg-white md:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
            <Icon name="whatsapp" className="h-5 w-5 text-white" />
          </span>
          <span>
            <span className="block text-sm font-bold leading-tight text-brand-deep">WA Sender</span>
            <span className="block text-[11px] text-stone-400">Power City Oke Ira</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent text-white shadow-sm"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                <Icon name={item.icon} className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-stone-100 p-4">
          <WaStatusChip />
          <p className="mt-3 truncate text-xs font-medium text-stone-700">{userEmail}</p>
          <button
            onClick={logout}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-red-600"
          >
            <Icon name="logout" className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-colors ${
                  active ? "text-accent" : "text-stone-400"
                }`}
              >
                <Icon name={item.icon} className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

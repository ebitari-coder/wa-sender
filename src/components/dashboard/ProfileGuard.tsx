"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/dashboard/settings") {
      setChecked(true);
      return;
    }

    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user && (!data.user.full_name || !data.user.phone)) {
          router.replace("/dashboard/settings");
        } else {
          setChecked(true);
        }
      })
      .catch(() => setChecked(true));
  }, [pathname, router]);

  if (!checked) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-accent" />
      </div>
    );
  }

  return <>{children}</>;
}

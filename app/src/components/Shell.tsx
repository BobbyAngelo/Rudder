"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Check if onboarding is needed
  const isOnboarding = pathname === "/onboarding";
  const isLogin = pathname === "/login";
  const skipCheck = isOnboarding || isLogin;

  useEffect(() => {
    async function loadThemeAndCheckOnboarding() {
      try {
        const res = await fetch("/api/preferences");
        if (res.ok) {
          const data = await res.json();
          // Apply theme class globally
          if (data.theme === "light") {
            document.documentElement.classList.add("light");
          } else {
            document.documentElement.classList.remove("light");
          }

          if (!skipCheck && !data.onboarding_completed) {
            router.replace("/onboarding");
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load theme and check onboarding preference:", err);
      }
      setReady(true);
    }

    loadThemeAndCheckOnboarding();
  }, [skipCheck, router]);

  // Onboarding gets a clean layout (no sidebar)
  if (isOnboarding) {
    return (
      <div className="flex h-screen overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 bg-background">
          {children}
        </main>
      </div>
    );
  }

  // Show nothing until we've confirmed onboarding status
  if (!ready) {
    return (
      <div className="flex h-screen overflow-hidden items-center justify-center bg-background">
        <div className="animate-pulse text-sm" style={{ color: "var(--color-text-dim)" }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}

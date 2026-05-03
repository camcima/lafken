import { Outlet } from "@tanstack/react-router";

import { Toaster } from "@/components/feedback/Success/Sonner";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * AppShell is the main authenticated layout. It renders a fixed sidebar on
 * the left (with nav groups and the user block) and a content area on the
 * right composed of a TopBar + a <main> region rendered by TanStack Router's
 * <Outlet />.
 */
export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-y-auto bg-neutral-50 p-6">
          <Outlet />
        </main>
      </div>

      <Toaster />
    </div>
  );
}

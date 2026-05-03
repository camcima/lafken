import { Outlet } from "@tanstack/react-router";

import { Toaster } from "@/components/feedback/Success/Sonner";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell(): React.ReactElement {
  return (
    <div className="bg-background grid min-h-screen grid-cols-[232px_1fr]">
      <Sidebar />
      <main className="flex min-w-0 flex-col">
        <TopBar />
        <div className="mx-auto w-full max-w-[1480px] min-w-0 flex-1 px-4 pt-6 pb-12 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

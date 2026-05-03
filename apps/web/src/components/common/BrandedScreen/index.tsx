import type { PropsWithChildren } from "react";

import bgLogin from "@/assets/bg-login.svg";

export function BrandedScreen({ children }: Readonly<PropsWithChildren>) {
  return (
    <main
      className="flex h-screen w-full items-center justify-center bg-contain bg-bottom bg-no-repeat"
      style={{ backgroundImage: `url(${bgLogin})` }}
    >
      <div className="mx-4 flex w-full max-w-sm flex-col items-center justify-center rounded-md bg-neutral-50 p-10 text-center md:border">
        {children}
      </div>
    </main>
  );
}

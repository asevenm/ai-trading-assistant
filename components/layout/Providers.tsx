"use client";

import { SessionProvider } from "next-auth/react";
import { AntdProvider } from "@/components/layout/AntdProvider";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AntdProvider>{children}</AntdProvider>
    </SessionProvider>
  );
}

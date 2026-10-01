import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader signedIn={Boolean(user)} />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

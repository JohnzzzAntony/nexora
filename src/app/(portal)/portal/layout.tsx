import Link from "next/link";
import { requireOrganizationAccess } from "@/lib/tenancy/context";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Logo } from "@/components/marketing/logo";
import { PortalSignOut } from "@/components/work/portal-signout";
export default async function Layout({ children }: { children: React.ReactNode }) { const ctx = await requireOrganizationAccess({ allowCustomer: true }); const settings = await db.organizationSettings.findUnique({ where: { organizationId: ctx.organization.id }, select: { portalEnabled: true } }); if (!settings?.portalEnabled) notFound(); return <div className="min-h-dvh bg-background"><header className="border-b bg-card"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-5"><Logo href="/portal" /><nav className="flex items-center gap-5 text-sm"><Link href="/portal/tickets">My tickets</Link><Link href="/portal/knowledge">Knowledge base</Link><PortalSignOut /></nav></div></header><main className="mx-auto max-w-6xl px-5 py-8">{children}</main></div>; }

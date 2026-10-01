import Link from "next/link";
import { requirePagePermission } from "@/lib/tenancy/context";
import { SETTINGS_NAV } from "@/config/navigation";
import { PageHeader } from "@/components/ui/page-header";
export default async function Page() { const ctx = await requirePagePermission("settings.view", "settings.manage"); return <><PageHeader title="Settings" description="Manage your workspace, service policies and integrations." /><div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{SETTINGS_NAV.map(group => { const items = group.items.filter(i => !i.anyOf?.length || i.anyOf.some(p => ctx.can(p))); return items.length ? <section className="rounded-xl border bg-card p-5" key={group.title}><h2 className="mb-3 font-semibold">{group.title}</h2><div className="space-y-3">{items.map(i => <Link href={i.href} className="block text-sm text-primary hover:underline" key={i.href}>{i.title} →</Link>)}</div></section> : null; })}</div></>; }

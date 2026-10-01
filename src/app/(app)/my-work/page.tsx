import { requireOrganizationAccess } from "@/lib/tenancy/context";
import { TicketList } from "@/components/work/ticket-pages";
import Link from "next/link";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) { return <><div className="mb-4 text-sm"><Link href="/tasks" className="text-primary hover:underline">View assigned tasks →</Link></div><TicketList ctx={await requireOrganizationAccess()} query={await searchParams} mine /></>; }

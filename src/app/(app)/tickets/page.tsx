import { requireOrganizationAccess } from "@/lib/tenancy/context";
import { TicketList } from "@/components/work/ticket-pages";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) { return <TicketList ctx={await requireOrganizationAccess()} query={await searchParams} />; }

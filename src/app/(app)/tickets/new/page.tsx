import { requirePagePermission } from "@/lib/tenancy/context";
import { getLookups, searchMembers } from "@/server/lookups/service";
import { isAgent } from "@/server/tickets/access";
import { PageHeader } from "@/components/ui/page-header";
import { NewTicketForm } from "@/components/work/ticket-forms";
export default async function Page() { const ctx = await requirePagePermission("tickets.create"); const [lookups, members] = await Promise.all([getLookups(ctx), isAgent(ctx) ? searchMembers(ctx, { agents: true, take: 50 }) : []]); return <><PageHeader title="New ticket" description="Tell us what you need. Your team will track it from here." /><NewTicketForm lookups={lookups} members={members} agent={isAgent(ctx)} /></>; }

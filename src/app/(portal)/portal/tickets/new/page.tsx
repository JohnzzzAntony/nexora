import { requireOrganizationAccess } from "@/lib/tenancy/context";
import { getLookups } from "@/server/lookups/service";
import { PageHeader } from "@/components/ui/page-header";
import { NewTicketForm } from "@/components/work/ticket-forms";
export default async function Page() { const ctx = await requireOrganizationAccess({ allowCustomer: true }); return <><PageHeader title="New request" /><NewTicketForm lookups={await getLookups(ctx)} members={[]} agent={false} portal /></>; }

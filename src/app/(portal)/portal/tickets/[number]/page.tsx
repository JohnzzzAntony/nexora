import { requireOrganizationAccess } from "@/lib/tenancy/context";
import { TicketDetail } from "@/components/work/ticket-pages";
export default async function Page({ params }: { params: Promise<{ number: string }> }) { return <TicketDetail ctx={await requireOrganizationAccess({ allowCustomer: true })} refNumber={(await params).number} portal />; }

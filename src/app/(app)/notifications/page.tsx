import type { Metadata } from "next";
import { requireOrganizationAccess } from "@/lib/tenancy/context";
import { PageHeader } from "@/components/ui/page-header";
import { NotificationCenter } from "@/components/shell/notification-center";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireOrganizationAccess();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" description="Updates about tickets, tasks and approvals that involve you." />
      <NotificationCenter />
    </div>
  );
}

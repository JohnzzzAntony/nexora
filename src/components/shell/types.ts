import type { Permission } from "@/lib/permissions/catalog";

/** Serializable data passed from the (app) layout (Server Component) to the client shell. */
export type ShellData = {
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  organization: { id: string; name: string; logoUrl: string | null; slug: string };
  role: string;
  permissions: Permission[];
  organizations: { id: string; name: string }[];
  sidebarCollapsed: boolean;
};

/** Cookie remembering the desktop sidebar state ("collapsed" | "expanded"). */
export const SIDEBAR_COOKIE = "duoonex_sidebar";

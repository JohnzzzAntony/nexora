import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/tenancy/context";
import { RESOURCES } from "@/config/resources";
import { listResources, resourceLookups } from "@/server/work/resources";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ResourceForm } from "@/components/work/resource-form";
import { ResourceExtras } from "@/components/work/resource-extras";
import { sanitizeHtml } from "@/lib/sanitize";
export async function ResourcePage({
  module,
  recordId,
  edit,
  query = "",
  create = false,
}: {
  module: string;
  recordId?: string;
  edit?: boolean;
  query?: string;
  create?: boolean;
}) {
  const config = RESOURCES[module];
  if (!config) notFound();
  const ctx = await requirePagePermission(config.view);
  const rows = await listResources(
    ctx,
    module,
    query,
    recordId === "new" ? undefined : recordId,
  );
  const record = recordId && recordId !== "new" ? rows[0] : undefined;
  if (recordId && recordId !== "new" && !record) notFound();
  const canManage = ctx.can(
    module === "tasks" && record ? "tasks.edit" : config.manage,
  );
  if ((edit || create || recordId === "new") && canManage)
    return (
      <>
        <PageHeader
          title={`${record ? "Edit" : "New"} ${config.singular.toLowerCase()}`}
          breadcrumbs={[
            { label: config.title, href: `/${module}` },
            { label: record ? String(record.title || record.name) : "New" },
          ]}
        />
        <ResourceForm
          module={module}
          record={record}
          lookups={await resourceLookups(ctx)}
        />
      </>
    );
  const needsLookups =
    config.fields.some((field) => field.lookup) ||
    (module === "teams" && ctx.can("teams.manage"));
  const lookups =
    record && needsLookups ? await resourceLookups(ctx) : undefined;
  if (record)
    return (
      <>
        <PageHeader
          title={String(record.title || record.name)}
          description={config.description}
          breadcrumbs={[
            { label: config.title, href: `/${module}` },
            { label: "Details" },
          ]}
          actions={
            canManage && (
              <Button asChild>
                <Link href={`/${module}/${record.id}?edit=1`}>
                  Edit {config.singular.toLowerCase()}
                </Link>
              </Button>
            )
          }
        />
        <section className="max-w-4xl space-y-5 rounded-xl border bg-card p-6">
          {config.fields.map((f) => (
            <div key={f.key}>
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {f.label}
              </h2>
              {f.key === "contentHtml" ||
              (f.key === "description" && module === "tasks") ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(String(record[f.key] || "")),
                  }}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm">
                  {f.lookup
                    ? lookups?.[f.lookup].find((o) => o.id === record[f.key])
                        ?.name || "—"
                    : String(record[f.key] || "—").replaceAll("_", " ")}
                </p>
              )}
            </div>
          ))}
        </section>
        <ResourceExtras
          ctx={ctx}
          module={module}
          id={record.id}
          memberOptions={lookups?.members ?? []}
        />
      </>
    );
  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          canManage && (
            <Button asChild>
              <Link href={`/${module}/new`}>
                New {config.singular.toLowerCase()}
              </Link>
            </Button>
          )
        }
      />
      <form className="mb-5 flex gap-3">
        <input
          name="q"
          defaultValue={query}
          placeholder={`Search ${config.title.toLowerCase()}…`}
          aria-label={`Search ${config.title}`}
          className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <Button variant="outline">Search</Button>
      </form>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <Link
            href={`/${module}/${row.id}`}
            key={row.id}
            className="group rounded-xl border bg-card p-5 shadow-xs transition hover:border-primary/40 hover:shadow-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <h2 className="font-semibold group-hover:text-primary">
                {String(row.title || row.name)}
              </h2>
              {!!row.status && (
                <span className="rounded bg-muted px-2 py-1 text-[10px]">
                  {String(row.status).replaceAll("_", " ")}
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {String(
                row.excerpt ||
                  row.description ||
                  row.company ||
                  row.assetTag ||
                  row.email ||
                  "Open details",
              ).replace(/<[^>]*>/g, "")}
            </p>
            {!!row.priority && (
              <p className="mt-3 text-xs text-muted-foreground">
                Priority: {String(row.priority)}
              </p>
            )}
          </Link>
        ))}
      </div>
      {!rows.length && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <h2 className="font-semibold">
            No {config.title.toLowerCase()} found
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {canManage
              ? `Create your first ${config.singular.toLowerCase()} to get started.`
              : "Assigned work will appear here."}
          </p>
        </div>
      )}
      {rows.length === 100 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Showing the latest 100 records. Search to narrow results.
        </p>
      )}
    </>
  );
}

import { ResourcePage } from "@/components/work/resource-page";
export default async function Page({ params, searchParams }: { params: Promise<{ module: string; ref: string }>; searchParams: Promise<Record<string, string | undefined>> }) { const { module, ref: recordId } = await params; return <ResourcePage module={module} recordId={recordId} edit={(await searchParams).edit === "1"} />; }

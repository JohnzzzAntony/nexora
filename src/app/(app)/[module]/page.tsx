import { ResourcePage } from "@/components/work/resource-page";
export default async function Page({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<Record<string, string | undefined>> }) { const q = await searchParams; return <ResourcePage module={(await params).module} query={q.q} create={q.new === "1"} />; }

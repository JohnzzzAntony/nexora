import { NextResponse, type NextRequest } from "next/server";
import { getApiContext, handle } from "@/lib/api/handler";
import { getDownloadUrl } from "@/server/files/service";

// Authorized download: checks access to the owning entity, then redirects to a short-lived signed URL.
export const GET = handle<{ id: string }>(async (req: NextRequest, { params }) => {
  const ctx = await getApiContext(req);
  const url = await getDownloadUrl(ctx, (await params).id, req.nextUrl.searchParams.get("inline") === "1");
  return NextResponse.redirect(new URL(url, req.nextUrl.origin), { status: 302, headers: { "Cache-Control": "no-store" } });
});

import { NextResponse, type NextRequest } from "next/server";
import { features } from "@/lib/env";
import { readLocalObject, verifyLocal, writeLocalObject } from "@/lib/storage";

// Development-only stand-in for presigned object-storage URLs.
export const runtime = "nodejs";

function unavailable() {
  return features.objectStorage || process.env.NODE_ENV === "production";
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (unavailable()) return new NextResponse("Not found", { status: 404 });
  const grant = verifyLocal((await params).token);
  if (!grant || grant.op !== "put") return new NextResponse("Invalid or expired upload URL", { status: 403 });
  const body = Buffer.from(await req.arrayBuffer());
  if (grant.size !== undefined && body.length !== grant.size) return new NextResponse("Size mismatch", { status: 400 });
  await writeLocalObject(grant.k, body);
  return new NextResponse(null, { status: 200 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (unavailable()) return new NextResponse("Not found", { status: 404 });
  const grant = verifyLocal((await params).token);
  if (!grant || grant.op !== "get") return new NextResponse("Invalid or expired link", { status: 403 });
  const data = await readLocalObject(grant.k).catch(() => null);
  if (!data) return new NextResponse("Not found", { status: 404 });
  const inline = grant.mime.startsWith("image/") || grant.mime === "application/pdf";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": grant.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(grant.name ?? "file")}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, max-age=300",
    },
  });
}

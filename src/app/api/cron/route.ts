import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { runJobs } from "@/lib/jobs/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Invoked every 5 minutes by .github/workflows/cron.yml (or Vercel Cron) with the CRON_SECRET.
async function run(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/, "") ?? "";
  if (!env.cronSecret || !safeEqual(token, env.cronSecret)) return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } }, { status: 401 });
  return NextResponse.json({ success: true, data: await runJobs() });
}

export const GET = run;
export const POST = run;

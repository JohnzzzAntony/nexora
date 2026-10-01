import { NextResponse, type NextRequest } from "next/server";

// Request gate: CSRF origin check for cookie-authenticated API mutations and a cheap
// signed-in redirect for app pages. Real authorization happens server-side per request.
const SESSION_COOKIES = ["__Secure-next-auth.session-token", "next-auth.session-token"];
const APP_PREFIXES = ["/dashboard", "/tickets", "/my-work", "/tasks", "/projects", "/teams", "/customers", "/assets", "/knowledge", "/approvals", "/reports", "/notifications", "/settings", "/help", "/profile", "/users", "/onboarding", "/portal"];
const CSRF_EXEMPT = ["/api/auth/", "/api/inbound/", "/api/cron", "/api/billing/webhook", "/api/health"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = SESSION_COOKIES.some(name => request.cookies.has(name));

  if (pathname.startsWith("/api/")) {
    const method = request.method.toUpperCase();
    const bearer = request.headers.get("authorization")?.startsWith("Bearer ");
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && !bearer && !CSRF_EXEMPT.some(p => pathname.startsWith(p))) {
      const origin = request.headers.get("origin");
      const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
      let originHost: string | null = null;
      try { originHost = origin ? new URL(origin).host : null; } catch { originHost = "invalid"; }
      if (!originHost || originHost !== host) {
        return NextResponse.json({ success: false, error: { code: "INVALID_ORIGIN", message: "Cross-site request blocked" } }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  const isPortalPublic = pathname === "/portal/login";
  if (!hasSession && !isPortalPublic && APP_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg).*)"],
};

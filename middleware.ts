import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/lib/auth-secret";
import { contentSecurityPolicy, createCspNonce } from "@/lib/csp";

/** HTML CSP uses a trusted request nonce; protected page roles remain a coarse prefilter. */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const nonce = createCspNonce(), policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const admin = pathname === "/admin" || pathname.startsWith("/admin/");
  const panel = pathname === "/panel" || pathname.startsWith("/panel/");
  if (admin || panel) {
    const token = await getToken({ req, secret: getAuthSecret(), secureCookie: req.nextUrl.protocol === "https:" });
    const role = typeof token?.role === "string" ? token.role : null;
    const allowed = admin ? role === "superadmin" : role === "owner" || role === "staff";
    if (!allowed) {
      const url = req.nextUrl.clone(); url.pathname = "/giris"; url.search = ""; url.searchParams.set("next", pathname + search);
      const response = NextResponse.redirect(url); response.headers.set("Content-Security-Policy", policy); return response;
    }
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}
export const config = { matcher: ["/((?!api/|api$|_next/static|_next/image|favicon.ico).*)"] };

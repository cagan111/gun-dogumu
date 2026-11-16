import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/lib/auth-secret";

/** /panel/** → owner|staff, /admin/** → superadmin; aksi hâlde /giris'e yönlendirir. */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = await getToken({ req, secret: getAuthSecret() });
  const role = typeof token?.role === "string" ? token.role : null;
  const allowed = pathname.startsWith("/admin")
    ? role === "superadmin"
    : pathname.startsWith("/panel")
      ? role === "owner" || role === "staff"
      : true;
  if (allowed) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/giris";
  url.search = "";
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/panel/:path*", "/admin/:path*"] };

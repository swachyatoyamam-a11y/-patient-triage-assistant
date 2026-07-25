import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ROLE_ROUTE_PREFIXES, PUBLIC_ROUTES, type AppRole } from "@/config/roles";

/**
 * INTERIM auth, until Clerk has real keys (see api-client.ts for the
 * matching cookie-write side). Verifies the same JWT the backend issues
 * from `/api/auth/login`, using the same JWT_SECRET — set this in
 * frontend/.env.local as a server-only var (no NEXT_PUBLIC_ prefix) so it
 * never reaches the browser bundle.
 *
 * `jose` (not `jsonwebtoken`) because middleware runs on the Edge runtime,
 * which `jsonwebtoken` doesn't support.
 */
const JWT_SECRET = process.env.JWT_SECRET;

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicRoute(pathname)) return NextResponse.next();

  if (!JWT_SECRET) {
    // Fail open only in local dev with a loud warning — never in production.
    if (process.env.NODE_ENV !== "production") {
      console.warn("JWT_SECRET not set in frontend env — skipping route protection in dev.");
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login/patient", req.url));
  }

  const token = req.cookies.get("triage_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login/patient", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    const role = payload.role as AppRole | undefined;
    const allowedPrefixes = role ? ROLE_ROUTE_PREFIXES[role] : [];
    const isAllowed = allowedPrefixes.some((prefix) => pathname.startsWith(prefix));

    if (!isAllowed) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login/patient", req.url));
    res.cookies.delete("triage_token");
    return res;
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};

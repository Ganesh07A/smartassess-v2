import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

  // 1. If user is logged in and tries to access /login or /signup, redirect to their respective dashboard
  if (token && (pathname === "/login" || pathname === "/signup")) {
    const dashboard = token.role === "TEACHER" ? "/teacher" : "/student";
    return NextResponse.redirect(new URL(dashboard, request.url));
  }

  // 2. Protect /teacher routes
  if (pathname.startsWith("/teacher")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (token.role !== "TEACHER") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // 3. Protect /student routes
  if (pathname.startsWith("/student")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (token.role !== "STUDENT") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/signup", "/teacher/:path*", "/student/:path*"],
};

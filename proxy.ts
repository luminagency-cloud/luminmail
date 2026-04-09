import { NextResponse, type NextRequest } from "next/server";
const SESSION_COOKIE_NAME = "luminmail_session";

export async function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  const protectedPath =
    request.nextUrl.pathname.startsWith("/compose") ||
    request.nextUrl.pathname.startsWith("/inbox") ||
    request.nextUrl.pathname.startsWith("/accounts") ||
    request.nextUrl.pathname.startsWith("/api/accounts") ||
    request.nextUrl.pathname.startsWith("/api/messages");

  if (!hasSession && protectedPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && request.nextUrl.pathname === "/login") {
    const inboxUrl = request.nextUrl.clone();
    inboxUrl.pathname = "/inbox";
    inboxUrl.search = "";
    return NextResponse.redirect(inboxUrl);
  }

  if (hasSession && request.nextUrl.pathname === "/") {
    const inboxUrl = request.nextUrl.clone();
    inboxUrl.pathname = "/inbox";
    inboxUrl.search = "";
    return NextResponse.redirect(inboxUrl);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/", "/login", "/compose/:path*", "/inbox/:path*", "/accounts/:path*", "/api/accounts/:path*", "/api/messages/:path*"]
};

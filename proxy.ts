import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const protectedPath =
    request.nextUrl.pathname.startsWith("/inbox") ||
    request.nextUrl.pathname.startsWith("/accounts") ||
    request.nextUrl.pathname.startsWith("/api/accounts") ||
    request.nextUrl.pathname.startsWith("/api/messages");

  if (!user && protectedPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const inboxUrl = request.nextUrl.clone();
    inboxUrl.pathname = "/inbox";
    inboxUrl.search = "";
    return NextResponse.redirect(inboxUrl);
  }

  if (user && request.nextUrl.pathname === "/") {
    const inboxUrl = request.nextUrl.clone();
    inboxUrl.pathname = "/inbox";
    inboxUrl.search = "";
    return NextResponse.redirect(inboxUrl);
  }

  return response;
}

export const config = {
  matcher: ["/", "/login", "/auth/:path*", "/inbox/:path*", "/accounts/:path*", "/api/accounts/:path*", "/api/messages/:path*"]
};

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isRouteAllowed, type UserRole } from "@/lib/rbac";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isApi = pathname.startsWith("/api/");

  if (!url || !anonKey) {
    if (isPublic(pathname)) return NextResponse.next();
    if (isApi) return NextResponse.json({ success: false, error: "Authentication is not configured" }, { status: 503 });
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Redirects must carry any cookies Supabase changed (token refresh, signOut), or an
  // unlinked account would bounce between /login and / forever.
  const redirectTo = (target: string | URL) => {
    const res = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
    return res;
  };

  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (isPublic(pathname)) {
    if (user && pathname === "/login") return redirectTo("/");
    return response;
  }

  if (!user) {
    if (isApi) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return redirectTo(loginUrl);
  }

  // API routes do their own role checks; pages are gated by the role stored in the database.
  if (isApi) return response;

  const { data: role } = await supabase.rpc("current_app_role");
  if (!role || !isRouteAllowed(role as UserRole, pathname)) {
    if (!role) {
      await supabase.auth.signOut();
      return redirectTo("/login?error=no_profile");
    }
    return redirectTo("/?denied=" + encodeURIComponent(pathname));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

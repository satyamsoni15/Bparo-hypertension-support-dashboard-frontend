import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Optimistic redirect layer only. Every page and server action re-checks the
// session and role itself.
//   - Everything except /login needs a live support session.
//   - /admin is for support_admin only.
//   - An expired API token (session.error) counts as signed out.
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const session = req.auth;
  const signedIn = !!session && !session.error;

  const redirectTo = (target: string, callbackUrl?: string) => {
    const url = req.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    if (callbackUrl) url.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(url);
  };

  if (pathname === "/login") {
    return signedIn ? redirectTo("/") : NextResponse.next();
  }

  if (!signedIn) return redirectTo("/login", `${pathname}${search}`);

  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && session.user.role !== "support_admin") {
    return redirectTo("/");
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

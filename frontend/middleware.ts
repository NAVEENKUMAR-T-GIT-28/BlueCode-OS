import { NextResponse, type NextRequest } from "next/server";

// Cheap gate: no session cookie means no app pages. The API still verifies the token on every call.
export function middleware(req: NextRequest) {
  if (!req.cookies.get("access_token")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/icp/:path*", "/settings/:path*", "/prospects/:path*",
    "/leads/:path*", "/decision-makers/:path*", "/outreach/:path*", "/followups/:path*",
    "/analytics/:path*"],
};

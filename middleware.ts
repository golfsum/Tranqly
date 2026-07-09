import { NextRequest, NextResponse } from "next/server";

function unauthorized() {
  return new NextResponse("Admin login required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Tranqly Admin", charset="UTF-8"',
    },
  });
}

export function middleware(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.next();
  }

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) {
    return unauthorized();
  }

  try {
    const encoded = authorization.slice("Basic ".length);
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(":");
    const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";

    if (password === adminPassword) {
      return NextResponse.next();
    }
  } catch {
    return unauthorized();
  }

  return unauthorized();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

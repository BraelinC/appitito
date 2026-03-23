import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { token } = await request.json() as { token?: string };

    if (!token) {
      return NextResponse.json({ success: false, error: "Missing token" }, { status: 400 });
    }

    const convexSiteUrl = getConvexSiteUrl();
    if (!convexSiteUrl) {
      return NextResponse.json({ success: false, error: "Missing Convex site URL" }, { status: 500 });
    }

    const response = await fetch(`${convexSiteUrl}/auth/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error("[DM Auth Consume] Error", error);
    return NextResponse.json({ success: false, error: "Failed to consume token" }, { status: 500 });
  }
}

function getConvexSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (explicit) {
    return explicit;
  }

  const cloudUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!cloudUrl) {
    return "";
  }

  return cloudUrl.replace(".convex.cloud", ".convex.site");
}

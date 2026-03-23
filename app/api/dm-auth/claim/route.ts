import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

type TokenInfoResponse = {
  valid: boolean;
  reason?: string;
  instagramId?: string;
  instagramUsername?: string;
  recipeId?: string;
  clerkUserId?: string;
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
    }

    const { token } = await request.json() as { token?: string };
    if (!token) {
      return NextResponse.json({ success: false, error: "Missing token" }, { status: 400 });
    }

    const convexSiteUrl = getConvexSiteUrl();
    if (!convexSiteUrl) {
      return NextResponse.json({ success: false, error: "Missing Convex site URL" }, { status: 500 });
    }

    const tokenInfoResponse = await fetch(`${convexSiteUrl}/auth/token-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const tokenInfo = await tokenInfoResponse.json() as TokenInfoResponse;

    if (!tokenInfoResponse.ok || !tokenInfo.valid || !tokenInfo.instagramId) {
      return NextResponse.json({ success: false, error: tokenInfo.reason ?? "Invalid token" }, { status: 400 });
    }

    if (tokenInfo.clerkUserId && tokenInfo.clerkUserId !== userId) {
      return NextResponse.json(
        { success: false, error: "This link has already been claimed by another account" },
        { status: 409 }
      );
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.primaryEmailAddress?.emailAddress;

    await fetch(`${convexSiteUrl}/auth/link-clerk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instagramId: tokenInfo.instagramId,
        clerkUserId: userId,
        email,
      }),
    });

    await fetch(`${convexSiteUrl}/auth/onboarding-claimed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramId: tokenInfo.instagramId }),
    });

    const consumeResponse = await fetch(`${convexSiteUrl}/auth/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const consumeResult = await consumeResponse.json() as { success?: boolean; reason?: string };

    if (!consumeResponse.ok || !consumeResult.success) {
      return NextResponse.json(
        { success: false, error: consumeResult.reason ?? "Failed to claim link" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, recipeId: tokenInfo.recipeId });
  } catch (error) {
    console.error("[DM Auth Claim] Error", error);
    return NextResponse.json({ success: false, error: "Failed to claim link" }, { status: 500 });
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

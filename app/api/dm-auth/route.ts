import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

type ValidateResponse = {
  valid: boolean;
  reason?: string;
  instagramId?: string;
  instagramUsername?: string;
  recipeId?: string;
  clerkUserId?: string;
  isNewUser?: boolean;
};

export async function POST(request: Request) {
  let token: string | undefined;
  let validatedInstagramId: string | undefined;

  try {
    const body = await request.json() as { token?: string };
    token = body.token;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ success: false, error: "Missing token" }, { status: 400 });
    }

    const convexSiteUrl = getConvexSiteUrl();
    if (!convexSiteUrl) {
      return NextResponse.json({ success: false, error: "Missing Convex site URL" }, { status: 500 });
    }

    const validateResponse = await fetch(`${convexSiteUrl}/auth/token-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const validation = await validateResponse.json() as ValidateResponse;
    if (!validateResponse.ok || !validation.valid || !validation.instagramId || !validation.instagramUsername) {
      return NextResponse.json({ success: false, error: validation.reason ?? "Invalid token" }, { status: 400 });
    }

    validatedInstagramId = validation.instagramId;

    const client = await clerkClient();
    let clerkUserId = validation.clerkUserId;
    let clerkEmail: string | undefined;

    if (clerkUserId) {
      try {
        const existingUser = await client.users.getUser(clerkUserId);
        clerkEmail = existingUser.primaryEmailAddress?.emailAddress;
      } catch {
        clerkUserId = undefined;
      }
    }

    if (!clerkUserId) {
      const externalId = `instagram:${validation.instagramId}`;
      const existingUsers = await client.users.getUserList({ externalId: [externalId], limit: 1 });
      const existingUser = existingUsers.data[0];

      if (existingUser) {
        clerkUserId = existingUser.id;
        clerkEmail = existingUser.primaryEmailAddress?.emailAddress;
      } else {
        clerkEmail = buildInstagramEmail(validation.instagramId);
        const createdUser = await client.users.createUser({
          externalId,
          firstName: validation.instagramUsername,
          emailAddress: [clerkEmail],
          skipPasswordRequirement: true,
          skipLegalChecks: true,
          privateMetadata: {
            instagramId: validation.instagramId,
            instagramUsername: validation.instagramUsername,
          },
        });
        clerkUserId = createdUser.id;
      }

      await fetch(`${convexSiteUrl}/auth/link-clerk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramId: validation.instagramId,
          clerkUserId,
          email: clerkEmail,
        }),
      });
    }

    await fetch(`${convexSiteUrl}/auth/onboarding-claimed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramId: validation.instagramId }),
    });

    const signInToken = await client.signInTokens.createSignInToken({
      userId: clerkUserId,
      expiresInSeconds: 60 * 10,
    });

    return NextResponse.json({
      success: true,
      signInToken: signInToken.token,
      recipeId: validation.recipeId,
      clerkUserId,
    });
  } catch (error) {
    console.error("[DM Auth] Error", error);

    if (token && validatedInstagramId) {
      try {
        const convexSiteUrl = getConvexSiteUrl();
        if (convexSiteUrl) {
          await fetch(`${convexSiteUrl}/auth/reset-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, instagramId: validatedInstagramId }),
          });
        }
      } catch (rollbackError) {
        console.error("[DM Auth] Failed to reset token after error", rollbackError);
      }
    }

    return NextResponse.json({ success: false, error: "Failed to create Clerk session" }, { status: 500 });
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

function buildInstagramEmail(instagramId: string) {
  return `ig_${instagramId}@dm.appitito.local`;
}

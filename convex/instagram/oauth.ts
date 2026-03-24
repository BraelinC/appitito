import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

const APP_ID = "1248590609951125";

// ── OAuth Callback (GET /instagram/callback) ──────────────────
export const callback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const redirectUri = `${url.origin}/instagram/callback`;

  if (error) {
    console.error("Instagram OAuth error:", error, url.searchParams.get("error_description"));
    return new Response(
      `<html><body><h2>❌ Authorization failed</h2><p>${error}</p></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    console.error("INSTAGRAM_APP_SECRET not set");
    return new Response("Server configuration error", { status: 500 });
  }

  try {
    // Step 1: Exchange code → short-lived token
    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: APP_ID,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = await tokenRes.json() as any;
    console.log("Short-lived token response:", JSON.stringify(tokenData).slice(0, 200));

    if (tokenData.error_type || !tokenData.access_token) {
      throw new Error(tokenData.error_message ?? "Failed to get short-lived token");
    }

    const shortLivedToken: string = tokenData.access_token;
    const userId: string = String(tokenData.user_id);

    // Step 2: Exchange short-lived → long-lived token (60 days)
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortLivedToken}`
    );
    const longLivedData = await longLivedRes.json() as any;
    console.log("Long-lived token response:", JSON.stringify(longLivedData).slice(0, 200));

    const longLivedToken: string = longLivedData.access_token ?? shortLivedToken;
    const expiresIn: number = longLivedData.expires_in ?? 0;

    // Step 3: Get account info
    const infoRes = await fetch(
      `https://graph.instagram.com/v21.0/me?fields=id,username,name&access_token=${longLivedToken}`
    );
    const info = await infoRes.json() as any;
    console.log("Account info:", JSON.stringify(info));

    // Step 4: Save token to DB
    await ctx.runMutation(internal.instagram.oauthStore.saveToken, {
      igUserId: userId,
      username: info.username ?? "unknown",
      accessToken: longLivedToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2>✅ Instagram Connected!</h2>
        <p><strong>@${info.username ?? userId}</strong> is now linked to Appitito.</p>
        <p>DMs with recipe reels will be processed automatically.</p>
        <p style="color:#888;font-size:14px">You can close this tab.</p>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (err: any) {
    console.error("OAuth callback error:", err);
    return new Response(
      `<html><body><h2>❌ Error</h2><p>${err.message}</p></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
});

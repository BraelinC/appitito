import { httpRouter, httpAction } from "convex/server";
import { verify, receive } from "./instagram/webhook";
import { callback } from "./instagram/oauth";
import { receive as manychatReceive } from "./manychat/webhook";

const http = httpRouter();

// Instagram DM webhook
http.route({ path: "/instagram/webhook", method: "GET", handler: verify });
http.route({ path: "/instagram/webhook", method: "POST", handler: receive });

// Instagram Business Login OAuth callback
http.route({ path: "/instagram/callback", method: "GET", handler: callback });

// ManyChat webhook for External Request
http.route({ path: "/manychat/webhook", method: "POST", handler: manychatReceive });

/**
 * Zernio Webhook Handler
 * Receives DM events from Instagram via Zernio
 */
http.route({
  path: "/zernio/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      console.log("[Zernio] Webhook received:", JSON.stringify(body, null, 2));

      const event = body.event || body.type;
      const data = body.data || body;

      if (event === "message.received" || event === "inbox.message.received") {
        const conversationId = data.conversationId || data.conversation?.id;
        const accountId = data.accountId || data.account?.id;
        const senderId = data.senderId || data.sender?.id;
        const senderName = data.senderName || data.sender?.name || "friend";
        const message = data.message || data.text || data.content || "";
        const attachments = data.attachments || [];

        console.log("[Zernio] New message from:", senderName, senderId);
        console.log("[Zernio] Attachments:", attachments.length);

        // Check for reel attachment
        const reel = attachments.find((a: any) => a.type === "ig_reel" || a.type === "video");
        
        if (reel) {
          const reelTitle = reel.payload?.title || reel.title || "";
          const reelId = reel.payload?.reel_video_id || reel.id || Date.now().toString();
          
          console.log("[Zernio] Reel detected:", reelTitle);

          // Send immediate acknowledgment
          await sendZernioReply(accountId, conversationId, 
            `Hey ${senderName.split(' ')[0]}! 👋 Got your reel! 🍳\n\nExtracting the recipe now...`
          );

          // Extract recipe and reply (async)
          extractRecipeAndReply(reelTitle, reelId, conversationId, accountId, senderName, senderId)
            .catch(err => console.error("[Zernio] Recipe extraction failed:", err));

          return new Response(JSON.stringify({ success: true, action: "recipe_extraction" }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        // No reel - send welcome
        await sendZernioReply(accountId, conversationId,
          `Hey ${senderName.split(' ')[0]}! 👋\n\nSend me any cooking reel and I'll extract the full recipe for you — ingredients, steps, everything! 🍳✨`
        );

        return new Response(JSON.stringify({ success: true, action: "welcome" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("[Zernio Webhook] Error:", error);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  }),
});

/**
 * Auth Token Validation Endpoint
 * POST /auth/validate - Validates and consumes an auth token
 */
http.route({
  path: "/auth/validate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { token } = await request.json();
      
      if (!token) {
        return new Response(
          JSON.stringify({ valid: false, error: "No token provided" }),
          { status: 400, headers: corsHeaders() }
        );
      }
      
      // Query and validate token
      const result = await ctx.runMutation(async ({ db }) => {
        const tokenData = await db.query("recipeAuthTokens")
          .withIndex("by_token", (q) => q.eq("token", token))
          .first();
        
        if (!tokenData) return { valid: false, error: "Token not found" };
        if (tokenData.used) return { valid: false, error: "Token already used" };
        if (tokenData.expiresAt < Date.now()) return { valid: false, error: "Token expired" };
        
        // Mark as used
        await db.patch(tokenData._id, { used: true, usedBy: tokenData.instagramId });
        
        return {
          valid: true,
          instagramId: tokenData.instagramId,
          instagramUsername: tokenData.instagramUsername,
          recipeId: tokenData.recipeId,
        };
      });
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: corsHeaders()
      });
      
    } catch (error) {
      console.error("[Auth Validate] Error:", error);
      return new Response(
        JSON.stringify({ valid: false, error: "Internal error" }),
        { status: 500, headers: corsHeaders() }
      );
    }
  }),
});

// CORS preflight for /auth/validate
http.route({
  path: "/auth/validate",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

/**
 * Store Auth Token Endpoint
 * POST /auth/store - Stores a new auth token
 */
http.route({
  path: "/auth/store",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { token, instagramId, instagramUsername, recipeId, firstName } = await request.json();
      
      await ctx.runMutation(async ({ db }) => {
        // Create/update Instagram user
        const existingUser = await db.query("instagramUsers")
          .withIndex("by_instagram_id", (q) => q.eq("instagramId", instagramId))
          .first();
        
        if (!existingUser) {
          await db.insert("instagramUsers", {
            instagramId,
            instagramUsername,
            firstName,
            createdAt: Date.now(),
            lastSeenAt: Date.now(),
          });
        } else {
          await db.patch(existingUser._id, { lastSeenAt: Date.now() });
        }
        
        // Store auth token
        await db.insert("recipeAuthTokens", {
          token,
          instagramId,
          instagramUsername,
          recipeId,
          used: false,
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        });
      });
      
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
      
    } catch (error) {
      console.error("[Auth Store] Error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Internal error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// ── Helper Functions ──────────────────────────────────────────

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function sendZernioReply(accountId: string, conversationId: string, message: string) {
  const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY;
  if (!ZERNIO_API_KEY) {
    console.error("[Zernio] No API key");
    return;
  }

  try {
    const response = await fetch(
      `https://zernio.com/api/v1/inbox/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ZERNIO_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ accountId, message })
      }
    );
    const result = await response.json();
    console.log("[Zernio] Reply sent:", result.success ? "✅" : "❌");
  } catch (err) {
    console.error("[Zernio] Failed to send:", err);
  }
}

async function sendZernioReplyWithButton(
  accountId: string, 
  conversationId: string, 
  message: string,
  buttonTitle: string,
  buttonUrl: string
) {
  const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY;
  if (!ZERNIO_API_KEY) {
    console.error("[Zernio] No API key");
    return;
  }

  try {
    const response = await fetch(
      `https://zernio.com/api/v1/inbox/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ZERNIO_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          accountId, 
          message,
          buttons: [{ type: "url", title: buttonTitle, url: buttonUrl }]
        })
      }
    );
    const result = await response.json();
    console.log("[Zernio] Button reply sent:", result.success ? "✅" : "❌");
  } catch (err) {
    console.error("[Zernio] Failed to send button:", err);
  }
}

async function extractRecipeAndReply(
  caption: string,
  reelId: string,
  conversationId: string,
  accountId: string,
  senderName: string,
  instagramId: string
) {
  console.log("[Recipe] Extracting from:", caption.slice(0, 100));
  
  const OPENROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY;
  
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-flash-1.5",
        messages: [{
          role: "user",
          content: `Extract recipe from this caption. Return JSON: {"dishName":"...","ingredients":["..."],"instructions":["..."]}\n\nCaption: ${caption}`
        }],
        max_tokens: 1000
      })
    });

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "{}";
    
    let recipe;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      recipe = JSON.parse(jsonStr);
    } catch {
      recipe = { dishName: caption.slice(0, 30), ingredients: [], instructions: [] };
    }

    console.log("[Recipe] Extracted:", recipe.dishName);

    // Generate auth token
    const authToken = crypto.randomUUID();
    const recipeUrl = `https://appitito.com/recipe/${reelId}?auth=${authToken}`;
    
    // Store token
    await storeAuthToken(authToken, instagramId, senderName, reelId);

    // Reply with button
    await sendZernioReplyWithButton(
      accountId, 
      conversationId, 
      `🍽️ ${recipe.dishName}\n\nYour recipe is ready!`,
      "View Recipe 🍳",
      recipeUrl
    );
    
  } catch (err) {
    console.error("[Recipe] Error:", err);
    
    const authToken = crypto.randomUUID();
    const recipeUrl = `https://appitito.com/recipe/${reelId}?auth=${authToken}`;
    await storeAuthToken(authToken, instagramId, senderName, reelId);
    
    await sendZernioReplyWithButton(
      accountId, 
      conversationId,
      "Your recipe is ready!",
      "View Recipe 🍳",
      recipeUrl
    );
  }
}

async function storeAuthToken(
  token: string,
  instagramId: string,
  senderName: string,
  recipeId: string
) {
  try {
    // Use the appitito Convex deployment
    await fetch("https://deafening-basilisk-361.convex.site/auth/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        instagramId,
        instagramUsername: senderName.toLowerCase().replace(/\s+/g, ''),
        recipeId,
        firstName: senderName.split(' ')[0],
      })
    });
    console.log("[Auth] Token stored for:", instagramId);
  } catch (err) {
    console.error("[Auth] Failed to store:", err);
  }
}

export default http;

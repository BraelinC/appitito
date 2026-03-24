import { httpRouter } from "convex/server";
import { type ActionCtx, httpAction, internalAction } from "./_generated/server";
import { api, components, internal } from "./_generated/api";
import { v } from "convex/values";
import { verify, receive } from "./instagram/webhook";
import { callback } from "./instagram/oauth";
import { getAppUrl } from "./lib/appUrl";
import { registerRoutes } from "@convex-dev/stripe";

const http = httpRouter();

registerRoutes(http, components.stripe, {
  webhookPath: "/stripe/webhook",
});

type JsonRecord = Record<string, unknown>;
type RunCtx = Pick<ActionCtx, "runQuery" | "runMutation">;

type RecipeDraft = {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  cuisine?: string;
  diet?: string;
  imageUrl?: string;
};

type MuxAsset = {
  assetId: string;
  playbackId: string;
  duration?: number;
};

type VideoExtractionResult = {
  recipe: RecipeDraft | null;
  bestThumbnailSecond?: number;
};

type ZernioAttachment = {
  type?: string;
  id?: string;
  url?: string;
  title?: string;
  payload?: JsonRecord;
};

type ReelContext = {
  reelId: string;
  shortcode: string;
  caption: string;
  videoUrl?: string;
  permalink?: string;
};

const recipeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    ingredients: { type: "array", items: { type: "string" } },
    instructions: { type: "array", items: { type: "string" } },
    prep_time: { type: "string" },
    cook_time: { type: "string" },
    servings: { type: "string" },
    cuisine: { type: "string" },
    diet: { type: "string" },
    imageUrl: { type: "string" },
  },
  required: ["title", "description", "ingredients", "instructions", "prep_time", "cook_time", "servings", "cuisine", "diet", "imageUrl"],
} as const;

// Instagram DM webhook
http.route({ path: "/instagram/webhook", method: "GET", handler: verify });
http.route({ path: "/instagram/webhook", method: "POST", handler: receive });

// Instagram Business Login OAuth callback
http.route({ path: "/instagram/callback", method: "GET", handler: callback });

/**
 * Zernio Webhook Handler
 * Receives DM events from Instagram via Zernio
 */
const zernioWebhookHandler = httpAction(async (ctx, request) => {
    try {
      const body = await request.json() as JsonRecord;
      console.log("[Zernio] Webhook received:", JSON.stringify(body, null, 2));

      const event = asString(body.event) ?? asString(body.type);
      const data = isRecord(body.data) ? body.data : body;
      const message = isRecord(body.message)
        ? body.message
        : isRecord(data.message)
          ? data.message
          : null;
      const conversation = isRecord(body.conversation)
        ? body.conversation
        : isRecord(data.conversation)
          ? data.conversation
          : null;
      const account = isRecord(body.account)
        ? body.account
        : isRecord(data.account)
          ? data.account
          : null;
      const sender = isRecord(message?.sender)
        ? message.sender
        : isRecord(data.sender)
          ? data.sender
          : null;

      if (event === "comment.received") {
        const comment = isRecord(body.comment) ? body.comment : isRecord(data.comment) ? data.comment : null;
        const post = isRecord(body.post) ? body.post : isRecord(data.post) ? data.post : null;
        const commentAuthor = isRecord(comment?.author) ? comment.author : null;
        const accountId = asString(account?.id) ?? asString(data.accountId);
        const commentText = asString(comment?.text) ?? "";
        const commentId = asString(comment?.id);
        const postId = asString(comment?.platformPostId) ?? asString(post?.platformPostId) ?? asString(post?.id);
        const instagramId = asString(commentAuthor?.id);
        const instagramUsername = asString(commentAuthor?.username) ?? asString(commentAuthor?.name) ?? "friend";

        if (!accountId || !commentId || !postId || !instagramId) {
          console.error("[Zernio] Missing data for comment onboarding flow");
          return new Response(JSON.stringify({ success: false, error: "Missing comment data" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!isRecipeKeywordComment(commentText)) {
          return new Response(JSON.stringify({ success: true, ignored: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        await ctx.scheduler.runAfter(0, internal.http.processCommentOnboarding, {
          accountId,
          postId,
          commentId,
          instagramId,
          instagramUsername,
          firstName: asString(commentAuthor?.name) ?? undefined,
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (event === "message.received" || event === "inbox.message.received") {
        const conversationId =
          asString(data.conversationId) ??
          asString(message?.conversationId) ??
          asString(conversation?.id);
        const accountId = asString(data.accountId) ?? asString(account?.id);
        const senderId = asString(data.senderId) ?? asString(sender?.id);
        const senderName =
          asString(data.senderName) ??
          asString(sender?.name) ??
          asString(conversation?.participantName) ??
          "friend";
        const senderUsername =
          asString(sender?.username) ??
          asString(conversation?.participantUsername) ??
          senderName;
        const attachments =
          (Array.isArray(message?.attachments) ? message.attachments : null) ??
          (Array.isArray(data.attachments) ? data.attachments : []);

        if (!conversationId || !accountId) {
          console.error("[Zernio] Missing conversation or account id");
          return new Response(JSON.stringify({ success: false, error: "Missing ids" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!isAllowedZernioAccount(accountId)) {
          console.log("[Zernio] Ignoring event for unapproved account:", accountId);
          return new Response(JSON.stringify({ success: true, ignored: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (isManagedInstagramUsername(senderUsername)) {
          console.log("[Zernio] Ignoring managed account message from:", senderUsername);
          return new Response(JSON.stringify({ success: true, ignored: true, action: "ignore_managed_account" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        console.log("[Zernio] New message from:", senderName, senderId);
        console.log("[Zernio] Attachments:", attachments.length);

        // Check for reel attachment
        const reel = attachments
          .map((attachment: unknown) => normalizeAttachment(attachment))
          .find((attachment: ZernioAttachment | null) => attachment !== null && isReelAttachment(attachment));
        
        if (reel) {
          const reelContext = extractReelContext(reel);

          if (senderId) {
            await ctx.runMutation(internal.instagramAuth.markReelReceived, {
              instagramId: senderId,
              accountId,
              conversationId,
            });
          }
          
          console.log("[Zernio] Reel detected:", reelContext.caption || reelContext.shortcode);

          // Send immediate acknowledgment
          await sendZernioReply(accountId, conversationId, 
            `Hey ${senderName.split(' ')[0]}! 👋 Got your reel! 🍳\n\nExtracting the recipe now...`
          );

          await ctx.scheduler.runAfter(0, internal.http.processZernioReel, {
            reel: reelContext,
            conversationId,
            accountId,
            instagramId: senderId ?? undefined,
          });

          return new Response(JSON.stringify({ success: true, action: "recipe_extraction" }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        if (senderId) {
          const instagramUser = await ctx.runQuery(api.instagramAuth.getInstagramUser, {
            instagramId: senderId,
          }) as {
            clerkUserId?: string;
            onboardingClaimedAt?: number;
          } | null;
          const isLinkedUser = Boolean(instagramUser?.clerkUserId || instagramUser?.onboardingClaimedAt);

          if (!isLinkedUser) {
            await sendDirectOnboardingReply(ctx, {
              accountId,
              conversationId,
              instagramId: senderId,
              instagramUsername: senderUsername,
              firstName: senderName,
            });

            return new Response(JSON.stringify({ success: true, action: "direct_onboarding" }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
        }

        return new Response(JSON.stringify({ success: true, ignored: true, action: "ignore_non_reel_message" }), {
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
  });

http.route({
  path: "/zernio/webhook",
  method: "POST",
  handler: zernioWebhookHandler,
});

http.route({
  path: "/zernio/appitito-webhook",
  method: "POST",
  handler: zernioWebhookHandler,
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
      const result = await ctx.runMutation(api.instagramAuth.validateAuthToken, { token });
      
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

http.route({
  path: "/auth/token-info",
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

      const result = await ctx.runQuery(api.instagramAuth.getAuthTokenInfo, { token });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: corsHeaders(),
      });
    } catch (error) {
      console.error("[Auth Token Info] Error:", error);
      return new Response(
        JSON.stringify({ valid: false, error: "Internal error" }),
        { status: 500, headers: corsHeaders() }
      );
    }
  }),
});

http.route({
  path: "/auth/token-info",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders() })),
});

http.route({
  path: "/auth/consume",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { token } = await request.json();

      if (!token) {
        return new Response(
          JSON.stringify({ success: false, error: "No token provided" }),
          { status: 400, headers: corsHeaders() }
        );
      }

      const result = await ctx.runMutation(api.instagramAuth.consumeAuthToken, { token });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: corsHeaders(),
      });
    } catch (error) {
      console.error("[Auth Consume] Error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Internal error" }),
        { status: 500, headers: corsHeaders() }
      );
    }
  }),
});

http.route({
  path: "/auth/consume",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders() })),
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
      const { token, instagramId, instagramUsername, recipeId, firstName, accountId, conversationId } = await request.json();
      
      await ctx.runMutation(internal.instagramAuth.storeExternalAuthToken, {
        token,
        instagramId,
        instagramUsername,
        recipeId,
        firstName,
        accountId,
        conversationId,
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

http.route({
  path: "/auth/link-clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { instagramId, clerkUserId, email } = await request.json();

      if (!instagramId || !clerkUserId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing instagramId or clerkUserId" }),
          { status: 400, headers: corsHeaders() }
        );
      }

      const result = await ctx.runMutation(api.instagramAuth.linkInstagramToClerk, {
        instagramId,
        clerkUserId,
        email,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: corsHeaders(),
      });
    } catch (error) {
      console.error("[Auth Link Clerk] Error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Internal error" }),
        { status: 500, headers: corsHeaders() }
      );
    }
  }),
});

http.route({
  path: "/auth/link-clerk",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders() })),
});

http.route({
  path: "/auth/onboarding-claimed",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { instagramId } = await request.json();

      if (!instagramId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing instagramId" }),
          { status: 400, headers: corsHeaders() }
        );
      }

      const result = await ctx.runMutation(internal.instagramAuth.markOnboardingClaimed, {
        instagramId,
      });

      // TODO: Re-enable onboarding reminder once testing is complete
      // if (result.success) {
      //   await ctx.scheduler.runAfter(10 * 60 * 1000, internal.http.sendOnboardingReminder, {
      //     instagramId,
      //   });
      // }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: corsHeaders(),
      });
    } catch (error) {
      console.error("[Auth Onboarding Claimed] Error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Internal error" }),
        { status: 500, headers: corsHeaders() }
      );
    }
  }),
});

http.route({
  path: "/auth/onboarding-claimed",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders() })),
});

http.route({
  path: "/auth/reset-token",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { token, instagramId } = await request.json();

      if (!token || !instagramId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing token or instagramId" }),
          { status: 400, headers: corsHeaders() }
        );
      }

      const result = await ctx.runMutation(internal.instagramAuth.resetAuthTokenIfUnused, {
        token,
        instagramId,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: corsHeaders(),
      });
    } catch (error) {
      console.error("[Auth Reset Token] Error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Internal error" }),
        { status: 500, headers: corsHeaders() }
      );
    }
  }),
});

http.route({
  path: "/auth/reset-token",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders() })),
});

http.route({
  path: "/admin/clear-instagram-user",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { instagramId } = await request.json();

      if (!instagramId) {
        return new Response(JSON.stringify({ success: false, error: "Missing instagramId" }), {
          status: 400,
          headers: corsHeaders(),
        });
      }

      const result = await ctx.runMutation(api.instagramAuth.clearInstagramUserTestingData, {
        instagramId,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: corsHeaders(),
      });
    } catch (error) {
      console.error("[Admin Clear Instagram User] Error:", error);
      return new Response(JSON.stringify({ success: false, error: "Internal error" }), {
        status: 500,
        headers: corsHeaders(),
      });
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
    console.log("[Zernio] Sending button reply URL:", buttonUrl);
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

async function sendZernioPrivateReplyToComment(
  accountId: string,
  postId: string,
  commentId: string,
  message: string
) {
  const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY;

  if (!ZERNIO_API_KEY) {
    console.error("[Zernio] Missing API key for private reply");
    return;
  }

  try {
    const response = await fetch(
      `https://zernio.com/api/v1/inbox/comments/${postId}/${commentId}/private-reply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ZERNIO_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accountId, message }),
      }
    );

    if (!response.ok) {
      console.error("[Zernio] Private reply failed:", await response.text());
      return;
    }

    console.log("[Zernio] Private reply sent for comment:", commentId);
  } catch (error) {
    console.error("[Zernio] Error sending private reply:", error);
  }
}

async function sendZernioPublicReplyToComment(
  accountId: string,
  postId: string,
  commentId: string,
  message: string
) {
  const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY;

  if (!ZERNIO_API_KEY) {
    console.error("[Zernio] Missing API key for public comment reply");
    return;
  }

  try {
    const response = await fetch(`https://zernio.com/api/v1/inbox/comments/${postId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ZERNIO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId,
        commentId,
        message,
      }),
    });

    if (!response.ok) {
      console.error("[Zernio] Public comment reply failed:", await response.text());
      return;
    }

    console.log("[Zernio] Public comment reply sent:", commentId);
  } catch (error) {
    console.error("[Zernio] Error sending public comment reply:", error);
  }
}

async function sendCommentOnboardingReply(
  ctx: RunCtx,
  args: {
    accountId: string;
    postId: string;
    commentId: string;
    instagramId: string;
    instagramUsername: string;
    firstName?: string;
  }
) {
  const token = crypto.randomUUID();
  const recipeId = `onboarding:${args.instagramId}`;

  await ctx.runMutation(internal.instagramAuth.storeExternalAuthToken, {
    token,
    instagramId: args.instagramId,
    instagramUsername: args.instagramUsername,
    recipeId,
    firstName: args.firstName,
    accountId: args.accountId,
  });

  const onboardingLink = `https://appitito.com/claim?auth=${encodeURIComponent(token)}`;
  await sendZernioPublicReplyToComment(
    args.accountId,
    args.postId,
    args.commentId,
    "Save your recipes"
  );
  await sendZernioPrivateReplyToComment(
    args.accountId,
    args.postId,
    args.commentId,
    `${onboardingLink}\n\nOpen Appitito now. You're in. Now go get hungry and DM me.`
  );
}

async function sendDirectOnboardingReply(
  ctx: RunCtx,
  args: {
    accountId: string;
    conversationId: string;
    instagramId: string;
    instagramUsername: string;
    firstName?: string;
  }
) {
  const token = crypto.randomUUID();
  const recipeId = `onboarding:${args.instagramId}`;

  console.log("[Onboarding Debug][direct] preparing token for", args.instagramUsername, args.instagramId);

  await ctx.runMutation(internal.instagramAuth.storeExternalAuthToken, {
    token,
    instagramId: args.instagramId,
    instagramUsername: args.instagramUsername,
    recipeId,
    firstName: args.firstName,
    accountId: args.accountId,
    conversationId: args.conversationId,
  });

  const onboardingLink = `https://appitito.com/claim?auth=${encodeURIComponent(token)}`;
  console.log("[Onboarding Debug][direct] sending onboarding link:", onboardingLink);
  await sendZernioReplyWithButton(
    args.accountId,
    args.conversationId,
    "You're in. Tap below to open Appitito.",
    "Open Appitito",
    onboardingLink
  );
}


async function extractRecipeAndReply(
  ctx: RunCtx,
  reel: ReelContext,
  conversationId: string,
  accountId: string,
  instagramId?: string
) {
  console.log("[Recipe] Extracting from:", reel.caption.slice(0, 100) || reel.shortcode);

  try {
    if (instagramId) {
      const usage = await getRecipeUsageState(ctx, instagramId);
      if (!usage.hasActiveSubscription && usage.weeklyCount >= 3) {
        await sendZernioReplyWithButton(
          accountId,
          conversationId,
          "You’ve used your 3 free recipes for this week. Upgrade to keep turning reels into recipes.",
          "Upgrade",
          "https://appitito.com/?billing=1"
        );
        return;
      }
    }

    const existingRecipeId = await getExistingExtractedRecipeId(ctx, reel.shortcode);
    if (existingRecipeId) {
      const recipeUrl = buildRecipeUrl(existingRecipeId);
      console.log("[Reply Debug][appUrl]", getAppUrl());
      console.log("[Reply Debug][existingRecipe] URL:", recipeUrl);
      await sendZernioReplyWithButton(
        accountId,
        conversationId,
        "🍽️ I already had this one ready for you.",
        "View Recipe 🍳",
        recipeUrl
      );
      if (instagramId) {
        await recordRecipeDeliveryAndMaybeWarn(ctx, instagramId, String(existingRecipeId), accountId, conversationId);
      }
      return;
    }

    let recipe = await extractRecipeFromCaption(reel);
    let extractionMethod = "caption";
    const muxAsset = reel.videoUrl ? await ingestVideoToMux(reel) : null;
    let bestThumbnailSecond: number | undefined;

    if (!hasCompleteRecipe(recipe) && reel.videoUrl) {
      console.log("[Recipe] Caption extraction incomplete, falling back to video analysis");
      const videoResult = await extractRecipeFromVideo(reel);
      bestThumbnailSecond = videoResult.bestThumbnailSecond;
      if (hasCompleteRecipe(videoResult.recipe)) {
        recipe = videoResult.recipe;
        extractionMethod = "video";
      }
    }

    if (!hasCompleteRecipe(recipe)) {
      console.error("[Recipe] Could not extract a complete recipe");
      await sendZernioReply(
        accountId,
        conversationId,
        `I couldn't fully extract both the ingredients and the steps from that reel yet. Try sending a reel with clearer on-screen recipe details.`
      );
      return;
    }

    recipe = {
      ...recipe,
      imageUrl: muxAsset
        ? extractionMethod === "video"
          ? pickGeminiThumbnailUrl(muxAsset, bestThumbnailSecond)
          : await chooseBestMuxThumbnail(muxAsset)
        : recipe.imageUrl,
    };

    const recipeId = await saveExtractedRecipe(ctx, reel, recipe, muxAsset);
    console.log("[Recipe] Extracted:", recipe.title, `via ${extractionMethod}`);
    const recipeUrl = buildRecipeUrl(recipeId);
    console.log("[Reply Debug][appUrl]", getAppUrl());
    console.log("[Reply Debug][newRecipe] URL:", recipeUrl);

    await sendZernioReplyWithButton(
      accountId,
      conversationId,
      `🍽️ ${recipe.title}\n\nYour recipe is ready!`,
      "View Recipe 🍳",
      recipeUrl
    );
    if (instagramId) {
      await recordRecipeDeliveryAndMaybeWarn(ctx, instagramId, String(recipeId), accountId, conversationId);
    }
  } catch (err) {
    console.error("[Recipe] Error:", err);

    await sendZernioReply(
      accountId,
      conversationId,
      `Something went wrong while extracting that recipe. Please try another reel in a moment.`
    );
  }
}

function normalizeAttachment(value: unknown): ZernioAttachment | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    type: asString(value.type) || undefined,
    id: asString(value.id) || undefined,
    url: asString(value.url) || undefined,
    title: asString(value.title) || undefined,
    payload: isRecord(value.payload) ? value.payload : undefined,
  };
}

function isReelAttachment(attachment: ZernioAttachment) {
  return attachment.type === "ig_reel" || attachment.type === "video";
}

function extractReelContext(attachment: ZernioAttachment): ReelContext {
  const payload = attachment.payload ?? {};
  const permalink =
    firstString(
      asString(payload.permalink),
      asString(payload.reel_url),
      asString(payload.url),
      attachment.url
    ) ?? undefined;
  const reelId =
    firstString(
      asString(payload.reel_video_id),
      asString(payload.id),
      attachment.id,
      permalink,
      crypto.randomUUID()
    ) ?? crypto.randomUUID();
  const shortcode = extractInstagramShortcode(permalink) ?? sanitizeIdentifier(reelId);
  const caption =
    firstString(
      asString(payload.caption),
      asString(payload.title),
      attachment.title,
      shortcode
    ) ?? shortcode;
  const videoUrl =
    firstString(
      asString(payload.video_url),
      asString(payload.videoUrl),
      asString(payload.download_url),
      asString(payload.downloadUrl),
      asString(payload.source_url),
      asString(payload.sourceUrl),
      asString(payload.url),
      attachment.url
    ) ?? undefined;

  return {
    reelId,
    shortcode,
    caption,
    videoUrl,
    permalink,
  };
}

function extractInstagramShortcode(url?: string) {
  if (!url) return null;
  const match = url.match(/instagram\.com\/(?:reel|p)\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

function sanitizeIdentifier(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function extractRecipeFromCaption(reel: ReelContext): Promise<RecipeDraft | null> {
  return await requestRecipeExtraction([
    {
      role: "user",
      content:
        `Extract a recipe from this Instagram reel caption. ` +
        `Only return ingredients and instructions when the caption actually provides enough detail. ` +
        `Do not invent a complete recipe if the caption is vague.\n\n` +
        `Shortcode: ${reel.shortcode}\n` +
        `Caption: ${reel.caption}`,
    },
  ], reel);
}

async function extractRecipeFromVideo(reel: ReelContext): Promise<VideoExtractionResult> {
  if (!reel.videoUrl) {
    return { recipe: null };
  }

  const videoResponse = await fetch(reel.videoUrl);
  if (!videoResponse.ok) {
    console.error("[Recipe] Failed to download reel video:", videoResponse.status);
    return { recipe: null };
  }

  const videoBytes = await videoResponse.arrayBuffer();
  const mimeType = videoResponse.headers.get("content-type") || "video/mp4";
  const dataUrl = `data:${mimeType};base64,${arrayBufferToBase64(videoBytes)}`;

  const result = await requestVideoRecipeExtraction([
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            `Watch this cooking reel and extract the actual recipe only if the video clearly contains it. ` +
            `Ingredients and instructions must both be present to count as a successful extraction. ` +
            `Also choose the best second to capture a thumbnail when the finished dish looks most appealing. ` +
            `If the finished dish never clearly appears, choose either the first useful plated moment or the final frame. ` +
            `If the video still does not reveal enough information, return empty arrays for the missing sections.`,
        },
        {
          type: "video_url",
          video_url: {
            url: dataUrl,
          },
        },
      ],
    },
  ], reel);

  return result;
}

async function requestRecipeExtraction(messages: unknown[], reel: ReelContext): Promise<RecipeDraft | null> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    console.error("[Recipe] OPEN_ROUTER_API_KEY is not set");
    return null;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-lite-preview",
      messages,
      temperature: 0.1,
      max_tokens: 1200,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "recipe_extraction",
          strict: true,
          schema: recipeSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    console.error("[Recipe] OpenRouter extraction failed:", await response.text());
    return null;
  }

  const result = await response.json() as JsonRecord;
  const content = getOpenRouterText(result);
  return parseRecipeDraft(content, reel);
}

async function requestVideoRecipeExtraction(messages: unknown[], reel: ReelContext): Promise<VideoExtractionResult> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    console.error("[Recipe] OPEN_ROUTER_API_KEY is not set");
    return { recipe: null };
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-lite-preview",
      messages,
      temperature: 0.1,
      max_tokens: 1400,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "video_recipe_extraction",
          strict: true,
          schema: {
            ...recipeSchema,
            properties: {
              ...recipeSchema.properties,
              best_thumbnail_second: { type: "number" },
            },
            required: [...recipeSchema.required, "best_thumbnail_second"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    console.error("[Recipe] OpenRouter video extraction failed:", await response.text());
    return { recipe: null };
  }

  const result = await response.json() as JsonRecord;
  const content = getOpenRouterText(result);
  const parsed = safeJsonParse(content);
  if (!parsed || !isRecord(parsed)) {
    return { recipe: null };
  }

  return {
    recipe: parseRecipeDraft(content, reel),
    bestThumbnailSecond: asNumber(parsed.best_thumbnail_second) ?? undefined,
  };
}

async function getExistingExtractedRecipeId(ctx: RunCtx, shortcode: string) {
  const existing = await ctx.runQuery(internal.zernioRecipe.getExtractedRecipeByShortcode, {
    shortcode,
  }) as { _id?: string } | null;

  return existing?._id ?? null;
}

async function saveExtractedRecipe(ctx: RunCtx, reel: ReelContext, recipe: RecipeDraft, muxAsset: MuxAsset | null) {
  return await ctx.runMutation(internal.zernioRecipe.upsertExtractedRecipe, {
    shortcode: reel.shortcode,
    reelUrl: reel.videoUrl ?? reel.permalink,
    muxPlaybackId: muxAsset?.playbackId,
    muxAssetId: muxAsset?.assetId,
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    servings: recipe.servings,
    prep_time: recipe.prep_time,
    cook_time: recipe.cook_time,
    cuisine: recipe.cuisine,
    diet: recipe.diet,
  }) as string;
}

async function ingestVideoToMux(reel: ReelContext): Promise<MuxAsset | null> {
  if (!reel.videoUrl) {
    return null;
  }

  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    console.error("[Mux] Missing Mux credentials");
    return null;
  }

  try {
    const auth = basicAuth(tokenId, tokenSecret);
    const response = await fetch("https://api.mux.com/video/v1/assets", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: [{ url: reel.videoUrl }],
        playback_policy: ["public"],
        passthrough: reel.shortcode,
      }),
    });

    if (!response.ok) {
      console.error("[Mux] Asset creation failed:", await response.text());
      return null;
    }

    const result = await response.json() as { data?: { id?: string; playback_ids?: Array<{ id?: string }> } };
    const assetId = result.data?.id;
    const playbackId = result.data?.playback_ids?.[0]?.id;

    if (!assetId || !playbackId) {
      console.error("[Mux] Missing asset or playback id in response");
      return null;
    }

    const readyAsset = await waitForMuxAssetReady(assetId, playbackId, tokenId, tokenSecret);
    console.log("[Mux] Asset created:", assetId);
    return readyAsset ?? { assetId, playbackId };
  } catch (error) {
    console.error("[Mux] Failed to ingest video:", error);
    return null;
  }
}

async function waitForMuxAssetReady(
  assetId: string,
  playbackId: string,
  tokenId: string,
  tokenSecret: string
): Promise<MuxAsset | null> {
  const auth = basicAuth(tokenId, tokenSecret);

  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!response.ok) {
      console.error("[Mux] Failed to fetch asset status:", await response.text());
      return null;
    }

    const result = await response.json() as { data?: { status?: string; duration?: number } };
    if (result.data?.status === "ready") {
      return { assetId, playbackId, duration: result.data.duration };
    }

    await sleep(2000);
  }

  return { assetId, playbackId };
}

async function chooseBestMuxThumbnail(muxAsset: MuxAsset): Promise<string> {
  const frames = getMuxThumbnailCandidates(muxAsset);
  const choice = await chooseThumbnailWithQwen(frames);
  return choice ?? frames[Math.min(1, frames.length - 1)];
}

function pickGeminiThumbnailUrl(muxAsset: MuxAsset, bestThumbnailSecond?: number) {
  if (typeof bestThumbnailSecond === "number" && Number.isFinite(bestThumbnailSecond) && bestThumbnailSecond >= 0) {
    return buildMuxThumbnailUrl(muxAsset.playbackId, bestThumbnailSecond);
  }

  const frames = getMuxThumbnailCandidates(muxAsset);
  return frames[frames.length - 1] ?? buildMuxThumbnailUrl(muxAsset.playbackId, 1);
}

function getMuxThumbnailCandidates(muxAsset: MuxAsset) {
  const duration = muxAsset.duration && muxAsset.duration > 0 ? muxAsset.duration : 9;
  const first = Math.max(0.5, Math.min(1, duration));
  const middle = Math.max(first, duration * 0.5);
  const last = Math.max(first, duration - 0.5);

  return [
    buildMuxThumbnailUrl(muxAsset.playbackId, first),
    buildMuxThumbnailUrl(muxAsset.playbackId, middle),
    buildMuxThumbnailUrl(muxAsset.playbackId, last),
  ];
}

function buildMuxThumbnailUrl(playbackId: string, time: number) {
  const rounded = Math.max(0, Math.round(time * 10) / 10);
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${rounded}`;
}

async function chooseThumbnailWithQwen(frames: string[]): Promise<string | null> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey || frames.length === 0) {
    return null;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen/qwen3.5-flash-02-23",
      temperature: 0,
      max_tokens: 300,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "thumbnail_choice",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              choice: { type: "string", enum: ["first", "middle", "last"] },
              reason: { type: "string" },
            },
            required: ["choice", "reason"],
          },
        },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Pick the best thumbnail for a food reel. Favor the frame where the finished dish looks most appetizing, clear, bright, and centered. Return which of the three is best: first, middle, or last.",
            },
            { type: "image_url", image_url: { url: frames[0] } },
            { type: "image_url", image_url: { url: frames[1] } },
            { type: "image_url", image_url: { url: frames[2] } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error("[Thumbnail] Qwen selection failed:", await response.text());
    return null;
  }

  const result = await response.json() as JsonRecord;
  const content = getOpenRouterText(result);
  const parsed = safeJsonParse(content);
  if (!parsed || !isRecord(parsed)) {
    return null;
  }

  switch (asString(parsed.choice)) {
    case "first":
      return frames[0] ?? null;
    case "middle":
      return frames[1] ?? null;
    case "last":
      return frames[2] ?? null;
    default:
      return null;
  }
}

async function findConversationIdForInstagramUser(accountId: string, instagramId: string) {
  const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY;
  if (!ZERNIO_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `https://zernio.com/api/v1/inbox/conversations?accountId=${encodeURIComponent(accountId)}&platform=instagram&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${ZERNIO_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error("[Zernio] Failed to list conversations:", await response.text());
      return null;
    }

    const result = await response.json() as {
      data?: Array<{ id?: string; participantId?: string }>;
    };
    const match = result.data?.find((conversation) => conversation.participantId === instagramId);
    return match?.id ?? null;
  } catch (error) {
    console.error("[Zernio] Error resolving conversation for reminder:", error);
    return null;
  }
}

function buildRecipeUrl(recipeId: string) {
  return `https://appitito.com/recipe/${recipeId}`;
}

function parseRecipeDraft(content: string, reel: ReelContext): RecipeDraft | null {
  const parsed = safeJsonParse(content);
  if (!parsed || !isRecord(parsed)) {
    return null;
  }

  const ingredients = asStringArray(parsed.ingredients);
  const instructions = asStringArray(parsed.instructions);

  return {
    title: asString(parsed.title) ?? asString(parsed.dishName) ?? `Recipe from ${reel.shortcode}`,
    description: asString(parsed.description) || undefined,
    ingredients,
    instructions,
    prep_time: (asString(parsed.prep_time) ?? asString(parsed.prepTime)) || undefined,
    cook_time: (asString(parsed.cook_time) ?? asString(parsed.cookTime)) || undefined,
    servings: asString(parsed.servings) || undefined,
    cuisine: asString(parsed.cuisine) || undefined,
    diet: asString(parsed.diet) || undefined,
    imageUrl: asString(parsed.imageUrl) || undefined,
  };
}

function hasCompleteRecipe(recipe: RecipeDraft | null): recipe is RecipeDraft {
  return !!recipe && recipe.ingredients.length > 0 && recipe.instructions.length > 0;
}

function getOpenRouterText(result: JsonRecord) {
  const choices = Array.isArray(result.choices) ? result.choices : [];
  const firstChoice = choices[0];
  if (!isRecord(firstChoice)) return "";
  const message = isRecord(firstChoice.message) ? firstChoice.message : undefined;
  const content = message?.content;

  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!isRecord(part)) return "";
      return asString(part.text) ?? "";
    })
    .join("\n")
    .trim();
}

function safeJsonParse(content: string) {
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as unknown;
  } catch {
    return null;
  }
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function firstString(...values: Array<string | null | undefined>) {
  return values.find((value): value is string => typeof value === "string" && value.length > 0) ?? null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function basicAuth(username: string, password: string) {
  return btoa(`${username}:${password}`);
}

function isRecipeKeywordComment(text: string) {
  return isRecipeKeywordMessage(text);
}

function isRecipeKeywordMessage(text: string) {
  return text.trim().toLowerCase() === "recipe";
}


function isAllowedZernioAccount(accountId: string) {
  const isEnforced = process.env.ZERNIO_ENFORCE_ALLOWED_ACCOUNT_IDS === "true";
  if (!isEnforced) {
    return true;
  }

  const allowed = process.env.ZERNIO_ALLOWED_ACCOUNT_IDS;
  if (!allowed) {
    return true;
  }

  const allowedIds = allowed
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return allowedIds.includes(accountId);
}

function isManagedInstagramUsername(username?: string) {
  if (!username) {
    return false;
  }

  const managed = process.env.ZERNIO_MANAGED_INSTAGRAM_USERNAMES;
  if (!managed) {
    return false;
  }

  const normalized = username.trim().toLowerCase().replace(/^@/, "");
  const managedUsernames = managed
    .split(",")
    .map((value) => value.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

  return managedUsernames.includes(normalized);
}


function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const processZernioReel = internalAction({
  args: {
    reel: v.object({
      reelId: v.string(),
      shortcode: v.string(),
      caption: v.string(),
      videoUrl: v.optional(v.string()),
      permalink: v.optional(v.string()),
    }),
    conversationId: v.string(),
    accountId: v.string(),
    instagramId: v.optional(v.string()),
  },
  handler: async (ctx, { reel, conversationId, accountId, instagramId }) => {
    await extractRecipeAndReply(ctx, reel, conversationId, accountId, instagramId);
  },
});

export const processCommentOnboarding = internalAction({
  args: {
    accountId: v.string(),
    postId: v.string(),
    commentId: v.string(),
    instagramId: v.string(),
    instagramUsername: v.string(),
    firstName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await sendCommentOnboardingReply(ctx, args);
  },
});

async function getRecipeUsageState(ctx: RunCtx, instagramId: string) {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyCount = await ctx.runQuery(internal.instagramAuth.getWeeklyRecipeDeliveryCount, {
    instagramId,
    since,
  }) as number;

  const instagramUser = await ctx.runQuery(api.instagramAuth.getInstagramUser, {
    instagramId,
  }) as { clerkUserId?: string } | null;

  let hasActiveSubscription = false;
  if (instagramUser?.clerkUserId) {
    const subscriptions = await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, {
      userId: instagramUser.clerkUserId,
    }) as Array<{ status: string }>;
    hasActiveSubscription = subscriptions.some((subscription) =>
      subscription.status === "active" || subscription.status === "trialing"
    );
  }

  return { weeklyCount, hasActiveSubscription };
}

async function recordRecipeDeliveryAndMaybeWarn(
  ctx: RunCtx,
  instagramId: string,
  recipeId: string,
  accountId: string,
  conversationId: string
) {
  const usage = await getRecipeUsageState(ctx, instagramId);
  await ctx.runMutation(internal.instagramAuth.recordRecipeDelivery, {
    instagramId,
    recipeId,
  });

  if (!usage.hasActiveSubscription && usage.weeklyCount === 1) {
    await sendZernioReply(
      accountId,
      conversationId,
      "Hey, you're going to hit your weekly limit. You'll have one more for the week."
    );
  }
}

export const sendOnboardingReminder = internalAction({
  args: {
    instagramId: v.string(),
  },
  handler: async (ctx, { instagramId }) => {
    const reminderStatus = await ctx.runQuery(internal.instagramAuth.getReminderStatus, {
      instagramId,
    }) as {
      accountId?: string;
      conversationId?: string;
      onboardingClaimedAt?: number;
      lastReelReceivedAt?: number;
      onboardingReminderSentAt?: number;
    } | null;

    if (!reminderStatus?.accountId || !reminderStatus.onboardingClaimedAt) {
      return;
    }

    if (reminderStatus.onboardingReminderSentAt) {
      return;
    }

    if (
      reminderStatus.lastReelReceivedAt &&
      reminderStatus.lastReelReceivedAt >= reminderStatus.onboardingClaimedAt
    ) {
      return;
    }

    const conversationId = reminderStatus.conversationId ?? await findConversationIdForInstagramUser(
      reminderStatus.accountId,
      instagramId
    );

    if (!conversationId) {
      return;
    }

    await sendZernioReply(
      reminderStatus.accountId,
      conversationId,
      "Guess you haven’t sent another reel yet. Maybe you’re not hungry enough."
    );

    await ctx.runMutation(internal.instagramAuth.markReminderSent, {
      instagramId,
    });
  },
});

export default http;

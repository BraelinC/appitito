import { httpAction, internalAction, internalMutation } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";

// ── Webhook verification (GET) ────────────────────────────────
export const verify = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN ?? "appitito-webhook";

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("Webhook verified");
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
});

// ── Receive DM events (POST) ──────────────────────────────────
export const receive = httpAction(async (ctx, request) => {
  try {
    const body = await request.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    if (body.object !== "instagram") {
      return new Response("OK", { status: 200 });
    }

    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        const senderId = event.sender?.id;
        const messageText = event.message?.text ?? "";

        if (!senderId) continue;

        // Detect reel/post URLs
        const reelMatch = messageText.match(
          /instagram\.com\/(reel|p)\/([A-Za-z0-9_-]+)/
        );
        const reelShortcode = reelMatch ? reelMatch[2] : undefined;
        const reelUrl = reelMatch ? `https://www.instagram.com/reel/${reelMatch[2]}/` : undefined;

        // Save the event
        const eventId = await ctx.runMutation(internal.instagram.webhook.saveEvent, {
          senderId,
          messageText,
          reelUrl,
          reelShortcode,
        });

        // If it's a reel, schedule extraction
        if (reelShortcode) {
          await ctx.scheduler.runAfter(0, internal.instagram.extractRecipe.extractAndReply, {
            eventId,
            reelShortcode,
            senderId,
          });
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("OK", { status: 200 }); // Always return 200 to Meta
  }
});

// ── Internal mutation: save event to DB ───────────────────────
export const saveEvent = internalMutation({
  args: {
    senderId: v.string(),
    messageText: v.optional(v.string()),
    reelUrl: v.optional(v.string()),
    reelShortcode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("dmWebhookEvents", {
      senderId: args.senderId,
      messageText: args.messageText,
      reelUrl: args.reelUrl,
      reelShortcode: args.reelShortcode,
      processed: false,
      createdAt: Date.now(),
    });
  },
});

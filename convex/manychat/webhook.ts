import { httpAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// ── ManyChat webhook (POST) ────────────────────────────────────
// Receives data from ManyChat External Request
export const receive = httpAction(async (ctx, request) => {
  try {
    const body = await request.json();
    
    // Log EVERYTHING for debugging
    console.log("=== MANYCHAT WEBHOOK RECEIVED ===");
    console.log("Full payload:", JSON.stringify(body, null, 2));
    
    // Save to database for inspection
    await ctx.runMutation(internal.manychat.webhook.saveLog, {
      payload: JSON.stringify(body),
      timestamp: Date.now(),
    });

    // Extract common ManyChat fields
    const subscriberId = body.id || body.subscriber_id;
    const firstName = body.first_name || body.name;
    const igUsername = body.ig_username;
    const lastInput = body.last_input_text;
    
    console.log("Subscriber:", subscriberId);
    console.log("IG Username:", igUsername);
    console.log("Last Input:", lastInput);

    // Return a response that ManyChat can use
    // ManyChat expects specific JSON format for dynamic content
    return new Response(
      JSON.stringify({
        version: "v2",
        content: {
          messages: [
            {
              type: "text",
              text: `✅ Got it! You said: "${lastInput || 'something'}"\n\nProcessing your recipe request...`
            }
          ]
        },
        // Debug info
        debug: {
          received: body,
          timestamp: new Date().toISOString()
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("ManyChat webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// ── Save logs for debugging ────────────────────────────────────
export const saveLog = internalMutation({
  args: {
    payload: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("manychatLogs", {
      payload: args.payload,
      timestamp: args.timestamp,
    });
  },
});

// ── Get recent logs ────────────────────────────────────────────
export const getLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("manychatLogs")
      .order("desc")
      .take(10);
  },
});

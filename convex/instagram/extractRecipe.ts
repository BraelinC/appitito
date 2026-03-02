import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

// ── Extract recipe from reel + reply to sender ─────────────────
export const extractAndReply = internalAction({
  args: {
    eventId: v.id("dmWebhookEvents"),
    reelShortcode: v.string(),
    senderId: v.string(),
  },
  handler: async (ctx, { eventId, reelShortcode, senderId }) => {
    try {
      // 1. Check if already extracted
      const existing = await ctx.runQuery(
        internal.instagram.extractRecipe.getByShortcode,
        { shortcode: reelShortcode }
      );
      
      let extractedId: Id<"extractedRecipes">;

      if (existing) {
        extractedId = existing._id;
      } else {
        // 2. Extract recipe using AI (Silas API → Claude)
        const apiKey = process.env.SILAS_API_KEY;
        const baseUrl = process.env.SILAS_API_URL ?? "https://silas.braelin.uk";

        const prompt = `You are a recipe extraction assistant. Extract a recipe from this Instagram reel.

Instagram reel shortcode: ${reelShortcode}
Reel URL: https://www.instagram.com/reel/${reelShortcode}/

Based on the Instagram reel URL, extract or infer a plausible food recipe. Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "title": "Recipe name",
  "description": "Brief description (1-2 sentences)",
  "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
  "instructions": ["Step 1: ...", "Step 2: ..."],
  "prep_time": "15 min",
  "cook_time": "30 min",
  "servings": "4",
  "cuisine": "Italian",
  "diet": "vegetarian",
  "imageUrl": null
}`;

        let recipe = {
          title: `Recipe from Reel ${reelShortcode}`,
          description: "Extracted from Instagram reel",
          ingredients: ["See original reel for ingredients"],
          instructions: ["See original reel for instructions"],
          prep_time: undefined as string | undefined,
          cook_time: undefined as string | undefined,
          servings: undefined as string | undefined,
          cuisine: undefined as string | undefined,
          diet: undefined as string | undefined,
          imageUrl: undefined as string | undefined,
        };

        if (apiKey) {
          try {
            const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-6",
                max_tokens: 1024,
                messages: [{ role: "user", content: prompt }],
              }),
            });

            if (resp.ok) {
              const data = await resp.json() as any;
              const content = data?.choices?.[0]?.message?.content ?? "";
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                recipe = { ...recipe, ...parsed };
              }
            }
          } catch (e) {
            console.error("AI extraction failed:", e);
          }
        }

        // 3. Save to extractedRecipes
        extractedId = await ctx.runMutation(
          internal.instagram.extractRecipe.saveExtracted,
          {
            instagramReelShortcode: reelShortcode,
            reelUrl: `https://www.instagram.com/reel/${reelShortcode}/`,
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
          }
        );
      }

      // 4. Mark event as processed
      await ctx.runMutation(internal.instagram.extractRecipe.markProcessed, {
        eventId,
        extractedRecipeId: extractedId,
      });

      // 5. Send DM reply
      const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
      if (accessToken) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://appitito.com";
        const replyText = `🍽️ Got your reel! Here's the extracted recipe: ${appUrl}/recipe/${extractedId}`;

        // Page token (EAA) → use Facebook Graph API page endpoint
        // Instagram token (IGAAR) → use Instagram Graph API
        const isPageToken = accessToken.startsWith("EAA");
        const pageId = process.env.FB_PAGE_ID ?? "1088713657640083";
        const replyUrl = isPageToken
          ? `https://graph.facebook.com/v22.0/${pageId}/messages`
          : `https://graph.instagram.com/v22.0/me/messages`;

        const replyResp = await fetch(replyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: replyText },
            access_token: accessToken,
          }),
        });
        console.log("Reply sent:", replyResp.status, await replyResp.text());
      }
    } catch (err) {
      console.error("extractAndReply error:", err);
    }
  },
});

// ── Internal query: check for existing extraction ─────────────
export const getByShortcode = internalQuery({
  args: { shortcode: v.string() },
  handler: async (ctx, { shortcode }) => {
    return await ctx.db
      .query("extractedRecipes")
      .withIndex("by_shortcode", (q) => q.eq("instagramReelShortcode", shortcode))
      .first();
  },
});

// ── Internal mutation: save extracted recipe ──────────────────
export const saveExtracted = internalMutation({
  args: {
    instagramReelShortcode: v.string(),
    reelUrl: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    ingredients: v.array(v.string()),
    instructions: v.array(v.string()),
    servings: v.optional(v.string()),
    prep_time: v.optional(v.string()),
    cook_time: v.optional(v.string()),
    cuisine: v.optional(v.string()),
    diet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("extractedRecipes", {
      ...args,
      extractedAt: Date.now(),
    });
  },
});

// ── Internal mutation: mark event processed ───────────────────
export const markProcessed = internalMutation({
  args: {
    eventId: v.id("dmWebhookEvents"),
    extractedRecipeId: v.optional(v.id("extractedRecipes")),
  },
  handler: async (ctx, { eventId }) => {
    await ctx.db.patch(eventId, { processed: true });
  },
});

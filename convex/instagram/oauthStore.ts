import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

// Save or update connected Instagram account
export const saveToken = internalMutation({
  args: {
    igUserId: v.string(),
    username: v.string(),
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { igUserId, username, accessToken, expiresAt }) => {
    const existing = await ctx.db
      .query("connectedAccounts")
      .withIndex("by_ig_user_id", (q) => q.eq("igUserId", igUserId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { accessToken, username, expiresAt, updatedAt: Date.now() });
      console.log(`Updated token for @${username} (${igUserId})`);
    } else {
      await ctx.db.insert("connectedAccounts", {
        igUserId,
        username,
        accessToken,
        expiresAt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      console.log(`Saved new token for @${username} (${igUserId})`);
    }
  },
});

// Get active token for a given IG user
export const getToken = internalQuery({
  args: { igUserId: v.string() },
  handler: async (ctx, { igUserId }) => {
    return await ctx.db
      .query("connectedAccounts")
      .withIndex("by_ig_user_id", (q) => q.eq("igUserId", igUserId))
      .first();
  },
});

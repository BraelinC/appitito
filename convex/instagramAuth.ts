import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Generate auth token for Instagram DM user
 */
export const createAuthToken = mutation({
  args: {
    instagramId: v.string(),
    instagramUsername: v.string(),
    recipeId: v.string(),
    firstName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate unique token
    const token = crypto.randomUUID();
    
    // Create or update Instagram user
    const existingUser = await ctx.db
      .query("instagramUsers")
      .withIndex("by_instagram_id", (q) => q.eq("instagramId", args.instagramId))
      .first();
    
    if (!existingUser) {
      await ctx.db.insert("instagramUsers", {
        instagramId: args.instagramId,
        instagramUsername: args.instagramUsername,
        firstName: args.firstName,
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
      });
    } else {
      await ctx.db.patch(existingUser._id, {
        lastSeenAt: Date.now(),
        instagramUsername: args.instagramUsername,
      });
    }
    
    // Create auth token (24 hour expiry)
    await ctx.db.insert("recipeAuthTokens", {
      token,
      instagramId: args.instagramId,
      instagramUsername: args.instagramUsername,
      recipeId: args.recipeId,
      used: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
    
    return token;
  },
});

/**
 * Validate and consume auth token
 * Returns user info if valid, null if invalid/expired/used
 */
export const validateAuthToken = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenData = await ctx.db
      .query("recipeAuthTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    // Check if token exists
    if (!tokenData) {
      return { valid: false, reason: "Token not found" };
    }
    
    // Check if already used
    if (tokenData.used) {
      return { valid: false, reason: "Token already used" };
    }
    
    // Check if expired
    if (tokenData.expiresAt < Date.now()) {
      return { valid: false, reason: "Token expired" };
    }
    
    // Mark token as used
    await ctx.db.patch(tokenData._id, {
      used: true,
      usedBy: tokenData.instagramId,
    });
    
    // Get or create Instagram user
    const instagramUser = await ctx.db
      .query("instagramUsers")
      .withIndex("by_instagram_id", (q) => q.eq("instagramId", tokenData.instagramId))
      .first();
    
    return {
      valid: true,
      instagramId: tokenData.instagramId,
      instagramUsername: tokenData.instagramUsername,
      recipeId: tokenData.recipeId,
      clerkUserId: instagramUser?.clerkUserId,
      isNewUser: !instagramUser?.clerkUserId,
    };
  },
});

/**
 * Link Instagram account to Clerk user
 */
export const linkInstagramToClerk = mutation({
  args: {
    instagramId: v.string(),
    clerkUserId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const instagramUser = await ctx.db
      .query("instagramUsers")
      .withIndex("by_instagram_id", (q) => q.eq("instagramId", args.instagramId))
      .first();
    
    if (instagramUser) {
      await ctx.db.patch(instagramUser._id, {
        clerkUserId: args.clerkUserId,
        email: args.email,
      });
      return { success: true, linked: true };
    }
    
    return { success: false, error: "Instagram user not found" };
  },
});

/**
 * Get user by Instagram ID
 */
export const getInstagramUser = query({
  args: {
    instagramId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("instagramUsers")
      .withIndex("by_instagram_id", (q) => q.eq("instagramId", args.instagramId))
      .first();
  },
});

/**
 * Check if token is valid (without consuming it)
 */
export const checkAuthToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenData = await ctx.db
      .query("recipeAuthTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (!tokenData) return { valid: false };
    if (tokenData.used) return { valid: false, reason: "used" };
    if (tokenData.expiresAt < Date.now()) return { valid: false, reason: "expired" };
    
    return {
      valid: true,
      recipeId: tokenData.recipeId,
      instagramUsername: tokenData.instagramUsername,
    };
  },
});

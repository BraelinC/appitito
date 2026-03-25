import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
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

export const getAuthTokenInfo = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenData = await ctx.db
      .query("recipeAuthTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!tokenData) {
      return { valid: false, reason: "Token not found" };
    }

    if (tokenData.used) {
      return { valid: false, reason: "Token already used" };
    }

    if (tokenData.expiresAt < Date.now()) {
      return { valid: false, reason: "Token expired" };
    }

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

export const consumeAuthToken = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenData = await ctx.db
      .query("recipeAuthTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!tokenData) {
      return { success: false, reason: "Token not found" };
    }

    if (tokenData.used) {
      return { success: false, reason: "Token already used" };
    }

    if (tokenData.expiresAt < Date.now()) {
      return { success: false, reason: "Token expired" };
    }

    await ctx.db.patch(tokenData._id, {
      used: true,
      usedBy: tokenData.instagramId,
    });

    return { success: true, instagramId: tokenData.instagramId };
  },
});

export const resetAuthTokenIfUnused = internalMutation({
  args: {
    token: v.string(),
    instagramId: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenData = await ctx.db
      .query("recipeAuthTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!tokenData) {
      return { success: false, reason: "Token not found" };
    }

    if (tokenData.used && tokenData.usedBy === args.instagramId) {
      await ctx.db.patch(tokenData._id, {
        used: false,
        usedBy: undefined,
      });
      return { success: true };
    }

    return { success: false, reason: "Token not eligible for reset" };
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

export const storeExternalAuthToken = internalMutation({
  args: {
    token: v.string(),
    instagramId: v.string(),
    instagramUsername: v.string(),
    recipeId: v.string(),
    firstName: v.optional(v.string()),
    accountId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("instagramUsers")
      .withIndex("by_instagram_id", (q) => q.eq("instagramId", args.instagramId))
      .first();

    if (!existingUser) {
      await ctx.db.insert("instagramUsers", {
        instagramId: args.instagramId,
        instagramUsername: args.instagramUsername,
        firstName: args.firstName,
        zernioAccountId: args.accountId,
        zernioConversationId: args.conversationId,
        onboardingSentAt: Date.now(),
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
      });
    } else {
      await ctx.db.patch(existingUser._id, {
        instagramUsername: args.instagramUsername,
        firstName: args.firstName ?? existingUser.firstName,
        zernioAccountId: args.accountId ?? existingUser.zernioAccountId,
        zernioConversationId: args.conversationId ?? existingUser.zernioConversationId,
        onboardingSentAt: existingUser.onboardingSentAt ?? Date.now(),
        lastSeenAt: Date.now(),
      });
    }

    await ctx.db.insert("recipeAuthTokens", {
      token: args.token,
      instagramId: args.instagramId,
      instagramUsername: args.instagramUsername,
      recipeId: args.recipeId,
      used: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    return { success: true };
  },
});

export const markOnboardingClaimed = internalMutation({
  args: {
    instagramId: v.string(),
  },
  handler: async (ctx, { instagramId }) => {
    const instagramUser = await ctx.db
      .query("instagramUsers")
      .withIndex("by_instagram_id", (q) => q.eq("instagramId", instagramId))
      .first();

    if (!instagramUser) {
      return { success: false, reason: "Instagram user not found" };
    }

    const claimedAt = Date.now();
    await ctx.db.patch(instagramUser._id, {
      onboardingClaimedAt: claimedAt,
      onboardingReminderSentAt: undefined,
      lastSeenAt: claimedAt,
    });

    return {
      success: true,
      accountId: instagramUser.zernioAccountId,
      conversationId: instagramUser.zernioConversationId,
      claimedAt,
    };
  },
});

export const markReelReceived = internalMutation({
  args: {
    instagramId: v.string(),
    accountId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, { instagramId, accountId, conversationId }) => {
    const instagramUser = await ctx.db
      .query("instagramUsers")
      .withIndex("by_instagram_id", (q) => q.eq("instagramId", instagramId))
      .first();

    if (!instagramUser) {
      return { success: false, reason: "Instagram user not found" };
    }

    await ctx.db.patch(instagramUser._id, {
      lastReelReceivedAt: Date.now(),
      lastSeenAt: Date.now(),
      zernioAccountId: accountId ?? instagramUser.zernioAccountId,
      zernioConversationId: conversationId ?? instagramUser.zernioConversationId,
    });

    return { success: true };
  },
});

export const getReminderStatus = internalQuery({
  args: {
    instagramId: v.string(),
  },
  handler: async (ctx, { instagramId }) => {
    const instagramUser = await ctx.db
      .query("instagramUsers")
      .withIndex("by_instagram_id", (q) => q.eq("instagramId", instagramId))
      .first();

    if (!instagramUser) {
      return null;
    }

    return {
      instagramId: instagramUser.instagramId,
      accountId: instagramUser.zernioAccountId,
      conversationId: instagramUser.zernioConversationId,
      onboardingClaimedAt: instagramUser.onboardingClaimedAt,
      lastReelReceivedAt: instagramUser.lastReelReceivedAt,
      onboardingReminderSentAt: instagramUser.onboardingReminderSentAt,
    };
  },
});

export const markReminderSent = internalMutation({
  args: {
    instagramId: v.string(),
  },
  handler: async (ctx, { instagramId }) => {
    const instagramUser = await ctx.db
      .query("instagramUsers")
      .withIndex("by_instagram_id", (q) => q.eq("instagramId", instagramId))
      .first();

    if (!instagramUser) {
      return { success: false, reason: "Instagram user not found" };
    }

    await ctx.db.patch(instagramUser._id, {
      onboardingReminderSentAt: Date.now(),
    });

    return { success: true };
  },
});

export const getWeeklyRecipeDeliveryCount = internalQuery({
  args: {
    instagramId: v.string(),
    since: v.number(),
  },
  handler: async (ctx, { instagramId, since }) => {
    const deliveries = await ctx.db
      .query("recipeDeliveries")
      .withIndex("by_instagram_id_and_delivered_at", (q) =>
        q.eq("instagramId", instagramId).gte("deliveredAt", since)
      )
      .collect();

    return deliveries.length;
  },
});

export const recordRecipeDelivery = internalMutation({
  args: {
    instagramId: v.string(),
    recipeId: v.string(),
  },
  handler: async (ctx, { instagramId, recipeId }) => {
    await ctx.db.insert("recipeDeliveries", {
      instagramId,
      recipeId,
      deliveredAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get onboarding status for a Clerk user
 * Returns whether to show the onboarding overlay (user has 0 delivered recipes)
 */
export const getOnboardingStatus = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, { clerkUserId }) => {
    // Find the linked Instagram user
    const instagramUser = await ctx.db
      .query("instagramUsers")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

    // If no linked Instagram user, they haven't completed the DM flow
    if (!instagramUser) {
      return {
        showOnboarding: false,
        reason: "no_linked_instagram",
      };
    }

    // Check if user has any delivered recipes (not just saved)
    const deliveredRecipe = await ctx.db
      .query("recipeDeliveries")
      .withIndex("by_instagram_id_and_delivered_at", (q) =>
        q.eq("instagramId", instagramUser.instagramId)
      )
      .first();

    const hasDeliveredRecipes = deliveredRecipe !== null;

    return {
      showOnboarding: !hasDeliveredRecipes,
      reason: hasDeliveredRecipes ? "has_delivered_recipes" : "no_delivered_recipes",
      instagramUsername: instagramUser.instagramUsername,
    };
  },
});

export const clearInstagramUserTestingData = mutation({
  args: {
    instagramId: v.string(),
  },
  handler: async (ctx, { instagramId }) => {
    const instagramUser = await ctx.db
      .query("instagramUsers")
      .withIndex("by_instagram_id", (q) => q.eq("instagramId", instagramId))
      .first();

    const recipeTokens = await ctx.db
      .query("recipeAuthTokens")
      .withIndex("by_instagram", (q) => q.eq("instagramId", instagramId))
      .collect();

    const deliveries = await ctx.db
      .query("recipeDeliveries")
      .withIndex("by_instagram_id_and_delivered_at", (q) => q.eq("instagramId", instagramId))
      .collect();

    for (const token of recipeTokens) {
      await ctx.db.delete(token._id);
    }

    for (const delivery of deliveries) {
      await ctx.db.delete(delivery._id);
    }

    if (instagramUser?.clerkUserId) {
      const userRecipes = await ctx.db
        .query("userRecipes")
        .withIndex("by_user", (q) => q.eq("userId", instagramUser.clerkUserId!))
        .collect();

      for (const recipe of userRecipes) {
        await ctx.db.delete(recipe._id);
      }
    }

    if (instagramUser) {
      await ctx.db.delete(instagramUser._id);
    }

    return {
      success: true,
      deletedInstagramUser: Boolean(instagramUser),
      deletedTokens: recipeTokens.length,
      deletedDeliveries: deliveries.length,
    };
  },
});

/**
 * Check if user should see the Instacart onboarding tip.
 * Shows on their 2nd recipe if they haven't seen it yet.
 */
export const getInstacartTipStatus = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, { clerkUserId }) => {
    const instagramUser = await ctx.db
      .query("instagramUsers")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

    if (!instagramUser) {
      return { showTip: false, reason: "no_linked_instagram" };
    }

    // Already seen the tip
    if (instagramUser.hasSeenInstacartTip) {
      return { showTip: false, reason: "already_seen" };
    }

    // Count their recipe deliveries
    const deliveries = await ctx.db
      .query("recipeDeliveries")
      .withIndex("by_instagram_id_and_delivered_at", (q) =>
        q.eq("instagramId", instagramUser.instagramId)
      )
      .collect();

    // Show tip on 2nd recipe (2+ deliveries)
    if (deliveries.length >= 2) {
      return { showTip: true, recipeCount: deliveries.length };
    }

    return { showTip: false, reason: "not_enough_recipes", recipeCount: deliveries.length };
  },
});

/**
 * Mark the Instacart tip as seen.
 */
export const markInstacartTipSeen = mutation({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, { clerkUserId }) => {
    const instagramUser = await ctx.db
      .query("instagramUsers")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

    if (!instagramUser) {
      return { success: false, reason: "no_linked_instagram" };
    }

    await ctx.db.patch(instagramUser._id, {
      hasSeenInstacartTip: true,
    });

    return { success: true };
  },
});

/**
 * Acquire a processing lock for a reel to prevent duplicate processing from webhook retries.
 * Returns true if lock acquired, false if already processing.
 */
export const acquireReelProcessingLock = internalMutation({
  args: {
    shortcode: v.string(),
    conversationId: v.string(),
  },
  handler: async (ctx, { shortcode, conversationId }) => {
    // Check if we're already processing this reel (within last 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const existingLock = await ctx.db
      .query("reelProcessingLocks")
      .withIndex("by_shortcode_conversation", (q) =>
        q.eq("shortcode", shortcode).eq("conversationId", conversationId)
      )
      .filter((q) => q.gte(q.field("startedAt"), fiveMinutesAgo))
      .first();

    if (existingLock) {
      // Already processing this reel, skip
      return { acquired: false, reason: "already_processing" };
    }

    // Acquire the lock
    await ctx.db.insert("reelProcessingLocks", {
      shortcode,
      conversationId,
      startedAt: Date.now(),
    });

    return { acquired: true };
  },
});

/**
 * Clean up old processing locks (older than 1 hour)
 */
export const cleanupOldProcessingLocks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    const oldLocks = await ctx.db
      .query("reelProcessingLocks")
      .withIndex("by_started_at")
      .filter((q) => q.lt(q.field("startedAt"), oneHourAgo))
      .collect();

    for (const lock of oldLocks) {
      await ctx.db.delete(lock._id);
    }

    return { deleted: oldLocks.length };
  },
});

/**
 * Clear user recipes by Clerk user ID (for testing)
 */
export const clearUserRecipes = mutation({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, { clerkUserId }) => {
    const userRecipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user", (q) => q.eq("userId", clerkUserId))
      .collect();

    for (const recipe of userRecipes) {
      await ctx.db.delete(recipe._id);
    }

    return { success: true, deleted: userRecipes.length };
  },
});

/**
 * List all Instagram users (for debugging)
 */
export const listAllInstagramUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("instagramUsers").collect();
    return users.map((u) => ({
      _id: u._id,
      instagramId: u.instagramId,
      instagramUsername: u.instagramUsername,
      clerkUserId: u.clerkUserId,
      createdAt: u.createdAt,
    }));
  },
});

/**
 * Reset a user for testing - deletes all their data including saved recipes
 */
export const resetInstagramUser = mutation({
  args: {
    instagramUsername: v.string(),
  },
  handler: async (ctx, { instagramUsername }) => {
    const deleted: Record<string, number> = {};

    // Find the Instagram user
    const instagramUser = await ctx.db
      .query("instagramUsers")
      .filter((q) => q.eq(q.field("instagramUsername"), instagramUsername))
      .first();

    if (!instagramUser) {
      return { success: false, reason: "user_not_found", deleted };
    }

    const instagramId = instagramUser.instagramId;
    const clerkUserId = instagramUser.clerkUserId;

    // Delete instagramUser
    await ctx.db.delete(instagramUser._id);
    deleted.instagramUsers = 1;

    // Delete recipeAuthTokens
    const authTokens = await ctx.db
      .query("recipeAuthTokens")
      .withIndex("by_instagram", (q) => q.eq("instagramId", instagramId))
      .collect();
    for (const token of authTokens) {
      await ctx.db.delete(token._id);
    }
    deleted.recipeAuthTokens = authTokens.length;

    // Delete recipeDeliveries
    const deliveries = await ctx.db
      .query("recipeDeliveries")
      .withIndex("by_instagram_id_and_delivered_at", (q) => q.eq("instagramId", instagramId))
      .collect();
    for (const delivery of deliveries) {
      await ctx.db.delete(delivery._id);
    }
    deleted.recipeDeliveries = deliveries.length;

    // Delete dmWebhookEvents
    const webhookEvents = await ctx.db
      .query("dmWebhookEvents")
      .withIndex("by_sender", (q) => q.eq("senderId", instagramId))
      .collect();
    for (const event of webhookEvents) {
      await ctx.db.delete(event._id);
    }
    deleted.dmWebhookEvents = webhookEvents.length;

    // Delete userRecipes if linked to Clerk
    if (clerkUserId) {
      const userRecipes = await ctx.db
        .query("userRecipes")
        .withIndex("by_user", (q) => q.eq("userId", clerkUserId))
        .collect();
      for (const recipe of userRecipes) {
        await ctx.db.delete(recipe._id);
      }
      deleted.userRecipes = userRecipes.length;
    }

    return { success: true, instagramId, clerkUserId, deleted };
  },
});

/**
 * Clean up orphaned data by Instagram ID (when instagramUser record is already deleted)
 */
export const cleanupByInstagramId = mutation({
  args: {
    instagramId: v.string(),
  },
  handler: async (ctx, { instagramId }) => {
    const deleted: Record<string, number> = {};

    // Delete recipeAuthTokens
    const authTokens = await ctx.db
      .query("recipeAuthTokens")
      .withIndex("by_instagram", (q) => q.eq("instagramId", instagramId))
      .collect();
    for (const token of authTokens) {
      await ctx.db.delete(token._id);
    }
    deleted.recipeAuthTokens = authTokens.length;

    // Delete recipeDeliveries
    const deliveries = await ctx.db
      .query("recipeDeliveries")
      .withIndex("by_instagram_id_and_delivered_at", (q) => q.eq("instagramId", instagramId))
      .collect();
    for (const delivery of deliveries) {
      await ctx.db.delete(delivery._id);
    }
    deleted.recipeDeliveries = deliveries.length;

    // Delete dmWebhookEvents
    const webhookEvents = await ctx.db
      .query("dmWebhookEvents")
      .withIndex("by_sender", (q) => q.eq("senderId", instagramId))
      .collect();
    for (const event of webhookEvents) {
      await ctx.db.delete(event._id);
    }
    deleted.dmWebhookEvents = webhookEvents.length;

    return { success: true, instagramId, deleted };
  },
});

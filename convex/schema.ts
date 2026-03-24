import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userRecipes: defineTable({
    userId: v.string(),
    recipeType: v.union(
      v.literal("extracted"),
      v.literal("community"),
      v.literal("custom"),
      v.literal("ai_generated")
    ),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    ingredients: v.optional(v.array(v.string())),
    instructions: v.optional(v.array(v.string())),
    servings: v.optional(v.string()),
    prep_time: v.optional(v.string()),
    cook_time: v.optional(v.string()),
    time_minutes: v.optional(v.number()),
    cuisine: v.optional(v.string()),
    diet: v.optional(v.string()),
    category: v.optional(v.string()),
    cookbookCategory: v.optional(v.string()),
    isFavorited: v.boolean(),
    muxPlaybackId: v.optional(v.string()),
    muxAssetId: v.optional(v.string()),
    instagramReelShortcode: v.optional(v.string()),
    extractedRecipeId: v.optional(v.id("extractedRecipes")),
    communityRecipeId: v.optional(v.id("recipes")),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Extra fields from existing data
    cachedImageUrl: v.optional(v.string()),
    cachedTitle: v.optional(v.string()),
    instagramUsername: v.optional(v.string()),
    instagramVideoUrl: v.optional(v.string()),
    parsedIngredients: v.optional(v.array(v.object({
      display_text: v.string(),
      name: v.string(),
      measurements: v.array(v.object({
        quantity: v.number(),
        unit: v.string(),
      })),
    }))),
    videoSegments: v.optional(v.array(v.object({
      stepNumber: v.number(),
      startTime: v.number(),
      endTime: v.number(),
      instruction: v.string(),
    }))),
    // Shared recipe fields
    sharedFromRecipeId: v.optional(v.string()),
    sharedFromUserId: v.optional(v.string()),
    lastAccessedAt: v.optional(v.number()),
    customRecipeData: v.optional(v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      ingredients: v.optional(v.array(v.string())),
      instructions: v.optional(v.array(v.string())),
      servings: v.optional(v.string()),
      prep_time: v.optional(v.string()),
      cook_time: v.optional(v.string()),
      cuisine: v.optional(v.string()),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_user_category", ["userId", "cookbookCategory"]),

  extractedRecipes: defineTable({
    instagramReelShortcode: v.string(),
    reelUrl: v.optional(v.string()),
    muxPlaybackId: v.optional(v.string()),
    muxAssetId: v.optional(v.string()),
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
    extractedAt: v.number(),
  }).index("by_shortcode", ["instagramReelShortcode"]),

  recipes: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    ingredients: v.array(v.string()),
    instructions: v.array(v.string()),
    createdAt: v.number(),
  }),

  dmWebhookEvents: defineTable({
    senderId: v.string(),
    senderName: v.optional(v.string()),
    messageText: v.optional(v.string()),
    reelUrl: v.optional(v.string()),
    reelShortcode: v.optional(v.string()),
    processed: v.boolean(),
    createdAt: v.number(),
  }).index("by_sender", ["senderId"]),

  connectedAccounts: defineTable({
    igUserId: v.string(),
    username: v.string(),
    accessToken: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_ig_user_id", ["igUserId"]),

  // Instagram DM auth tokens for magic link login
  recipeAuthTokens: defineTable({
    token: v.string(),
    instagramId: v.string(),
    instagramUsername: v.string(),
    recipeId: v.string(),
    used: v.boolean(),
    usedBy: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_instagram", ["instagramId"])
    .index("by_recipe", ["recipeId"]),

  // Instagram users (linked from DMs)
  instagramUsers: defineTable({
    instagramId: v.string(),
    instagramUsername: v.string(),
    firstName: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    email: v.optional(v.string()),
    zernioAccountId: v.optional(v.string()),
    zernioConversationId: v.optional(v.string()),
    onboardingClaimedAt: v.optional(v.number()),
    lastReelReceivedAt: v.optional(v.number()),
    onboardingReminderSentAt: v.optional(v.number()),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_instagram_id", ["instagramId"])
    .index("by_clerk_user", ["clerkUserId"]),

  recipeDeliveries: defineTable({
    instagramId: v.string(),
    recipeId: v.string(),
    deliveredAt: v.number(),
  }).index("by_instagram_id_and_delivered_at", ["instagramId", "deliveredAt"]),
});

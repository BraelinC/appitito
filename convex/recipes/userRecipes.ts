import { query, mutation } from "../_generated/server";
import { v } from "convex/values";

const COOKBOOK_CATEGORIES = [
  { id: "favorites", name: "Favorites" },
  { id: "breakfast", name: "Breakfast" },
  { id: "lunch",     name: "Lunch" },
  { id: "dinner",    name: "Dinner" },
  { id: "dessert",   name: "Dessert" },
  { id: "snacks",    name: "Snacks" },
];

// Debug: list all extracted recipes
export const listExtractedRecipes = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 10 }) => {
    const recipes = await ctx.db
      .query("extractedRecipes")
      .order("desc")
      .take(limit);
    return recipes.map((r) => ({
      _id: r._id,
      title: r.title,
      shortcode: r.instagramReelShortcode,
    }));
  },
});

export const getCookbookStats = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const all = await ctx.db
      .query("userRecipes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return COOKBOOK_CATEGORIES.map((cat) => {
      const recipes =
        cat.id === "favorites"
          ? all.filter((r) => r.isFavorited)
          : all.filter((r) => r.cookbookCategory === cat.id);

      const recipeImages = recipes
        .filter((r) => r.imageUrl)
        .slice(0, 4)
        .map((r) => r.imageUrl as string);

      return {
        id: cat.id,
        name: cat.name,
        recipeCount: recipes.length,
        recipeImages,
      };
    });
  },
});

export const getUserRecipeById = query({
  args: { recipeId: v.string() },
  handler: async (ctx, { recipeId }) => {
    const userRecipeId = ctx.db.normalizeId("userRecipes", recipeId);
    if (userRecipeId) {
      const userRecipe = await ctx.db.get(userRecipeId);
      if (userRecipe) {
        return userRecipe;
      }
    }

    const extractedRecipeId = ctx.db.normalizeId("extractedRecipes", recipeId);
    if (!extractedRecipeId) {
      return null;
    }

    const extractedRecipe = await ctx.db.get(extractedRecipeId);
    if (!extractedRecipe) {
      return null;
    }

    return {
      _id: extractedRecipe._id,
      userId: "anonymous",
      recipeType: "extracted" as const,
      title: extractedRecipe.title,
      description: extractedRecipe.description,
      imageUrl: extractedRecipe.imageUrl,
      muxPlaybackId: extractedRecipe.muxPlaybackId,
      muxAssetId: extractedRecipe.muxAssetId,
      ingredients: extractedRecipe.ingredients,
      instructions: extractedRecipe.instructions,
      servings: extractedRecipe.servings,
      prep_time: extractedRecipe.prep_time,
      cook_time: extractedRecipe.cook_time,
      cuisine: extractedRecipe.cuisine,
      diet: extractedRecipe.diet,
      isFavorited: false,
      instagramReelShortcode: extractedRecipe.instagramReelShortcode,
      reelUrl: extractedRecipe.reelUrl,
      extractedRecipeId: extractedRecipe._id,
      createdAt: extractedRecipe.extractedAt,
      updatedAt: extractedRecipe.extractedAt,
    };
  },
});

export const getUserRecipesByCookbook = query({
  args: { userId: v.string(), cookbookCategory: v.string() },
  handler: async (ctx, { userId, cookbookCategory }) => {
    const all = await ctx.db
      .query("userRecipes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (cookbookCategory === "favorites") {
      return all.filter((r) => r.isFavorited);
    }
    return all.filter((r) => r.cookbookCategory === cookbookCategory);
  },
});

export const saveRecipeToUserCookbook = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    ingredients: v.array(v.string()),
    instructions: v.array(v.string()),
    cookbookCategory: v.optional(v.string()),
    recipeType: v.union(
      v.literal("extracted"),
      v.literal("community"),
      v.literal("custom"),
      v.literal("ai_generated")
    ),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    servings: v.optional(v.string()),
    prep_time: v.optional(v.string()),
    cook_time: v.optional(v.string()),
    time_minutes: v.optional(v.number()),
    cuisine: v.optional(v.string()),
    diet: v.optional(v.string()),
    // Video fields
    muxPlaybackId: v.optional(v.string()),
    muxAssetId: v.optional(v.string()),
    reelUrl: v.optional(v.string()),
    instagramReelShortcode: v.optional(v.string()),
    extractedRecipeId: v.optional(v.id("extractedRecipes")),
    communityRecipeId: v.optional(v.id("recipes")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // If saving to favorites category, mark as favorited
    const isFavorited = args.cookbookCategory === "favorites";
    return await ctx.db.insert("userRecipes", {
      ...args,
      isFavorited,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const toggleRecipeFavorite = mutation({
  args: {
    userId: v.string(),
    userRecipeId: v.id("userRecipes"),
  },
  handler: async (ctx, { userId, userRecipeId }) => {
    const recipe = await ctx.db.get(userRecipeId);
    if (!recipe || recipe.userId !== userId) throw new Error("Recipe not found");
    await ctx.db.patch(userRecipeId, {
      isFavorited: !recipe.isFavorited,
      updatedAt: Date.now(),
    });
  },
});

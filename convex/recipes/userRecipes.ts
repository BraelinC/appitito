import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

const COOKBOOK_CATEGORIES = [
  { id: "favorites", name: "Favorites" },
  { id: "breakfast", name: "Breakfast" },
  { id: "lunch",     name: "Lunch" },
  { id: "dinner",    name: "Dinner" },
  { id: "dessert",   name: "Dessert" },
  { id: "snacks",    name: "Snacks" },
];

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
  args: { recipeId: v.id("userRecipes") },
  handler: async (ctx, { recipeId }) => {
    return await ctx.db.get(recipeId);
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
    instagramReelShortcode: v.optional(v.string()),
    extractedRecipeId: v.optional(v.id("extractedRecipes")),
    communityRecipeId: v.optional(v.id("recipes")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("userRecipes", {
      ...args,
      isFavorited: false,
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

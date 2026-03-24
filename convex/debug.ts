import { query } from "./_generated/server";

export const checkRecentRecipes = query({
  args: {},
  handler: async (ctx) => {
    const userRecipes = await ctx.db
      .query("userRecipes")
      .order("desc")
      .take(5);

    const extractedRecipes = await ctx.db
      .query("extractedRecipes")
      .order("desc")
      .take(5);

    return {
      userRecipes: userRecipes.map(r => ({
        id: r._id,
        title: r.title,
        recipeType: r.recipeType,
        muxPlaybackId: r.muxPlaybackId || null,
        muxAssetId: r.muxAssetId || null,
        reelUrl: r.reelUrl || null,
        instagramReelShortcode: r.instagramReelShortcode || null,
        extractedRecipeId: r.extractedRecipeId || null,
        createdAt: r.createdAt,
      })),
      extractedRecipes: extractedRecipes.map(r => ({
        id: r._id,
        title: r.title,
        muxPlaybackId: r.muxPlaybackId || null,
        muxAssetId: r.muxAssetId || null,
        reelUrl: r.reelUrl || null,
        instagramReelShortcode: r.instagramReelShortcode || null,
      })),
    };
  },
});

import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Fast recipe extraction from reel caption using Gemini
 * Returns recipe in ~2-3 seconds
 */
export const extractFromCaption = action({
  args: {
    caption: v.string(),
    reelId: v.string(),
    conversationId: v.string(),
    accountId: v.string(),
    senderName: v.string(),
  },
  handler: async (ctx, args) => {
    const { caption, reelId, conversationId, accountId, senderName } = args;
    
    console.log("[Recipe] Extracting from caption:", caption.slice(0, 100));
    
    const apiKey = process.env.OPEN_ROUTER_API_KEY;
    if (!apiKey) throw new Error("No OpenRouter API key");

    // Fast Gemini extraction
    const prompt = `You are a recipe extraction expert. Extract or generate a recipe from this Instagram reel caption.

CAPTION:
${caption}

Return ONLY valid JSON (no markdown):
{
  "dishName": "Name of the dish",
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "instructions": ["Step 1...", "Step 2...", ...],
  "prepTime": "10 mins",
  "cookTime": "20 mins",
  "servings": "4"
}

RULES:
- If caption has ingredients, use them
- If caption only has dish name, generate a standard recipe for that dish
- Keep instructions concise (1-2 sentences each)
- Max 10 ingredients, max 8 steps`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "{}";
    
    // Parse JSON from response
    let recipe;
    try {
      // Remove markdown code blocks if present
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      recipe = JSON.parse(jsonStr);
    } catch (e) {
      console.error("[Recipe] Failed to parse:", content);
      recipe = { dishName: "Recipe", ingredients: [], instructions: [] };
    }

    console.log("[Recipe] Extracted:", recipe.dishName);

    // Format reply message
    const firstName = senderName.split(" ")[0];
    const ingredientsList = recipe.ingredients.slice(0, 8).map((i: string) => `• ${i}`).join("\n");
    const instructionsList = recipe.instructions.slice(0, 5).map((s: string, i: number) => `${i + 1}. ${s}`).join("\n");

    const replyMessage = `🍽️ ${recipe.dishName}

📝 Ingredients:
${ingredientsList}

👨‍🍳 Quick Steps:
${instructionsList}

⏱️ ${recipe.prepTime || "15 mins"} prep | ${recipe.cookTime || "20 mins"} cook

Save the full recipe: 
👉 https://appitito.com/recipe/${reelId}`;

    // Send reply via Zernio
    const zernioKey = process.env.ZERNIO_API_KEY;
    if (zernioKey) {
      await fetch(
        `https://zernio.com/api/v1/inbox/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${zernioKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ accountId, message: replyMessage }),
        }
      );
      console.log("[Recipe] Reply sent!");
    }

    return recipe;
  },
});

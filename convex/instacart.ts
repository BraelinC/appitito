import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Instacart Integration
 *
 * Converts recipe ingredients to Instacart shopping cart via their Developer Platform API.
 * Uses OpenRouter LLM to intelligently parse ingredient strings into structured format.
 */

// Instacart API types
interface InstacartMeasurement {
  quantity: number;
  unit: string;
}

interface InstacartLineItem {
  name: string;
  display_text?: string;
  measurements?: InstacartMeasurement[];
}

interface InstacartRecipeRequest {
  title: string;
  image_url?: string;
  servings?: number;
  author?: string;
  content_creator_credit_info?: string;
  ingredients: InstacartLineItem[];
  landing_page_configuration?: {
    partner_linkback_url?: string;
    enable_pantry_items?: boolean;
  };
}

interface ParsedIngredient {
  name: string;
  quantity: number;
  unit: string;
  original: string;
}

// Valid Instacart units mapped from their API docs
const INSTACART_UNITS = [
  // Volume
  "cup", "tablespoon", "teaspoon", "fl oz", "gallon", "quart", "pint", "liter", "milliliter",
  // Weight
  "pound", "ounce", "gram", "kilogram",
  // Countable
  "each", "bunch", "can", "package", "head", "large", "medium", "small", "clove", "slice"
] as const;

/**
 * Parse a batch of ingredients using LLM with retry logic
 */
async function parseBatchWithLLM(ingredients: string[], apiKey: string, retryCount = 0): Promise<ParsedIngredient[]> {
  const MAX_RETRIES = 3;
  const prompt = `Parse these ingredients for grocery shopping. Convert to store-friendly amounts.

RULES:
- name: searchable product name
- quantity/unit: what you'd actually buy (e.g., "1 tsp salt" → 1 package, "3 cloves garlic" → 1 head)
- units: ${INSTACART_UNITS.slice(0, 15).join(", ")}

INGREDIENTS:
${ingredients.map((ing, i) => `${i + 1}. ${ing}`).join("\n")}

Return ONLY JSON array:
[{"name":"product","quantity":1,"unit":"each","original":"text"}]`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-safeguard-20b",
      messages: [
        { role: "system", content: "Return only valid JSON array. No explanation or thinking." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 5000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Instacart] LLM API error:", response.status, errorText);

    // Retry on rate limit (429) with exponential backoff
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log("[Instacart] Rate limited, retrying in", delay, "ms (attempt", retryCount + 1, "of", MAX_RETRIES, ")");
      await new Promise(r => setTimeout(r, delay));
      return parseBatchWithLLM(ingredients, apiKey, retryCount + 1);
    }

    // Final fallback after all retries exhausted - use basic parsing
    console.log("[Instacart] All retries failed, using basic fallback for batch");
    return ingredients.map((ing) => ({
      name: extractProductName(ing),
      quantity: 1,
      unit: "each",
      original: ing,
    }));
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "";
  const finishReason = result.choices?.[0]?.finish_reason;

  console.log("[Instacart] Batch finish_reason:", finishReason, "content_length:", content.length);

  // Retry on truncated/empty response
  if ((!content || content.trim() === "" || finishReason === "length") && retryCount < MAX_RETRIES) {
    const delay = Math.pow(2, retryCount) * 1000;
    console.log("[Instacart] Empty/truncated response, retrying in", delay, "ms");
    await new Promise(r => setTimeout(r, delay));
    return parseBatchWithLLM(ingredients, apiKey, retryCount + 1);
  }

  if (!content || content.trim() === "") {
    // Final fallback for empty content
    console.log("[Instacart] Empty content after retries, using basic fallback");
    return ingredients.map((ing) => ({
      name: extractProductName(ing),
      quantity: 1,
      unit: "each",
      original: ing,
    }));
  }

  // Extract JSON from response (strip thinking tags and markdown)
  let jsonStr = content
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  // If no JSON found after stripping, try to find JSON array in original content
  if (!jsonStr.startsWith("[")) {
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
  }

  console.log("[Instacart] JSON preview:", jsonStr.substring(0, 150));

  let parsed: ParsedIngredient[];
  try {
    parsed = JSON.parse(jsonStr) as ParsedIngredient[];
  } catch (parseErr) {
    console.error("[Instacart] JSON parse failed, using basic fallback:", parseErr);
    return ingredients.map((ing) => ({
      name: extractProductName(ing),
      quantity: 1,
      unit: "each",
      original: ing,
    }));
  }

  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
    console.log("[Instacart] Empty array from LLM, using basic fallback");
    return ingredients.map((ing) => ({
      name: extractProductName(ing),
      quantity: 1,
      unit: "each",
      original: ing,
    }));
  }

  // Validate and normalize
  return parsed.map((item) => ({
    ...item,
    name: item.name || "unknown",
    unit: normalizeUnit(item.unit || "each"),
    quantity: item.quantity > 0 ? item.quantity : 1,
  }));
}

/**
 * Parse ingredient strings using LLM into structured Instacart format
 * Batches ingredients to avoid truncation with longer lists
 */
async function parseIngredientsWithLLM(ingredients: string[]): Promise<ParsedIngredient[]> {
  console.log("[Instacart] v4 Parsing", ingredients.length, "ingredients with gpt-oss-safeguard-20b");

  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPEN_ROUTER_API_KEY is not configured");
  }

  // Batch ingredients - 7 per batch balances speed vs truncation risk
  const BATCH_SIZE = 7;
  const batches: string[][] = [];
  for (let i = 0; i < ingredients.length; i += BATCH_SIZE) {
    batches.push(ingredients.slice(i, i + BATCH_SIZE));
  }

  console.log("[Instacart] Processing", batches.length, "batches (5 concurrent)");

  // Run 5 batches at a time in parallel for max speed
  const CONCURRENCY = 5;
  const allParsed: ParsedIngredient[] = [];

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    console.log("[Instacart] Running batches", i + 1, "-", i + chunk.length, "of", batches.length);

    const promises = chunk.map((batch, j) => {
      console.log("[Instacart] Starting batch", i + j + 1, "(" + batch.length + " items)");
      return parseBatchWithLLM(batch, apiKey);
    });

    const results = await Promise.all(promises);
    allParsed.push(...results.flat());
  }

  console.log("[Instacart] Total parsed:", allParsed.length);
  return allParsed;
}

/**
 * Extract simple product name from ingredient string (fallback helper)
 */
function extractProductName(ingredient: string): string {
  // Remove quantities, measurements, and prep instructions
  return ingredient
    .replace(/^\d+[\d\/\s]*/, "")  // remove leading numbers/fractions
    .replace(/\([^)]*\)/g, "")     // remove parentheses
    .replace(/(cup|tbsp|tsp|tablespoon|teaspoon|oz|lb|pound|ounce|g|kg|ml|liter)s?\b/gi, "")
    .replace(/,.*$/, "")           // remove everything after comma
    .replace(/\s+/g, " ")
    .trim() || ingredient;
}

/**
 * Normalize unit strings to valid Instacart units
 */
function normalizeUnit(unit: string): string {
  const normalized = unit.toLowerCase().trim();

  // Direct matches
  if (INSTACART_UNITS.includes(normalized as typeof INSTACART_UNITS[number])) {
    return normalized;
  }

  // Common variations
  const unitMap: Record<string, string> = {
    "cups": "cup",
    "tbsp": "tablespoon",
    "tbs": "tablespoon",
    "tb": "tablespoon",
    "tablespoons": "tablespoon",
    "tsp": "teaspoon",
    "teaspoons": "teaspoon",
    "oz": "ounce",
    "ounces": "ounce",
    "lb": "pound",
    "lbs": "pound",
    "pounds": "pound",
    "g": "gram",
    "grams": "gram",
    "kg": "kilogram",
    "kilograms": "kilogram",
    "ml": "milliliter",
    "milliliters": "milliliter",
    "l": "liter",
    "liters": "liter",
    "qt": "quart",
    "quarts": "quart",
    "pt": "pint",
    "pints": "pint",
    "gal": "gallon",
    "gallons": "gallon",
    "cloves": "clove",
    "slices": "slice",
    "heads": "head",
    "bunches": "bunch",
    "cans": "can",
    "packages": "package",
    "pkg": "package",
    "piece": "each",
    "pieces": "each",
    "whole": "each",
    "item": "each",
    "items": "each",
    "lg": "large",
    "med": "medium",
    "sm": "small",
  };

  return unitMap[normalized] || "each";
}

/**
 * Create Instacart recipe shopping page
 */
async function createInstacartRecipePage(
  title: string,
  ingredients: ParsedIngredient[],
  imageUrl?: string,
  servings?: number
): Promise<string> {
  const apiKey = process.env.INSTACART_API_KEY;
  if (!apiKey) {
    throw new Error("INSTACART_API_KEY is not configured");
  }

  // Convert parsed ingredients to Instacart line items
  const lineItems: InstacartLineItem[] = ingredients.map((ing) => ({
    name: ing.name,
    display_text: ing.original,
    measurements: [
      {
        quantity: ing.quantity,
        unit: ing.unit,
      },
    ],
  }));

  const requestBody: InstacartRecipeRequest = {
    title,
    author: "Appitito",
    content_creator_credit_info: "Appitito",
    ingredients: lineItems,
    landing_page_configuration: {
      partner_linkback_url: "https://appitito.com",
      enable_pantry_items: true,
    },
  };

  if (imageUrl) {
    requestBody.image_url = imageUrl;
  }

  if (servings && servings > 0) {
    requestBody.servings = servings;
  }

  console.log("[Instacart] Creating recipe page:", title, "with", lineItems.length, "ingredients");

  // Use development URL for now - switch to production when ready
  const baseUrl = process.env.INSTACART_API_ENV === "production"
    ? "https://connect.instacart.com"
    : "https://connect.dev.instacart.tools";

  const response = await fetch(`${baseUrl}/idp/v1/products/recipe`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Instacart] API error:", response.status, errorText);
    throw new Error(`Instacart API error: ${response.status}`);
  }

  const result = await response.json() as { products_link_url?: string };

  if (!result.products_link_url) {
    throw new Error("Instacart API did not return a shopping link");
  }

  console.log("[Instacart] Recipe page created:", result.products_link_url);
  return result.products_link_url;
}

/**
 * Main action: Create Instacart shopping cart from recipe
 */
export const createShoppingCart = action({
  args: {
    recipeTitle: v.string(),
    ingredients: v.array(v.string()),
    imageUrl: v.optional(v.string()),
    servings: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const { recipeTitle, ingredients, imageUrl, servings } = args;

    if (ingredients.length === 0) {
      throw new Error("No ingredients provided");
    }

    console.log("[Instacart] v4 Processing", ingredients.length, "ingredients for:", recipeTitle);

    // Step 1: Parse ingredients with LLM
    const parsedIngredients = await parseIngredientsWithLLM(ingredients);
    console.log("[Instacart] Parsed ingredients:", parsedIngredients.length);

    // Step 2: Create Instacart recipe page
    const shoppingUrl = await createInstacartRecipePage(
      recipeTitle,
      parsedIngredients,
      imageUrl,
      servings
    );

    return {
      success: true,
      shoppingUrl,
      parsedIngredients: parsedIngredients.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
      })),
    };
  },
});

/**
 * Preview parsed ingredients without creating cart (for debugging/UI preview)
 */
export const previewParsedIngredients = action({
  args: {
    ingredients: v.array(v.string()),
  },
  handler: async (_ctx, args) => {
    const parsedIngredients = await parseIngredientsWithLLM(args.ingredients);

    return {
      success: true,
      parsed: parsedIngredients,
    };
  },
});

/**
 * Benchmark different LLM models for ingredient parsing accuracy
 */
export const benchmarkModels = action({
  args: {},
  handler: async () => {
    const apiKey = process.env.OPEN_ROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPEN_ROUTER_API_KEY not configured");
    }

    // Tricky test ingredients that test various parsing challenges
    const testIngredients = [
      "2 cups all-purpose flour",           // basic
      "1/2 tsp kosher salt",                // fraction + specific type
      "3 cloves garlic, minced",            // should convert to 1 head
      "1 (14.5 oz) can diced tomatoes",     // canned goods with size
      "2 large eggs, beaten",               // countable with prep instruction
      "1/4 cup extra virgin olive oil",     // small amount of staple
      "1 lb boneless skinless chicken breast", // protein with descriptors
      "freshly ground black pepper to taste",  // no quantity
      "1 medium yellow onion, diced",       // size descriptor
      "2 tbsp fresh lemon juice",           // abbreviation + fresh
    ];

    // Expected correct parsing (for scoring)
    const expectedResults = [
      { name: "all-purpose flour", quantity: 2, unit: "cup" },
      { name: "kosher salt", quantity: 1, unit: "package" },  // store-smart
      { name: "garlic", quantity: 1, unit: "head" },          // store-smart
      { name: "diced tomatoes", quantity: 1, unit: "can" },
      { name: "eggs", quantity: 6, unit: "each" },            // store-smart (half dozen)
      { name: "extra virgin olive oil", quantity: 1, unit: "each" }, // store-smart (bottle)
      { name: "chicken breast", quantity: 1, unit: "pound" },
      { name: "black pepper", quantity: 1, unit: "each" },    // store-smart
      { name: "yellow onion", quantity: 1, unit: "each" },
      { name: "lemon", quantity: 1, unit: "each" },           // or lemon juice
    ];

    // Models to test
    const models = [
      "google/gemini-3.1-flash-lite-preview",
      "qwen/qwen3.5-flash-02-23",
      "openai/gpt-oss-safeguard-20b",
    ];

    const prompt = `Parse these recipe ingredients into structured data for grocery shopping on Instacart.

TASK: Convert each ingredient into what someone would actually BUY at the store.

RULES:
1. name: The searchable product name (e.g., "all-purpose flour", "boneless skinless chicken breast")
2. quantity & unit: Convert to STORE-FRIENDLY amounts:
   - Small amounts of staples → minimum practical purchase (1 package/bottle)
   - "3 cloves garlic" → 1 head (garlic sold as heads)
   - "2 eggs" → 6 each (half dozen minimum)
   - Produce → round to whole items
3. unit: Use these valid units: cup, tablespoon, teaspoon, pound, ounce, each, can, package, head, bunch, large, medium, small, clove

INGREDIENTS:
${testIngredients.map((ing, i) => `${i + 1}. ${ing}`).join("\n")}

Return ONLY valid JSON array (no markdown):
[{"name": "product name", "quantity": 1, "unit": "each", "original": "original text"}, ...]`;

    const results: Array<{
      model: string;
      success: boolean;
      parseTime: number;
      parsed: ParsedIngredient[] | null;
      score: number;
      errors: string[];
    }> = [];

    for (const model of models) {
      const startTime = Date.now();
      const errors: string[] = [];
      let parsed: ParsedIngredient[] | null = null;
      let score = 0;

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            max_tokens: 2000,
          }),
        });

        const parseTime = Date.now() - startTime;

        if (!response.ok) {
          errors.push(`API error: ${response.status}`);
          results.push({ model, success: false, parseTime, parsed: null, score: 0, errors });
          continue;
        }

        const result = await response.json();
        const content = result.choices?.[0]?.message?.content || "";

        // Try to parse JSON
        const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(jsonStr) as ParsedIngredient[];

        // Score the results
        if (parsed.length !== testIngredients.length) {
          errors.push(`Wrong count: got ${parsed.length}, expected ${testIngredients.length}`);
        }

        // Check each ingredient
        for (let i = 0; i < Math.min(parsed.length, expectedResults.length); i++) {
          const got = parsed[i];
          const expected = expectedResults[i];

          // Name contains key terms (+2 points)
          const expectedNameParts = expected.name.toLowerCase().split(" ");
          const gotName = got.name.toLowerCase();
          if (expectedNameParts.some(part => gotName.includes(part))) {
            score += 2;
          } else {
            errors.push(`#${i + 1} name mismatch: "${got.name}" vs "${expected.name}"`);
          }

          // Valid unit (+1 point)
          if (INSTACART_UNITS.includes(got.unit as typeof INSTACART_UNITS[number]) ||
              ["package", "bottle", "container"].includes(got.unit)) {
            score += 1;
          } else {
            errors.push(`#${i + 1} invalid unit: "${got.unit}"`);
          }

          // Quantity is positive number (+1 point)
          if (typeof got.quantity === "number" && got.quantity > 0) {
            score += 1;
          } else {
            errors.push(`#${i + 1} invalid quantity: ${got.quantity}`);
          }
        }

        results.push({
          model,
          success: true,
          parseTime,
          parsed,
          score,
          errors: errors.slice(0, 5), // limit errors shown
        });

      } catch (err) {
        errors.push(`Parse error: ${err instanceof Error ? err.message : "unknown"}`);
        results.push({
          model,
          success: false,
          parseTime: Date.now() - startTime,
          parsed: null,
          score: 0,
          errors,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    const maxScore = testIngredients.length * 4; // 4 points per ingredient max

    return {
      testIngredients,
      maxPossibleScore: maxScore,
      results: results.map(r => ({
        model: r.model,
        score: r.score,
        percentage: Math.round((r.score / maxScore) * 100),
        parseTimeMs: r.parseTime,
        success: r.success,
        errors: r.errors,
      })),
      winner: results[0]?.model,
      recommendation: results[0]?.score >= maxScore * 0.8
        ? `${results[0]?.model} is recommended (${Math.round((results[0]?.score / maxScore) * 100)}% accuracy)`
        : "Consider fine-tuning the prompt for better accuracy",
    };
  },
});

/**
 * Test Instacart API connection
 */
export const testInstacartConnection = action({
  args: {},
  handler: async () => {
    const apiKey = process.env.INSTACART_API_KEY;
    const openRouterKey = process.env.OPEN_ROUTER_API_KEY;

    const diagnostics = {
      instacartKeyPresent: !!apiKey,
      instacartKeyPrefix: apiKey ? apiKey.substring(0, 10) + "..." : null,
      openRouterKeyPresent: !!openRouterKey,
      timestamp: new Date().toISOString(),
    };

    if (!apiKey) {
      return {
        success: false,
        error: "INSTACART_API_KEY not configured in Convex environment",
        diagnostics,
      };
    }

    // Test with a simple recipe
    const testIngredients = [
      "2 cups all-purpose flour",
      "1 cup sugar",
      "2 large eggs",
      "1/2 cup butter",
    ];

    try {
      // Test LLM parsing first
      let parsedIngredients;
      if (openRouterKey) {
        parsedIngredients = await parseIngredientsWithLLM(testIngredients);
        console.log("[Instacart Test] Parsed ingredients:", parsedIngredients);
      } else {
        // Fallback without LLM
        parsedIngredients = testIngredients.map((ing) => ({
          name: ing,
          quantity: 1,
          unit: "each" as const,
          original: ing,
        }));
      }

      // Test Instacart API
      const baseUrl = process.env.INSTACART_API_ENV === "production"
        ? "https://connect.instacart.com"
        : "https://connect.dev.instacart.tools";

      const lineItems = parsedIngredients.map((ing) => ({
        name: ing.name,
        display_text: ing.original,
        measurements: [{ quantity: ing.quantity, unit: ing.unit }],
      }));

      const response = await fetch(`${baseUrl}/idp/v1/products/recipe`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          title: "Appitito Test Recipe",
          ingredients: lineItems,
          landing_page_configuration: {
            partner_linkback_url: "https://appitito.com",
            enable_pantry_items: true,
          },
        }),
      });

      const responseText = await response.text();
      console.log("[Instacart Test] Response status:", response.status);
      console.log("[Instacart Test] Response:", responseText);

      if (!response.ok) {
        return {
          success: false,
          error: `Instacart API returned ${response.status}`,
          apiResponse: responseText,
          diagnostics,
          parsedIngredients,
        };
      }

      const result = JSON.parse(responseText);
      return {
        success: true,
        shoppingUrl: result.products_link_url,
        diagnostics,
        parsedIngredients,
        message: "Instacart integration working! Test shopping cart created.",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        diagnostics,
      };
    }
  },
});

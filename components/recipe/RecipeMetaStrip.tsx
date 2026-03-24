"use client";

import { Clock, Users, Globe, Leaf, Utensils } from "lucide-react";
import { ReactNode } from "react";

interface RecipeMetaStripProps {
  totalTime: string | null;
  servings?: string;
  cuisine?: string;
  diet?: string;
}

/**
 * Horizontal strip showing recipe metadata (time, servings, cuisine, diet).
 */
export function RecipeMetaStrip({ totalTime, servings, cuisine, diet }: RecipeMetaStripProps) {
  const hasContent = totalTime || servings || cuisine || diet;

  if (!hasContent) return null;

  // Extract just the number from servings like "18-20 mini tacos" → "18-20"
  const simplifiedServings = servings ? simplifyServings(servings) : null;

  // Choose diet icon based on content
  const dietIcon = diet && isVegetarian(diet)
    ? <Leaf size={13} />
    : <Utensils size={13} />;

  return (
    <div
      className="flex items-center justify-between mb-5 p-4 rounded-2xl border"
      style={{
        backgroundColor: "var(--panel)",
        borderColor: "var(--line)",
      }}
    >
      {totalTime && (
        <MetaChip icon={<Clock size={13} />} label={totalTime} align="left" />
      )}
      {simplifiedServings && (
        <MetaChip icon={<Users size={13} />} label={simplifiedServings} align="center" />
      )}
      {cuisine && (
        <MetaChip icon={<Globe size={13} />} label={cuisine} align="right" />
      )}
      {diet && (
        <MetaChip icon={dietIcon} label={diet} align="right" />
      )}
    </div>
  );
}

/**
 * Simplify servings to just show the number portion.
 * "18-20 mini tacos" → "18-20"
 * "4 servings" → "4"
 * "6" → "6"
 */
function simplifyServings(servings: string): string {
  // Try to extract number or range at the start
  const match = servings.match(/^(\d+(?:\s*-\s*\d+)?)/);
  if (match) {
    return match[1].replace(/\s+/g, "");
  }
  // If no number found, return as-is but truncated
  return servings.length > 8 ? servings.slice(0, 8) : servings;
}

/**
 * Check if diet is vegetarian/vegan for icon selection.
 */
function isVegetarian(diet: string): boolean {
  const lower = diet.toLowerCase();
  return lower.includes("vegetarian") || lower.includes("vegan") || lower.includes("plant");
}

// ── Helper ────────────────────────────────────────────────────

function MetaChip({
  icon,
  label,
  align = "left",
}: {
  icon: ReactNode;
  label: string;
  align?: "left" | "center" | "right";
}) {
  const justifyClass = 
    align === "center" ? "justify-center" : 
    align === "right" ? "justify-end" : 
    "justify-start";

  return (
    <div className={`flex items-center gap-1.5 ${justifyClass}`}>
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      <span className="text-xs font-medium" style={{ color: "var(--ink-secondary)" }}>
        {label}
      </span>
    </div>
  );
}

"use client";

import { Clock, Users, Globe, ChefHat } from "lucide-react";
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
      {servings && (
        <MetaChip icon={<Users size={13} />} label={`Serves ${servings}`} align="center" />
      )}
      {cuisine && (
        <MetaChip icon={<Globe size={13} />} label={cuisine} align="right" />
      )}
      {diet && (
        <MetaChip icon={<ChefHat size={13} />} label={diet} align="right" />
      )}
    </div>
  );
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

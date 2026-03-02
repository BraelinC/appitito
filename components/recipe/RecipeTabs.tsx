"use client";

import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

interface RecipeTabsProps {
  ingredients: string[];
  instructions: string[];
}

/**
 * Tabbed view for ingredients and instructions.
 * Instructions have step completion tracking.
 */
export function RecipeTabs({ ingredients, instructions }: RecipeTabsProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  function toggleStep(idx: number) {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  return (
    <Tabs.Root defaultValue="ingredients">
      {/* Tab buttons */}
      <Tabs.List
        className="flex rounded-xl p-1 mb-5 border"
        style={{
          backgroundColor: "var(--cream-warm)",
          borderColor: "var(--line)",
        }}
      >
        <Tabs.Trigger
          value="ingredients"
          className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all outline-none"
          style={{ color: "var(--ink-secondary)" }}
        >
          Ingredients
        </Tabs.Trigger>
        <Tabs.Trigger
          value="instructions"
          className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all outline-none"
          style={{ color: "var(--ink-secondary)" }}
        >
          Instructions
        </Tabs.Trigger>
      </Tabs.List>

      {/* Ingredients tab */}
      <Tabs.Content value="ingredients" className="pb-12">
        {ingredients.length === 0 ? (
          <EmptyState icon="🥄" title="No ingredients listed" />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {ingredients.map((ing, i) => (
              <li
                key={i}
                className="flex items-start gap-3 p-3.5 rounded-xl border"
                style={{
                  backgroundColor: "var(--panel)",
                  borderColor: "var(--line)",
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "#fff",
                  }}
                >
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
                  {ing}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tabs.Content>

      {/* Instructions tab */}
      <Tabs.Content value="instructions" className="pb-12">
        {instructions.length === 0 ? (
          <EmptyState icon="🥄" title="No instructions listed" />
        ) : (
          <>
            <ol className="flex flex-col gap-3">
              {instructions.map((step, i) => {
                const done = completedSteps.has(i);
                return (
                  <li
                    key={i}
                    onClick={() => toggleStep(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleStep(i);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={done}
                    aria-label={`Step ${i + 1}: ${step.slice(0, 50)}${step.length > 50 ? "..." : ""}`}
                    className="flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[var(--accent)] outline-none"
                    style={{
                      backgroundColor: done ? "var(--sage-soft)" : "var(--panel)",
                      borderColor: done ? "var(--sage)" : "var(--line)",
                      opacity: done ? 0.75 : 1,
                    }}
                  >
                    {/* Step number / check */}
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 transition-colors"
                      style={{
                        backgroundColor: done ? "var(--sage)" : "var(--accent)",
                        color: "#fff",
                      }}
                    >
                      {done ? <CheckCircle2 size={14} /> : i + 1}
                    </span>

                    <p
                      className="text-sm leading-relaxed flex-1"
                      style={{
                        color: done ? "var(--sage-deep)" : "var(--ink)",
                        textDecoration: done ? "line-through" : "none",
                      }}
                    >
                      {step}
                    </p>
                  </li>
                );
              })}
            </ol>

            {/* Progress bar */}
            <ProgressBar completed={completedSteps.size} total={instructions.length} />
          </>
        )}
      </Tabs.Content>
    </Tabs.Root>
  );
}

// ── Helper ────────────────────────────────────────────────────

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  if (total === 0) return null;
  
  const percentage = (completed / total) * 100;

  return (
    <div 
      className="mt-5 p-4 rounded-2xl border text-center" 
      style={{ borderColor: "var(--line)", backgroundColor: "var(--panel)" }}
    >
      <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
        {completed} of {total} steps complete
      </p>
      <div 
        className="mt-2 h-2 rounded-full overflow-hidden" 
        style={{ backgroundColor: "var(--cream-warm)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            backgroundColor: "var(--sage)",
          }}
        />
      </div>
    </div>
  );
}

"use client";

import { X } from "lucide-react";

interface InstacartTipProps {
  /** Which state of the tip to show */
  stage: "hold" | "cart";
  /** Called when user dismisses the tip */
  onDismiss: () => void;
}

/**
 * Tooltip bubble for Instacart onboarding.
 * Rendered inline within the action cluster for proper positioning.
 */
export function InstacartTipBubble({ stage, onDismiss }: InstacartTipProps) {
  return (
    <div
      className="absolute z-50 pointer-events-auto"
      style={{
        // Position based on stage
        ...(stage === "hold"
          ? {
              // Position to the left of the bookmark button
              right: "100%",
              top: "50%",
              transform: "translateY(-50%)",
              marginRight: 12,
            }
          : {
              // Position above the cart button (which is at bottom of triangle)
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              marginBottom: 12,
            }),
      }}
    >
      {/* Tooltip card */}
      <div
        className="relative rounded-2xl px-4 py-3 shadow-lg whitespace-nowrap"
        style={{
          backgroundColor: "var(--accent)",
          color: "white",
        }}
      >
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white/30 flex items-center justify-center hover:bg-white/40 transition-colors"
        >
          <X size={12} />
        </button>

        {/* Content */}
        <p className="font-semibold text-sm pr-4">
          {stage === "hold" ? "Hold this down" : "Shop with Instacart"}
        </p>
        {stage === "cart" && (
          <p className="text-xs opacity-80 mt-0.5">Tap to add ingredients</p>
        )}
      </div>

      {/* Arrow pointing to the button */}
      <div
        className="absolute w-0 h-0"
        style={{
          ...(stage === "hold"
            ? {
                // Arrow pointing right (to bookmark)
                right: -8,
                top: "50%",
                transform: "translateY(-50%)",
                borderTop: "8px solid transparent",
                borderBottom: "8px solid transparent",
                borderLeft: "8px solid var(--accent)",
              }
            : {
                // Arrow pointing down (to cart)
                bottom: -8,
                left: "50%",
                transform: "translateX(-50%)",
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderTop: "8px solid var(--accent)",
              }),
        }}
      />
    </div>
  );
}

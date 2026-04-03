"use client";

interface InstacartTipProps {
  /** Which state of the tip to show - now only supports "cart" */
  stage: "cart";
  /** Called when user dismisses the tip */
  onDismiss: () => void;
}

/**
 * Tooltip bubble for Instacart onboarding.
 * Simplified to only show cart tip (removed hold stage).
 * Parent component handles absolute positioning.
 */
export function InstacartTipBubble({ stage, onDismiss }: InstacartTipProps) {
  return (
    <div className="relative">
      {/* Tooltip card */}
      <div
        className="rounded-2xl px-4 py-3 shadow-lg whitespace-nowrap"
        style={{
          backgroundColor: "var(--accent)",
          color: "white",
        }}
      >
        <p className="font-semibold text-sm">Shop with Instacart</p>
        <p className="text-xs opacity-80 mt-0.5">Tap to add ingredients</p>
      </div>

      {/* Arrow pointing down */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
        style={{
          top: "100%",
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: "8px solid var(--accent)",
        }}
      />
    </div>
  );
}

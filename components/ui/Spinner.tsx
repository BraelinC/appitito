"use client";

interface SpinnerProps {
  /** Size in pixels (default: 24) */
  size?: number;
  /** Color CSS value (default: var(--accent)) */
  color?: string;
}

/**
 * Animated loading spinner.
 * Uses CSS animation for smooth rotation.
 */
export function Spinner({ size = 24, color = "var(--accent)" }: SpinnerProps) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Loading"
    >
      {/* Background circle */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
        strokeOpacity="0.3"
      />
      {/* Animated arc */}
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Skeleton loading placeholders for different UI patterns
 */

interface SkeletonProps {
  /** The type of skeleton to render */
  variant: "card" | "listItem" | "hero" | "text";
  /** Optional custom className */
  className?: string;
}

export function Skeleton({ variant, className = "" }: SkeletonProps) {
  const baseClass = "animate-pulse";
  const bgStyle = { backgroundColor: "var(--cream-warm)" };

  switch (variant) {
    case "card":
      return (
        <div
          className={`${baseClass} rounded-3xl ${className}`}
          style={{ ...bgStyle, aspectRatio: "1 / 1" }}
        />
      );

    case "listItem":
      return (
        <div
          className={`${baseClass} h-20 rounded-2xl ${className}`}
          style={bgStyle}
        />
      );

    case "hero":
      return (
        <div
          className={`${baseClass} w-full h-56 rounded-3xl ${className}`}
          style={bgStyle}
        />
      );

    case "text":
      return (
        <div
          className={`${baseClass} h-4 rounded-xl ${className}`}
          style={bgStyle}
        />
      );

    default:
      return null;
  }
}

/**
 * Multiple skeletons in a grid pattern (for cookbook grid)
 */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="card" />
      ))}
    </>
  );
}

/**
 * Multiple skeletons in a list pattern (for recipe list)
 */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="listItem" />
      ))}
    </div>
  );
}

import { ReactNode } from "react";

interface EmptyStateProps {
  /** Icon to display (React node, e.g. Lucide icon or emoji) */
  icon: ReactNode;
  /** Main title text */
  title: string;
  /** Optional description text */
  description?: string;
}

/**
 * Empty state placeholder for when there's no content to show
 */
export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
        style={{ backgroundColor: "var(--cream-warm)" }}
      >
        <span style={{ color: "var(--ink-muted)" }}>{icon}</span>
      </div>
      <p
        className="font-display text-lg font-semibold"
        style={{ color: "var(--ink)" }}
      >
        {title}
      </p>
      {description && (
        <p
          className="text-sm text-center max-w-[220px] leading-relaxed"
          style={{ color: "var(--ink-secondary)" }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

"use client";

import { BookmarkPlus, ShoppingCart, Loader2 } from "lucide-react";
import { InstacartTipBubble } from "./InstacartTip";

interface RecipeActionButtonsProps {
  isSaved: boolean;
  onSave: () => void;
  onCart: () => void;
  cartLoading?: boolean;
  children?: React.ReactNode;
  side?: "left" | "right";
  showInstacartTip?: boolean;
  onDismissTip?: () => void;
}

/**
 * Simple action buttons for recipe pages.
 * Displays bookmark and shopping cart buttons side-by-side with optional description.
 */
export function RecipeActionButtons({
  isSaved,
  onSave,
  onCart,
  cartLoading = false,
  children,
  side = "left",
  showInstacartTip = false,
  onDismissTip,
}: RecipeActionButtonsProps) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${side === "right" ? "flex-row-reverse" : ""}`}>
      {/* Buttons container */}
      <div className="flex gap-2 shrink-0">
        {/* Bookmark button */}
        <button
          onClick={onSave}
          className="flex h-12 w-12 items-center justify-center rounded-full border shadow-[0_10px_24px_var(--shadow-warm)] transition-colors hover:opacity-80 active:scale-95"
          style={{
            borderColor: isSaved ? "var(--accent)" : "var(--ink)",
            backgroundColor: isSaved ? "var(--accent)" : "var(--cream)",
          }}
          title={isSaved ? "Manage cookbook" : "Save to favorites"}
          aria-pressed={isSaved}
          aria-label={isSaved ? "Manage cookbook" : "Save to favorites"}
        >
          <BookmarkPlus
            size={20}
            style={{ color: isSaved ? "#fff" : "var(--ink)" }}
          />
        </button>

        {/* Cart button with tip */}
        <div className="relative">
          <button
            onClick={onCart}
            disabled={cartLoading}
            className="flex h-12 w-12 items-center justify-center rounded-full border shadow-[0_10px_24px_var(--shadow-warm)] transition-colors hover:opacity-80 active:scale-95 disabled:opacity-60"
            style={{
              borderColor: "var(--ink)",
              backgroundColor: "var(--cream)",
            }}
            title="Shop with Instacart"
            aria-label="Shop with Instacart"
            aria-disabled={cartLoading}
          >
            {cartLoading ? (
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--ink)" }} />
            ) : (
              <ShoppingCart size={20} style={{ color: "var(--ink)" }} />
            )}
          </button>

          {/* Instacart tip - simplified */}
          {showInstacartTip && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-auto">
              <InstacartTipBubble stage="cart" onDismiss={onDismissTip || (() => {})} />
            </div>
          )}
        </div>
      </div>

      <div className="w-px self-stretch" style={{ backgroundColor: "var(--line)" }} />

      <div className="min-w-0 flex-1 py-1">
        {children}
      </div>
    </div>
  );
}

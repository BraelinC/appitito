"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { ShoppingCart, X } from "lucide-react";

/**
 * Onboarding tooltip that appears after user's 2nd recipe.
 * Points to the action cluster to highlight Instacart integration.
 */
export function InstacartTip() {
  const { user } = useUser();
  const [dismissed, setDismissed] = useState(false);

  const tipStatus = useQuery(
    api.instagramAuth.getInstacartTipStatus,
    user?.id ? { clerkUserId: user.id } : "skip"
  );

  const markSeen = useMutation(api.instagramAuth.markInstacartTipSeen);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (tipStatus?.showTip && !dismissed) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [tipStatus?.showTip, dismissed]);

  async function handleDismiss() {
    setDismissed(true);
    if (user?.id) {
      await markSeen({ clerkUserId: user.id });
    }
  }

  if (!tipStatus?.showTip || dismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop - subtle dim */}
      <div
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={handleDismiss}
      />

      {/* Tooltip container - positioned near the action cluster */}
      <div className="absolute top-[72svh] left-1/2 -translate-x-1/2 pointer-events-auto">
        {/* Arrow pointing up to the action cluster */}
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0"
          style={{
            borderLeft: "12px solid transparent",
            borderRight: "12px solid transparent",
            borderBottom: "12px solid var(--accent)",
          }}
        />

        {/* Tooltip card */}
        <div
          className="relative rounded-2xl px-5 py-4 shadow-lg max-w-[280px]"
          style={{
            backgroundColor: "var(--accent)",
            color: "white",
          }}
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>

          {/* Content */}
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <ShoppingCart size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">
                Add to Instacart
              </p>
              <p className="text-xs opacity-90 leading-relaxed">
                Hold the bookmark to add ingredients directly to your Instacart cart
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

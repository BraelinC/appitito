"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Circle, X } from "lucide-react";
import { useAction, useQuery } from "convex/react";
import { useClerk, useUser } from "@clerk/nextjs";

import { api } from "@/convex/_generated/api";

const BILLING_INTENT_KEY = "appitito_pending_billing";

type BillingInterval = "yearly" | "monthly";

const plans: Array<{
  id: BillingInterval;
  title: string;
  price: string;
  subtitle: string;
  badge?: string;
  struck?: string;
}> = [
  {
    id: "yearly",
    title: "Yearly",
    price: "$35/year",
    struck: "$70/year",
    subtitle: "Best value for consistent cooks",
    badge: "For You 50% OFF",
  },
  {
    id: "monthly",
    title: "Monthly",
    price: "$6/month",
    subtitle: "Cancel anytime",
  },
];

export function BillingModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [selectedPlan, setSelectedPlan] = useState<BillingInterval>("yearly");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const billingState = useQuery(api.stripe.getBillingState, {});
  const createPortal = useAction(api.stripe.createBillingPortalSession);

  const selected = useMemo(
    () => plans.find((plan) => plan.id === selectedPlan) ?? plans[0],
    [selectedPlan]
  );

  async function startCheckout() {
    console.log("[Billing Debug][modal] startCheckout", {
      isLoaded,
      isSignedIn,
      hasSubscription: billingState?.hasSubscription,
      selectedPlan,
    });

    if (billingState?.hasSubscription) {
      const result = await createPortal({});
      window.location.assign(result.url);
      return;
    }

    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval: selectedPlan }),
    });
    const result = await response.json() as { url?: string; error?: string };
    if (!response.ok) {
      throw new Error(result.error ?? "Failed to create checkout session");
    }
    if (result.url) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(BILLING_INTENT_KEY);
      }
      window.location.assign(result.url);
    }
  }

  useEffect(() => {
    if (!open || !isLoaded || !isSignedIn || billingState === undefined) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const pending = window.sessionStorage.getItem(BILLING_INTENT_KEY);
    if (!pending) {
      return;
    }

    console.log("[Billing Debug][modal] resuming pending billing intent", pending);

    const parsed = JSON.parse(pending) as { interval?: BillingInterval };
    if (parsed.interval) {
      setSelectedPlan(parsed.interval);
    }

    void (async () => {
      setIsSubmitting(true);
      try {
        await startCheckout();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setDebugError(message);
        console.error("Failed to resume billing flow", error);
      } finally {
        setIsSubmitting(false);
      }
    })();
  }, [billingState, isLoaded, isSignedIn, open, selectedPlan]);

  async function handleContinue() {
    setIsSubmitting(true);
    setDebugError(null);
    console.log("[Billing Debug][modal] handleContinue", {
      isLoaded,
      isSignedIn,
      billingState,
      selectedPlan,
    });
    try {
      if (!isLoaded || !isSignedIn) {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(BILLING_INTENT_KEY, JSON.stringify({ interval: selectedPlan }));
        }
        await openSignIn({
          forceRedirectUrl: "/?billing=1",
          fallbackRedirectUrl: "/?billing=1",
        });
        return;
      }

      await startCheckout();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDebugError(message);
      console.error("Failed to start billing flow", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(250,246,239,0.82)] backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-x-4 top-1/2 z-50 mx-auto w-auto max-w-md -translate-y-1/2 rounded-[2rem] border px-5 py-6 shadow-[0_28px_80px_var(--shadow-warm-strong)] sm:px-6"
          style={{ backgroundColor: "var(--panel)", borderColor: "var(--line)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-3xl leading-none sm:text-4xl" style={{ color: "var(--ink)" }}>
                Appetito Premium
              </Dialog.Title>
              <p className="mt-3 max-w-sm text-center text-sm leading-snug sm:text-left sm:text-base" style={{ color: "var(--ink-muted)" }}>
                Unlimited saved recipes, smoother cookbook flow, and all your reel-to-recipe magic in one place.
              </p>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-full p-2 transition-opacity hover:opacity-70"
                aria-label="Close billing"
                style={{ color: "var(--ink-muted)" }}
              >
                <X size={28} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-8 space-y-4">
            {plans.map((plan) => {
              const selectedState = selectedPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className="relative flex w-full items-start justify-between rounded-[2rem] border px-5 py-5 text-left transition-transform hover:-translate-y-0.5"
                  style={{
                    borderColor: selectedState ? "var(--accent)" : "rgba(0,0,0,0.04)",
                    backgroundColor: selectedState ? "rgba(213, 98, 48, 0.09)" : "rgba(255,255,255,0.86)",
                  }}
                >
                  {plan.badge ? (
                    <span
                      className="absolute -top-4 right-4 rounded-full px-4 py-1 text-sm font-semibold"
                      style={{ backgroundColor: "var(--accent)", color: "#fff" }}
                    >
                      {plan.badge}
                    </span>
                  ) : null}

                  <div className="flex items-start gap-4">
                    <span className="mt-1 flex h-8 w-8 items-center justify-center">
                      {selectedState ? (
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full"
                          style={{ backgroundColor: "var(--accent)", color: "#fff" }}
                        >
                          <Check size={18} />
                        </span>
                      ) : (
                        <Circle size={26} style={{ color: "rgba(0,0,0,0.18)" }} />
                      )}
                    </span>
                    <div>
                      <div className="text-2xl font-semibold leading-none sm:text-3xl" style={{ color: "var(--ink)" }}>
                        {plan.title}
                      </div>
                      <div className="mt-2 text-base leading-tight sm:text-lg" style={{ color: "var(--ink-muted)" }}>
                        {plan.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-semibold leading-none sm:text-2xl" style={{ color: "var(--ink)" }}>
                      {plan.price}
                    </div>
                    {plan.struck ? (
                      <div className="mt-2 text-base line-through sm:text-lg" style={{ color: "var(--ink-muted)" }}>
                        {plan.struck}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 text-center text-sm font-semibold" style={{ color: "var(--ink-muted)" }}>
            {selected.struck ? (
              <>
                <span className="line-through opacity-60">{selected.struck}</span> {selected.price} (50% OFF)
              </>
            ) : (
              selected.price
            )}
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={isSubmitting || billingState === undefined}
            className="mt-4 w-full rounded-full px-5 py-4 text-xl font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 sm:text-2xl"
            style={{ backgroundColor: "var(--accent)", color: "#fff" }}
          >
            {billingState?.hasSubscription ? "Manage billing" : isSubmitting ? "Loading..." : "Continue"}
          </button>

          <p className="mt-2 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
            Cancel anytime
          </p>
          {debugError ? (
            <p className="mt-3 text-center text-sm" style={{ color: "var(--accent)" }}>
              {debugError}
            </p>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

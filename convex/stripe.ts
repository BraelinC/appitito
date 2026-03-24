import { v } from "convex/values";
import { query, action } from "./_generated/server";
import { components } from "./_generated/api";
import { StripeSubscriptions } from "@convex-dev/stripe";
import { getAppUrl } from "./lib/appUrl";

const stripe = new StripeSubscriptions(components.stripe, {});

export const getBillingState = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        signedIn: false,
        hasSubscription: false,
        activeSubscription: null,
      };
    }

    const subscriptions = await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, {
      userId: identity.subject,
    });

    const activeSubscription = subscriptions.find(
      (subscription) => subscription.status === "active" || subscription.status === "trialing"
    ) ?? null;

    return {
      signedIn: true,
      hasSubscription: Boolean(activeSubscription),
      activeSubscription,
    };
  },
});

export const createSubscriptionCheckout = action({
  args: {
    interval: v.union(v.literal("monthly"), v.literal("yearly")),
  },
  returns: v.object({
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { interval }) => {
    const identity = await ctx.auth.getUserIdentity();
    console.log("[Billing Debug][checkout] identity:", identity?.subject ?? null, "interval:", interval);
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const priceId = interval === "yearly"
      ? process.env.STRIPE_YEARLY_PRICE_ID
      : process.env.STRIPE_MONTHLY_PRICE_ID;

    if (!priceId) {
      console.log("[Billing Debug][checkout] missing price id for", interval);
      throw new Error(`Missing Stripe price for ${interval}`);
    }

    console.log("[Billing Debug][checkout] using price id:", priceId);

    const customer = await stripe.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email,
      name: identity.name,
    });

    const appUrl = getAppUrl();
    const session = await stripe.createCheckoutSession(ctx, {
      priceId,
      customerId: customer.customerId,
      mode: "subscription",
      successUrl: `${appUrl}/?billing=success`,
      cancelUrl: `${appUrl}/?billing=cancelled`,
      subscriptionMetadata: {
        userId: identity.subject,
        interval,
      },
    });

    console.log("[Billing Debug][checkout] session url created:", session.url);

    return { url: session.url };
  },
});

export const createBillingPortalSession = action({
  args: {},
  returns: v.object({
    url: v.string(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    console.log("[Billing Debug][portal] identity:", identity?.subject ?? null);
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const customer = await stripe.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email,
      name: identity.name,
    });

    return await stripe.createCustomerPortalSession(ctx, {
      customerId: customer.customerId,
      returnUrl: `${getAppUrl()}/`,
    });
  },
});

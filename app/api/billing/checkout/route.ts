import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { interval } = await request.json() as { interval?: "monthly" | "yearly" };
    if (!interval) {
      return NextResponse.json({ error: "Missing interval" }, { status: 400 });
    }

    const priceId = interval === "yearly"
      ? process.env.STRIPE_YEARLY_PRICE_ID
      : process.env.STRIPE_MONTHLY_PRICE_ID;
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!priceId || !stripeSecretKey) {
      return NextResponse.json({ error: `Missing Stripe price for ${interval}` }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-02-25.clover",
    });

    const appUrl = getAppUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?billing=success`,
      cancel_url: `${appUrl}/?billing=cancelled`,
      client_reference_id: userId,
      metadata: {
        userId,
        interval,
      },
      subscription_data: {
        metadata: {
          userId,
          interval,
        },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Billing Checkout Route] Error", error);
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://appitito.com";
}

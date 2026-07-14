import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

/**
 * Stripe Checkout skeleton.
 *
 * With STRIPE_SECRET_KEY and the selected monthly/yearly price set, creates
 * a real Checkout Session for the Plus subscription and returns its URL.
 *
 * Missing keys only return a simulated upgrade in local development.
 *
 * Production note: entitlement should be granted by the /api/stripe-webhook
 * handler on checkout.session.completed, the success redirect alone is a
 * convenience for the skeleton.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "http://localhost:3000";
  const body = await req.json().catch(() => ({}));
  const plan = body.plan === "monthly" ? "monthly" : "yearly";

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = plan === "yearly"
    ? process.env.STRIPE_YEARLY_PRICE_ID
    : process.env.STRIPE_MONTHLY_PRICE_ID ?? process.env.STRIPE_PRICE_ID;

  if (!secretKey || !priceId) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ demo: true, plan });
    }
    return NextResponse.json(
      { error: `Stripe ${plan} pricing is not configured` },
      { status: 503 }
    );
  }

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?upgrade=cancelled`,
      allow_promotion_codes: true,
      metadata: { plan },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout failed:", err);
    return NextResponse.json(
      { error: "Could not start checkout" },
      { status: 500 }
    );
  }
}

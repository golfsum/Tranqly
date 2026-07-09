import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

/**
 * Stripe Checkout skeleton.
 *
 * With STRIPE_SECRET_KEY + STRIPE_PRICE_ID set, creates a real Checkout
 * Session for the Premium subscription and returns its URL.
 *
 * Without keys (local dev / demo), returns { demo: true } and the client
 * simulates the upgrade so the full flow is testable end-to-end.
 *
 * Production note: entitlement should be granted by the /api/stripe-webhook
 * handler on checkout.session.completed, the success redirect alone is a
 * convenience for the skeleton.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secretKey || !priceId) {
    return NextResponse.json({ demo: true });
  }

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?upgrade=cancelled`,
      allow_promotion_codes: true,
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

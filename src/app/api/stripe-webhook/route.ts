import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook skeleton.
 *
 * Wire this up in the Stripe dashboard pointing at /api/stripe-webhook with
 * the checkout.session.completed and customer.subscription.deleted events,
 * then set STRIPE_WEBHOOK_SECRET.
 *
 * In production you'd map the Stripe customer to a Firebase uid (pass uid as
 * client_reference_id when creating the Checkout Session) and flip
 * users/{uid}.settings.premium in Firestore via the Admin SDK here.
 */
export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ skipped: true });
  }

  const stripe = new Stripe(secretKey);
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      console.log(
        "Premium purchased:",
        session.client_reference_id ?? session.customer
      );
      // TODO: grant premium in Firestore via firebase-admin using
      // session.client_reference_id (the Firebase uid).
      break;
    }
    case "customer.subscription.deleted": {
      console.log("Subscription cancelled:", event.data.object.customer);
      // TODO: revoke premium in Firestore.
      break;
    }
  }

  return NextResponse.json({ received: true });
}

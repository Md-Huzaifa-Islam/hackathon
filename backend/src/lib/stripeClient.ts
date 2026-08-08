import Stripe from "stripe";
import { env } from "@/config/env.js";

export const stripe = new Stripe(env.stripeSecretKey);

// `amount` arrives here in BDT (the app's one native pricing currency —
// see env.ts's bdtToUsdRate comment for why). Converting at this single
// choke point, rather than wherever `amount` originates, keeps every
// display/DB value honestly in BDT while still charging Stripe the actual
// equivalent instead of that many raw units of a different currency.
function toStripeUnitAmount(bdtAmount: number): number {
  const converted = env.stripeCurrency === "bdt" ? bdtAmount : bdtAmount * env.bdtToUsdRate;
  return Math.round(converted * 100);
}

// One Checkout Session per payment attempt. idempotencyKey (our Payment
// row's id) protects against a double-click or client retry creating two
// sessions for the same attempt — Stripe returns the original session
// instead of creating a second one.
export function createCheckoutSession(input: {
  bookingId: string;
  bookingRef: string;
  amount: number;
  seatLabel: string;
  idempotencyKey: string;
}) {
  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: input.bookingRef,
      metadata: { bookingId: input.bookingId, bookingRef: input.bookingRef },
      payment_intent_data: {
        metadata: { bookingId: input.bookingId, bookingRef: input.bookingRef },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: env.stripeCurrency,
            unit_amount: toStripeUnitAmount(input.amount),
            product_data: { name: `CinemaSeat booking ${input.bookingRef} — seat ${input.seatLabel}` },
          },
        },
      ],
      // Stripe's floor is 30 minutes from creation, so a session can outlive
      // our (shorter) seat reservation window. That gap is intentional and
      // safe: the webhook re-acquires the seats before confirming and issues
      // an automatic refund if they're genuinely gone, so a late payer is
      // either seated or made whole — never charged for nothing.
      expires_at: Math.floor(Date.now() / 1000) + Math.max(30 * 60, env.paymentWindowSeconds),
      success_url: `${env.frontendUrl}/bookings/${input.bookingId}?payment=success`,
      cancel_url: `${env.frontendUrl}/bookings/${input.bookingId}?payment=cancelled`,
    },
    { idempotencyKey: input.idempotencyKey },
  );
}

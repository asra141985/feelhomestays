// Starts a payment for a stay. The price is worked out here from the dates,
// never taken from the browser, and the dates are re-checked against the
// calendars right before the guest is sent to Stripe or PayPal.
import { SPACES, env, payments, takenAll, paypal, json, siteOrigin } from "../lib/shared.mjs";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 864e5;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const space = SPACES[b.space];
  const name = String(b.name || "").trim().slice(0, 120);
  const email = String(b.email || "").trim().slice(0, 200);
  const guests = Number(b.guests);
  if (!space || !ISO.test(b.checkin || "") || !ISO.test(b.checkout || "")) return json({ error: "bad_request" }, 400);
  const tIn = Date.parse(b.checkin + "T00:00:00Z"), tOut = Date.parse(b.checkout + "T00:00:00Z");
  if (Number.isNaN(tIn) || Number.isNaN(tOut)) return json({ error: "bad_request" }, 400);
  const nights = Math.round((tOut - tIn) / DAY);
  if (nights < space.minNights || nights > 365) return json({ error: "nights" }, 400);
  if (tIn < Date.now() - 2 * DAY) return json({ error: "past" }, 400);
  if (!Number.isInteger(guests) || guests < 1 || guests > space.sleeps) return json({ error: "guests" }, 400);
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "contact" }, 400);
  if (!payments()[b.method]) return json({ error: "not_configured" }, 503);

  const { spaces } = await takenAll();
  const clash = (spaces[b.space] || []).some(([a, z]) => a < b.checkout && z > b.checkin);
  if (clash) return json({ error: "taken" }, 409);

  const cleaning = space.cleaning || 0;
  const total = nights * space.rate + cleaning;
  const origin = siteOrigin(req);          // the website
  const self = new URL(req.url).origin;    // this server
  const title = `${space.name}: ${b.checkin} to ${b.checkout}`;
  const detail = `${nights} ${nights === 1 ? "night" : "nights"}, ${guests} ${guests === 1 ? "guest" : "guests"}` +
    (cleaning ? `, incl. EUR ${cleaning} cleaning fee` : "");

  try {
    if (b.method === "stripe") {
      const p = new URLSearchParams({
        mode: "payment",
        success_url: `${origin}/thanks.html`,
        cancel_url: `${origin}/book.html#${b.space}`,
        customer_email: email,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][unit_amount]": String(total * 100),
        "line_items[0][price_data][product_data][name]": title,
        "line_items[0][price_data][product_data][description]": detail,
        "payment_intent_data[description]": `${title} (${name})`,
        "metadata[space]": b.space,
        "metadata[checkin]": b.checkin,
        "metadata[checkout]": b.checkout,
        "metadata[guests]": String(guests),
        "metadata[name]": name,
      });
      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`, "content-type": "application/x-www-form-urlencoded" },
        body: p.toString(),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error("stripe");
      return json({ url: data.url });
    }

    const order = await paypal("/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [{
        amount: { currency_code: "EUR", value: total.toFixed(2) },
        description: `${title}, ${detail}`.slice(0, 127),
        custom_id: `${b.space}|${b.checkin}|${b.checkout}|${guests}`,
      }],
      application_context: {
        brand_name: "Feel Home Stays",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: `${self}/api/paypal-return`,
        cancel_url: `${origin}/book.html#${b.space}`,
      },
    });
    const link = (order.links || []).find((l) => l.rel === "approve" || l.rel === "payer-action");
    if (!link) throw new Error("paypal");
    return json({ url: link.href });
  } catch {
    return json({ error: "payment_unavailable" }, 502);
  }
};

export const config = { path: "/api/pay" };

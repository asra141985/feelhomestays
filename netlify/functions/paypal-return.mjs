// PayPal sends the guest back here after they approve. This collects the money
// (PayPal calls it "capture") and then shows the thank-you page.
import { paypal } from "../lib/shared.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const go = (path) => new Response(null, { status: 302, headers: { location: url.origin + path } });
  if (!/^[A-Z0-9]{8,30}$/.test(token)) return go("/book.html#payment-failed");
  try {
    const result = await paypal(`/v2/checkout/orders/${token}/capture`);
    return go(result.status === "COMPLETED" ? "/thanks.html" : "/book.html#payment-failed");
  } catch {
    return go("/book.html#payment-failed");
  }
};

export const config = { path: "/api/paypal-return" };

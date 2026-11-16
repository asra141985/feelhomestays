// Entry point for running the booking server as a Cloudflare Worker.
// It passes the Worker's settings to the shared code, sends each address to
// its function, and lets only the website call it from the browser.
import { setEnv, json } from "./lib/shared.mjs";
import availability from "./api/availability.mjs";
import pay from "./api/pay.mjs";
import paypalReturn from "./api/paypal-return.mjs";

const ROUTES = { "/api/availability": availability, "/api/pay": pay, "/api/paypal-return": paypalReturn };
const ALLOWED = /^https:\/\/(www\.)?feelhomestays\.com$/;

export default {
  async fetch(req, env) {
    setEnv(env);
    const origin = req.headers.get("origin") || "";
    const cors = ALLOWED.test(origin)
      ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type", "access-control-max-age": "86400", vary: "origin" }
      : {};
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const handler = ROUTES[new URL(req.url).pathname.replace(/\/+$/, "")];
    let res;
    try { res = handler ? await handler(req) : json({ error: "not_found" }, 404); }
    catch { res = json({ error: "server" }, 500); }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};

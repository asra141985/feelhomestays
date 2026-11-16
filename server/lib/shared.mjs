// Shared by the functions: spaces and prices, calendar reading, payment helpers.
//
// Environment variables (set on whichever host runs this code):
//   ICAL_COSY, ICAL_FEELHOME, ICAL_FLAT   Airbnb "Export calendar" link per space
//   STRIPE_SECRET_KEY                     Stripe secret key (sk_test_... to test, sk_live_... for real)
//   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET  PayPal REST app credentials
//   PAYPAL_ENV                            "sandbox" to test, leave empty for real payments
//   SITE_URL                              https://feelhomestays.com when the server has its own address
// Keys live only in these variables. Never put them in a page or in this file.

// Keep names, prices and rules identical to the SPACES list in book.html.
//   open      date windows that can be booked: [first night, checkout day of the last night].
//             An empty list closes the space completely; leave it out to open every date.
//   cleaning  one-off cleaning fee per stay, added to the total.
export const SPACES = {
  cosy:     { name: "Cosy Room in City Center", rate: 100, sleeps: 2, minNights: 1,  cleaning: 0,   open: [], ical: "ICAL_COSY" },
  feelhome: { name: "Feel Home Room",           rate: 100, sleeps: 2, minNights: 1,  cleaning: 0,   open: [], ical: "ICAL_FEELHOME" },
  flat:     { name: "Flat with Balcony",        rate: 70,  sleeps: 4, minNights: 30, cleaning: 120, open: [["2027-01-01", "2027-04-01"]], ical: "ICAL_FLAT" },
};

// Everything outside a space's open windows, as taken ranges.
export function closedRanges(space) {
  if (!space.open) return [];
  const out = [];
  let from = "2000-01-01";
  for (const [a, z] of [...space.open].sort()) {
    if (a > from) out.push([from, a]);
    if (z > from) from = z;
  }
  out.push([from, "2100-01-01"]);
  return out;
}

const ROOMS_IN_FLAT = ["cosy", "feelhome"];

// Settings come from the host: process.env on Node hosts, or setEnv() on
// Cloudflare Workers (see server/worker.mjs).
let ENV = (typeof process !== "undefined" && process.env) || {};
export const setEnv = (e) => { ENV = e || {}; };
export const env = (k) => ENV[k] || "";

// Address of the website guests return to after paying. Set SITE_URL when the
// server runs on a different address than the site (e.g. a Cloudflare Worker).
export const siteOrigin = (req) => (env("SITE_URL") || new URL(req.url).origin).replace(/\/+$/, "");

export const payments = () => ({
  stripe: !!env("STRIPE_SECRET_KEY"),
  paypal: !!(env("PAYPAL_CLIENT_ID") && env("PAYPAL_CLIENT_SECRET")),
});

export const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...headers } });

const toIso = (v) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;

export function parseIcal(text) {
  const lines = text.replace(/\r\n[ \t]/g, "").split(/\r?\n/);
  const ranges = [];
  let ev = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") ev = {};
    else if (line === "END:VEVENT") {
      if (ev && ev.start && ev.end && ev.end > ev.start) ranges.push([ev.start, ev.end, ev.summary || ""]);
      ev = null;
    } else if (ev) {
      const m = line.match(/^(DTSTART|DTEND)[^:]*:(\d{8})/);
      if (m) ev[m[1] === "DTSTART" ? "start" : "end"] = toIso(m[2]);
      const sm = line.match(/^SUMMARY[^:]*:(.*)$/);
      if (sm) ev.summary = sm[1].trim();
    }
  }
  return ranges;
}

async function icalRanges(urls) {
  if (!urls) return { ranges: [], ok: false };
  const ranges = [];
  let ok = true;
  for (const url of urls.split(",").map((s) => s.trim()).filter(Boolean)) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "feelhomestays-availability" } });
      if (!res.ok) throw new Error(String(res.status));
      // Airbnb marks nights closed by the host (and dates imported from other
      // calendars) as "Airbnb (Not available)". Only its real reservations
      // block this site, so direct bookings stay possible while the platforms
      // are closed. Other calendars (Booking.com, HousingAnywhere) count fully.
      const airbnb = /(^|\.)airbnb\./i.test(new URL(url).hostname);
      for (const [a, z, summary] of parseIcal(await res.text())) {
        if (airbnb && /not available/i.test(summary)) continue;
        ranges.push([a, z]);
      }
    } catch {
      ok = false;
    }
  }
  return { ranges, ok };
}

// Stays already paid through Stripe on this site, read back from Stripe itself,
// so a paid direct booking blocks its dates without any extra database.
async function stripePaid() {
  const out = {};
  const key = env("STRIPE_SECRET_KEY");
  if (!key) return out;
  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions?limit=100", {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!res.ok) return out;
    const data = await res.json();
    for (const s of data.data || []) {
      const m = s.metadata || {};
      if (s.payment_status === "paid" && SPACES[m.space] && m.checkin && m.checkout) {
        (out[m.space] ||= []).push([m.checkin, m.checkout]);
      }
    }
  } catch {}
  return out;
}

export async function takenAll() {
  const spaces = {};
  const synced = {};
  const [paid] = await Promise.all([
    stripePaid(),
    ...Object.entries(SPACES).map(async ([id, s]) => {
      const { ranges, ok } = await icalRanges(env(s.ical));
      spaces[id] = ranges;
      synced[id] = ok;
    }),
  ]);
  for (const [id, ranges] of Object.entries(paid)) spaces[id].push(...ranges);
  // The two rooms are inside the flat: a whole-flat booking takes both rooms,
  // and a booking of either room takes the whole flat.
  const flatOnly = [...spaces.flat];
  for (const room of ROOMS_IN_FLAT) {
    spaces.flat.push(...spaces[room]);
    spaces[room].push(...flatOnly);
  }
  // Dates the owner keeps closed. Added last so a closed room does not close the flat.
  for (const [id, s] of Object.entries(SPACES)) spaces[id].push(...closedRanges(s));
  return { spaces, synced };
}

const paypalBase = () =>
  env("PAYPAL_ENV") === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

export async function paypal(path, body) {
  const base = paypalBase();
  const basic = btoa(`${env("PAYPAL_CLIENT_ID")}:${env("PAYPAL_CLIENT_SECRET")}`);
  const tok = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!tok.ok) throw new Error("paypal_auth");
  const { access_token } = await tok.json();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${access_token}`, "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("paypal_" + res.status);
  return data;
}

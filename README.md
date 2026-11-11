# Feel Home Stays

Website for feelhomestays.com: home page, direct booking page with live
availability, and card / PayPal checkout.

## Files

- `index.html` – home page
- `book.html` – booking page (spaces and prices are in the `SPACES` list near the bottom)
- `thanks.html` – shown after a successful payment
- `netlify/functions/` – availability, payment start, PayPal return
- `netlify/lib/shared.mjs` – prices and rules used by the server (keep in step with `book.html`)

## Publishing

Connect this repository to the Netlify site. Every change pushed to `main`
goes live automatically. No build command; publish directory is the repo root.

## Settings (Netlify > Site configuration > Environment variables)

| Variable | What it is |
| --- | --- |
| `ICAL_COSY`, `ICAL_FEELHOME`, `ICAL_FLAT` | Airbnb "Export calendar" link for each space |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...` while testing) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | PayPal REST app credentials |
| `PAYPAL_ENV` | `sandbox` while testing, empty for real payments |

Never commit keys to this repository. Without payment keys the booking page
falls back to a "Send booking request" form (Netlify Forms, form name `booking`).

# Feel Home Stays

Website for feelhomestays.com: home page, direct booking page with live
availability, and card / PayPal checkout.

## Files

- `index.html` – home page (English). **Generated – do not edit by hand**
- `de/`, `fr/`, … – the home page in 49 more languages (generated)
- `site-src/` – source of the home page: `home.template.html` (layout), `i18n/*.json` (texts per language), `build.py`
- `img/` – photos
- `book.html` – booking page (spaces and prices are in the `SPACES` list near the bottom)
- `thanks.html` – shown after a successful payment
- `analytics.js` – Google Analytics / Google Ads with a consent banner (set `GA_ID` and optionally `ADS_ID` at the top)
- `CNAME`, `.nojekyll` – tell GitHub Pages to serve the site at feelhomestays.com as plain files
- `server/` – optional booking server (live calendar sync, card / PayPal checkout). **Not running.** See below

## Changing the home page

Edit the template or the texts in `site-src/`, then run `python3 site-src/build.py`
and commit the result. It rebuilds all language versions and `sitemap.xml`.

## Publishing

The site is hosted on GitHub Pages (repository Settings > Pages, branch `main`,
folder `/`). Every change pushed to `main` goes live within a minute or two.
There is no build step and no limit on how often you publish.

## Booking requests

The "Send booking request" form on `book.html` is emailed through Web3Forms.
The access key is `FORM_KEY` near the bottom of `book.html`; it decides which
inbox receives the requests.

Which dates can be booked is set by the `open` windows in the `SPACES` list in
`book.html`. Without the booking server there is no automatic sync with Airbnb
or Booking.com, so dates are confirmed by email.

## Booking server (optional, not running)

`server/api/` and `server/lib/shared.mjs` hold the code for live availability
from the Airbnb / Booking.com calendars and for Stripe / PayPal checkout.
GitHub Pages only serves files, so this code needs a separate host that can
run it and keep the keys below secret. Once it runs somewhere, put its address
in `API` in `book.html`.

| Variable | What it is |
| --- | --- |
| `ICAL_COSY`, `ICAL_FEELHOME`, `ICAL_FLAT` | Airbnb "Export calendar" link for each space |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...` while testing) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | PayPal REST app credentials |
| `PAYPAL_ENV` | `sandbox` while testing, empty for real payments |

| `SITE_URL` | `https://feelhomestays.com` (already set in `wrangler.toml`) |

Never commit keys to this repository.

### Running it on Cloudflare Workers (free)

`wrangler.toml` and `server/worker.mjs` make the server deployable as a
Cloudflare Worker. In the Cloudflare dashboard: Workers & Pages > Create >
import this GitHub repository. Then under the Worker's Settings > Variables and
Secrets add the variables above as type "Secret". Finally put the Worker's
address (e.g. `https://feelhomestays-booking.<name>.workers.dev`) in `API` in
`book.html`. Only feelhomestays.com is allowed to call it from the browser.

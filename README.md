# LEADFX Trading Platform

Premium black-and-silver trading services storefront for South African and African customers.

## Included
- Responsive service catalogue and multi-item cart
- Server-calculated prices (browser-submitted prices are never trusted)
- Yoco hosted Checkout API integration
- Signed Yoco Checkout API webhook verification using Standard Webhooks
- Supabase order storage with no public row-level-security policies
- Resend owner and customer email notifications
- Payment status polling after the customer returns from Yoco
- Privacy and terms draft pages
- Payments disabled by default

## Important launch controls
**Do not accept live orders until the business has completed Yoco merchant/domain verification and obtained appropriate South African regulatory advice/authorisation for any regulated signals or financial services.** The site intentionally ships with `CHECKOUT_ENABLED=false`.

The catalogue is a proposed starting catalogue. Confirm product availability, prices, delivery, support terms and legal classification before enabling checkout. Yoco Checkout API processes ZAR and uses a hosted checkout page. The browser redirect is not proof of payment; only a verified Yoco webhook can mark an order paid.

## Deploy to Vercel
1. Import this GitHub repository into Vercel.
2. Add the environment variables listed in `.env.example` in Vercel Project Settings. Do not put secrets in frontend files.
3. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
4. Create a Resend account, verify a sending domain, and configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
5. Add your private inbox to `OWNER_NOTIFICATION_EMAIL` in Vercel only. It is not rendered on the public website or included in client-side files.
6. In Yoco, open Sales → e-Commerce integrations → Checkout API. Add and verify the production domain. Use test keys while building.
7. Register the Checkout API webhook URL `https://YOUR-DOMAIN/api/yoco-webhook` in Yoco and save the signing secret as `YOCO_WEBHOOK_SECRET`.
8. Set `YOCO_EXPECTED_MODE=test`, configure `YOCO_SECRET_KEY` with the test secret, and keep `CHECKOUT_ENABLED=false` until database, webhook and email configuration is complete.
9. For sandbox testing, set `CHECKOUT_ENABLED=true` and test end-to-end. Verify a paid test order, owner email, customer email, duplicate webhook behavior and failed payment handling.
10. For launch, replace test credentials with live credentials, set `YOCO_EXPECTED_MODE=live`, verify the live webhook secret, and only then set `CHECKOUT_ENABLED=true` after compliance clearance.

## Environment variables
See `.env.example`. All variables are server-side. Never expose the Yoco secret key, webhook secret, Supabase service-role key, Resend API key or owner inbox address in browser JavaScript.

## Current payment model
Yoco Checkout API is used for one-time payments in ZAR. The displayed 30-day access packages require manual renewal; this implementation does not create automatic recurring charges.

## Before public launch
- Replace draft legal pages with reviewed business terms, privacy notice, refund policy and required disclosures.
- Confirm whether the proposed signal products and any software distribution require FSCA authorisation or other regulatory steps.
- Confirm that each product is ready to deliver and test all supported brokers/instruments.
- Configure support operations, access revocation/expiry and customer fulfilment.
- Add abuse prevention/rate limiting and operational monitoring.
- Verify Yoco's latest webhook documentation and perform test/live end-to-end checks.

## Technical stack
Static HTML/CSS/JS + Vercel Node serverless functions + Supabase + Yoco Checkout API + Resend.

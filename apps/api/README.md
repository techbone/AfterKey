# Deferred notification backend

`apps/api` contains a prepared Fastify/PostgreSQL notification service. It is not hosted or connected to the submitted AfterKey app. Email delivery is disabled, and the live owner and beneficiary flows use Solana directly without this service, a database, or an email provider.

This code was developed and locally tested as a future optional convenience layer. Do not treat it as a live reminder or claim-alert feature. Before activation it needs a hosted API, a verified email sender, a restored frontend settings flow, end-to-end delivery testing and monitoring.

For local development, use Node 22.12+, copy `.env.example` to `.env`, and keep `NOTIFICATIONS_DELIVERY_ENABLED=false`. The example uses memory storage and disabled delivery. Run `npm run test:api` for the API tests. Never commit database or email credentials.

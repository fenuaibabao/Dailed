# Dialed

Working codename. The product name lives in one place: `src/config/brand.ts`.

Dialed is a desktop-first web app where an AI voice interviewer has spoken
conversations with you, remembers them across sessions, and turns each one into
a private summary, big-picture themes and content drafts in your own words. The
first app is **Dialed Create**, with Remi as the interviewer. Other apps (Coach,
Daily, Voices, Keepsake, Lingo) are meant to be added as rows in the `apps` and
`personas` tables, not as new code.

## Stack

- Next.js 15 (App Router, TypeScript strict), deployed on Vercel
- Convex for the database, server functions, crons and HTTP endpoints
- Convex Auth with email + password, wired with `ConvexAuthNextjsProvider` and
  `src/middleware.ts` so the auth cookie is visible to the middleware on every
  protected route
- Vapi for voice (Web SDK in the browser + server webhook)
- OpenAI for processing, behind a small provider interface (`convex/lib/llm`)

## Setup

```bash
npm install
cp .env.example .env.local

# 1. Create or link a Convex project. This writes CONVEX_DEPLOYMENT and
#    NEXT_PUBLIC_CONVEX_URL to .env.local and pushes the functions.
npx convex dev --once

# 2. Configure Convex Auth on the deployment (generates JWT_PRIVATE_KEY and
#    JWKS, and asks for SITE_URL, e.g. http://localhost:3000).
npx @convex-dev/auth

# 3. Seed the Create app and the Remi persona (see "Seed" below).
npx convex env set REMI_ASSISTANT_ID <your-vapi-assistant-id>
npm run seed

# 4. Run Next.js and Convex together.
npm run dev
```

Open http://localhost:3000, create an account, and you land on `/app/session`.

## Environment variables

All of them are listed in `.env.example`. Convex functions run on Convex, not
Vercel, so anything they read has to be set on the Convex deployment:

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Vercel + `.env.local` | Written by `npx convex dev` |
| `CONVEX_DEPLOY_KEY` | Vercel only | For `npx convex deploy` in the Vercel build |
| `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` | Convex | Set by `npx @convex-dev/auth` |
| `REMI_ASSISTANT_ID` | Convex | Read by the seed. Not secret |
| `VAPI_PRIVATE_KEY` | Vercel | Server only |
| `VAPI_PUBLIC_KEY` | Vercel | Served only via `/api/vapi/public-config` |
| `VAPI_WEBHOOK_SECRET` | Vercel + Convex | Webhook verification |
| `OPENAI_API_KEY` | Convex | Processor |
| `XAI_API_KEY` | Convex | Optional, only for a persona set to `xai` |

Private keys must never reach client code, logs or API responses.

## Seed

`npm run seed` runs the internal mutation `seed:run`. It upserts the `create`
app by slug and the "Remi" persona by (app, name), with Remi's system prompt,
first message, OpenAI `gpt-4.1-mini` and `maxCallSeconds` 5400. Running it again
updates the same rows; it never creates duplicates. It refuses to run if
`REMI_ASSISTANT_ID` isn't set. For production: `npx convex run seed:run --prod`.

## Vapi assistant setup

1. Create an assistant in the Vapi dashboard and copy its ID into
   `REMI_ASSISTANT_ID` (then re-run the seed).
2. Set its **Server URL** to `https://<your-domain>/api/vapi/webhook` and its
   server secret to the same value as `VAPI_WEBHOOK_SECRET`. The route accepts
   the secret as the `x-vapi-secret` header or as a Bearer token.
3. Make sure `end-of-call-report` is among the assistant's server messages
   (it is by default).
4. Set the **silence timeout to 60 seconds** on the assistant. The current Web
   SDK doesn't accept it as a per-call override, so it lives in the dashboard.
5. Enable recording on the assistant if you want the recording URL saved.

Per call, the app sends the system prompt (with the mode line, memory block and
today's focus), first message, model and `maxDurationSeconds` (600 quick, 5400
deep) as `assistantOverrides`, plus `metadata.call_id` so the webhook can find
the call. The dashboard's own prompt is overridden.

## How a session flows

1. The user ticks the recording consent once (stored in `consents` with IP and
   user agent).
2. **Quick** or **Deep** calls the `startSession` server action, which creates
   a `queued` call and returns the Vapi config.
3. Only then does the browser fetch the public key, import `@vapi-ai/web` and
   start the call (which is when the microphone is requested).
4. The browser reports `connecting` → `in_session` → `processing` and the Vapi
   call id. Statuses only move forward.
5. Vapi posts `end-of-call-report` to `/api/vapi/webhook`. The call gets its
   transcript, duration, cost, recording URL and end reason, and the processor
   is scheduled. Unknown calls are ignored; repeat deliveries are no-ops. If no
   report arrives within 10 minutes of the call ending, the call is marked
   failed.
6. The processor (`convex/processor.ts`) sends the transcript to the persona's
   LLM. Sessions over ~30 minutes are condensed in chunks first. The JSON reply
   is validated and retried once if invalid. Posts and scripts whose
   `source_excerpt` isn't something the user actually said are dropped.

## Deploying to Vercel

Set the build command to `npx convex deploy --cmd 'npm run build'` and add
`CONVEX_DEPLOY_KEY` (from the Convex dashboard) to the Vercel project. Run
`npx @convex-dev/auth --prod` once to configure auth on the production
deployment, then seed it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js and `convex dev` together |
| `npm run check` | Type checks, lint, unit + Convex tests, production build |
| `npm test` | Vitest: Convex functions (via `convex-test`) and unit tests |
| `npm run test:e2e` | Playwright against `npm run start` (run `npm run build` first) |
| `npm run codegen` | Regenerate `convex/_generated` without a deployment |
| `npm run seed` | Idempotent seed |

The end-to-end auth flow (`tests/e2e/auth-flow.spec.ts`) needs a real Convex
deployment and runs only with `E2E_LIVE_CONVEX=1`. The gating tests in
`tests/e2e/auth-gating.spec.ts` run without one.

## Project layout

```
convex/                 schema, auth, seed and server functions
  lib/auth.ts           requireUserId(): the only way functions learn who's calling
  passwordProvider.ts   email + password with stable error codes for the forms
src/config/brand.ts     the product name
src/middleware.ts       protects /app/*, bounces signed-in users off /sign-in
src/app/(auth)/         sign-in and sign-up
src/app/app/            the signed-in app
tests/                  convex/, unit/, e2e/
```

## Rules the code follows

- Every public Convex function derives the user from the auth identity and never
  takes a user ID from the client. `tests/convex/unauthenticated.test.ts`
  discovers every public function and fails if one doesn't reject signed-out
  calls.
- No page loads the Vapi SDK or requests the microphone until the user clicks
  Start.
- No email is sent by the app yet (no verification or password reset).

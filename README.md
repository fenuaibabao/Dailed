# Warpwork

The product name lives in one place: `BRAND_NAME` in `src/config/brand.ts`.

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

`npm run seed` runs the internal mutation `seed:run`. For every enabled product
in `src/config/products.ts` it upserts an app by slug and a "Remi" persona by
(app, name), with Remi's prompt plus that product's interview focus, its first
message, OpenAI `gpt-4.1-mini` and the product's max session length. Running it again
updates the same rows; it never creates duplicates. It refuses to run if
`REMI_ASSISTANT_ID` isn't set. Production deploys run it automatically.

## Products

The suite lives in `src/config/products.ts`: each product is the same loop with
its own name, landing headline, interview focus, max session length and output
templates. Create and Clarity are enabled; Founder, Legacy, Voices and Intake
have "coming soon" landing pages. Every product has a landing page at
`/<slug>` (the home page is Create). Its Start talking button carries
`?product=<slug>` through sign-up and sign-in to `/app/session`, which runs
that product. Products without post or script templates (Clarity) never get
posts, scripts or a newsletter. To add one: add it to the config, set
`enabled: true`, and deploy.

## Workspaces, roles and health-data mode

Personal use needs no workspace. A workspace (`orgs`) is for a team, such as a
company or a clinic, and is managed at `/app/workspaces`.

- Roles (`memberships.role`): **owner** (roles, health-data mode), **admin**
  (invite code, rename, remove members) and **member**. Rules live in
  `convex/lib/roles.ts`. A workspace always keeps at least one owner.
- People join with the workspace's invite code. No email is sent. Admins can
  replace the code, which stops the old one working.
- Each user picks where new sessions go (`users.activeOrgId`), and the call
  records it as `calls.orgId`. Sessions stay private to the person who had
  them; workspace members don't see each other's sessions.
- **Health-data mode** (`orgs.phiMode`, the `phi_mode` flag) is for
  workspaces that would handle protected health information. While it's on,
  `calls.start` refuses sessions in that workspace (`PHI_NOT_READY`) unless
  every vendor a session passes through (Vapi, Convex, Vercel and the
  persona's model provider) is listed in `BAA_COVERED_VENDORS` in
  `convex/lib/phi.ts`. That list is empty until BAAs are signed, and changing
  it is a reviewed code change. Health-data sessions are also marked
  sensitive.

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
today's focus), first message, model and `maxDurationSeconds` (the product's
maximum, 90 minutes for now) as `assistantOverrides`, plus `metadata.call_id` so the webhook can find
the call. The dashboard's own prompt is overridden.

## How a session flows

1. The user ticks the recording consent once (stored in `consents` with IP and
   user agent).
2. **Start talking** calls the `startSession` server action with the page's
   product, which creates
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
   is validated and retried once if invalid. Each post or script quote is
   checked against the user's lines (`convex/lib/grounding.ts`): kept if it
   matches, replaced with the user's own words if it's about 85% similar or a
   clear paraphrase of one moment, and removed otherwise (the draft stays).
   Sessions of 2 minutes or more are asked once more if they get no post or no
   script; if there's still none, the reason is saved as `calls.noDraftsReason`.
   Counts are saved as `calls.grounding`, and logged when the deployment has
   `GROUNDING_LOGS=1` (set it on dev only).
7. Weaving (`convex/weaves.ts`) is scheduled once the results are saved. The
   session's summary and themes, plus the person's existing weaves in that
   product (as short refs like `w1`, never ids), go to the persona's LLM, which
   says which weaves the session continues or starts (up to 3). Each session
   is woven once (`calls.wovenAt`), and a failure leaves the drafts alone.
   Sensitive sessions only join sensitive weaves.

## Deploying to Vercel

`vercel.json` sets the build command to `node scripts/vercel-build.mjs`, which
overrides whatever the Vercel dashboard says. Add `CONVEX_DEPLOY_KEY` (the
production deploy key from the Convex dashboard) to the Vercel project. Run
`npx @convex-dev/auth --prod` once to configure auth on the production
deployment.

What the build script does:

- **Production:** `npx convex deploy --cmd 'npm run build'`, then
  `npx convex run seed:run` so the app and Remi rows follow config changes
  such as the brand name. A failed seed is logged but doesn't fail the deploy.
- **Preview with a Convex preview or dev deploy key:** deploys to that
  deployment, then builds.
- **Preview with only the production key:** builds the site alone against
  `NEXT_PUBLIC_CONVEX_URL` (or else the production deployment's URL) and pushes
  no Convex functions. The production key is removed from the build's
  environment. Such a preview shares production data and runs `main`'s
  backend code, so it's for checking UI changes.

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

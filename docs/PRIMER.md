# Warpwork primer: everything decided so far

*Written 2026-10-10 from my planning chat with Claude (Cowork). Read it before any work on this repo. If this primer and the repo disagree, the repo wins for **code and status**, and this primer wins for **product intent**. When you find a conflict, tell me.*

---

## 0. How to work with me

- I'm the founder (fenuaibabao, also known as Endaoism). I'm not a full-time engineer. Explain things in plain words and give me exact click-by-click steps when I need to do something.
- Do as much as you can yourself. Only hand me what you can't do: secrets, sign-ins, approvals, paid upgrades.
- **Ask me first** before: adding a paid service, anything that sends email/SMS or places a phone call, billing changes, touching production data, or merging to main.
- One PR per section. After each PR, tell me **what to test on dailed.vercel.app** in 3–5 plain steps.
- Use the connectors yourself (Vercel MCP for builds and logs, Convex MCP on the **dev** deployment only, GitHub). Don't make me copy logs back and forth.
- Keep this primer current. When we make a product decision, add it to section 13 ("Decision log"). Claude owns keeping sections 5 and 13 current.
- Times in Pacific time.

## 1. What this is

**One AI interviewer engine that powers a suite of products.** An AI voice talks with you, remembers you across sessions, and turns the conversation into useful outputs. Each product in the suite is the same loop with a different configuration:

> persona + interview focus + session length + output templates + who receives the output

Build the loop once. Each new product is then mostly config plus a landing page.

Every product is planned in **MAP** format: **Market** (who it's for), **Asset** (what we build and what they get), **Promotion** (how it spreads).

## 2. Product principles (don't break these)

1. **Bird's-eye first.** Start broad and only zoom in where the user has energy. After two short or flat answers on a thread, zoom out or change area. Every 10–15 minutes, reflect the big picture back in one sentence and ask if it's right.
2. **Long sessions are the core value.** Quick is about 10 minutes; Deep is 30–90 minutes.
3. **Their words, never invented.** Outputs must be grounded in what the user said: no invented facts, numbers or stories. (Grounding uses *close* matching, not word-for-word. Speech-to-text shifts small words.)
4. **No choice overload.** One **"Start talking"** button. No visible "modes" picker. The product you entered through (URL/landing page) sets the configuration. Internally we call these **lenses**. Users never see that word.
5. **Private by default.** Transcripts, recordings and memories are visible only to their owner (or their org, under org rules).
6. **Desktop-first web app.** Designed for laptops but usable at phone width. Mobile app later.
7. **Browser first, phone later.** Browser voice sessions now; scheduled outbound phone calls later.
8. **Built for scale and regulated buyers.** Architecture should let us sell to healthcare later (see section 7).
9. **Honest AI.** Remi always discloses it's an AI and that the session is recorded. No advice or coaching. It draws out *their* thinking.

## 3. The suite (working ICPs and MAPs, refine as we learn)

| Product | Market (ICP) | Asset (what they get) | Promotion |
|---|---|---|---|
| **Create** *(built, first)* | Creators, DJs, coaches, solo experts who need to post but hate writing | A week of posts, short-video scripts, a newsletter and an idea bank, in their own voice | "My AI interviewed me" clips; creators post the outputs, which markets us |
| **Clarity** *(next to enable)* | Individuals who want to think out loud: life direction, decisions, journaling without writing | Session summaries, themes over time (Weaves), open threads, private insight | Personal stories and word of mouth; "talk it out" positioning |
| **Founder** | Early-stage founders | Investor updates, pitch narrative, decision log, weekly founder reflection | Founder communities and build-in-public posts |
| **Legacy** | Older adults and families preserving life stories | A memoir/story book built from long interviews (family gift) | Gift purchases by adult children; holidays and milestones |
| **Voices** *(B2B)* | Product, research and marketing teams | AI-run customer interviews at scale, themes across interviews, quotes | Sales-led; case studies |
| **Intake** *(healthcare B2B, later)* | Clinics and practices | Pre-visit patient intake conversations turned into structured summaries for clinicians | Sales-led; needs BAAs and compliance first (section 7) |

**Weaves** is the in-app feature name for automatic topic grouping across sessions: recurring themes, threads and ideas woven together over time. ("Threads" was taken.)

**Open conversation (18+)**, optional and later: adults can talk honestly about sexuality, relationships and identity in a frank, non-judgmental reflective interview. **Not erotic content.** Requirements:
- Off by default; age gate (DOB showing 18+) plus a stored acknowledgement.
- Separate persona ("Remi Open") that may later use Grok.
- Remi never role-plays or describes sexual content.
- Ends the session if the user indicates they're under 18. Never anything involving minors or non-consent.
- Responds with care and points to support on disclosures of abuse, crisis or self-harm.
- Sessions are flagged sensitive: private summary, themes and memories only, with no posts.
- One-click delete.

I don't want to break any laws. Have legal review before launch.

## 4. Brand and naming

- **Working brand: Warpwork.** (2–3 syllables matters for pronunciation and accessibility.) Keep it in one `BRAND_NAME` constant; we may rename before hard launch.
- **"Dialed"** is the old codename; the repo is spelled **Dailed**. DIALED has live USPTO registrations (Class 42 #98710235, Class 9 #88340816), so it can't be the public name.
- Rejected:
  - Weaveworks: live marks in Classes 9 and 42, owned by Weaveworks Ltd (I used to work there).
  - Heddle: pending Class 42 application #99768659 by Threadline Systems.
  - Selvedge: sounds like "salvage."
  - Tapestry: Tapestry Inc. (Coach) is building AI.
- No WARPWORK/WARPWORKS marks found in my quick search. Still to do: domain and social handles, plus a proper trademark clearance before launch.
- "Suite" is the word for the product family.

## 5. Current state (2026-10-10, verify with git)

- Repo **fenuaibabao/Dailed**, live at **https://dailed.vercel.app**.
- Merged:
  - #1 Milestone 2: browser sessions, webhook, processor.
  - #2 Password show/hide toggle plus confirm-password field on sign-up.
  - #3 `.mcp.json` with Vercel and Convex MCP (dev only).
  - #4 Section 0: preview builds never use the prod Convex key; `BRAND_NAME = "Warpwork"`. First green preview. Production deploys re-run the seed, so Remi's greeting and the app name follow `BRAND_NAME`.
- Open, waiting on my OK to merge: **#5, section 1 (grounding)**. Preview is green. This PR also adds this primer and `CLAUDE.md`.
- The end-to-end loop works: sign up → browser session → webhook → Convex call row → outputs. The first session ran 226 s, cost $0.26 and produced 9 outputs, but **no posts or scripts**. Drafts were dropped because quotes had to match the transcript word for word (fixed in #5).
- Not built yet: the admin cost page and daily spend cap (section 10), memory view/edit/delete and delete account (section 12), the Anthropic LLM adapter (stubbed; OpenAI and xAI work).

## 6. Roadmap (in order)

1. **Section 1 – Grounding fix:**
   - Normalize text and accept quotes at roughly 85% or higher similarity (or a clear paraphrase of a specific moment).
   - Fix or drop a bad quote, not the whole draft.
   - Log kept, fixed and dropped counts.
   - Every session of a few minutes or more yields at least one post and one script, or records why not.
2. **Section 2 – Products as configuration:**
   - A `products` config: create and clarity enabled; founder, legacy, voices and intake stubbed.
   - Entry by URL/landing page, one "Start talking" button, internal lenses.
3. **Section 3 – Weaves:** automatic topic grouping across sessions.
4. **Section 4 – Orgs, roles, `phi_mode` flag.**
5. **Section 5 – Audit log, retention settings, redaction, export.**

Later, ask before starting each:
- Workspace polish: Studio, session detail, settings with memory edit and delete, delete account.
- Stripe billing.
- Scheduled phone calls: needs a Twilio upgrade, about $20, because Vapi rejects trial numbers.
- The 18+ Open mode.
- Healthcare compliance and BAAs.
- Final name and launch.

## 7. Healthcare plan ("build foundations now, sell later")

We're not handling PHI yet. Build the foundations now so we can sell later:
- orgs and roles
- audit logs
- retention policies
- a `phi_mode` flag that switches on stricter handling: no PHI in logs, redaction, restricted vendors
- export and delete

BAAs we'd need before real patient data:
- **Vapi:** HIPAA add-on, about $2,000/mo.
- **Convex:** BAA on the Professional plan, about $25/dev/mo.
- **Vercel:** BAA as a paid Pro add-on.
- **OpenAI:** BAA through sales.

Keep the LLM behind a provider interface so we can switch to a BAA-covered model.

## 8. Stack and infrastructure (no secrets here, ever)

- **Next.js** (App Router, TypeScript strict) on **Vercel**, project "dailed". Build: `vercel.json` runs `node scripts/vercel-build.mjs` (overrides the dashboard setting). Production: `npx convex deploy --cmd 'npm run build'`, then re-runs the seed. Previews: build the site only against the prod Convex URL, without the prod key and without pushing backend code; a Convex preview or dev deploy key in Vercel's Preview env would give them their own backend.
- **Convex:** database, functions, crons and HTTP. Prod deployment is `resilient-crow-586`. Use the dev deployment for all MCP work.
- **Convex Auth** with **`ConvexAuthNextjsProvider` plus middleware**. The generic provider caused a silent sign-up failure because cookies weren't set.
- **Vapi:**
  - Web SDK in the browser, loaded **only when the user clicks Start**, never on page load.
  - Server webhook at `/api/vapi/webhook`, verified with the `x-vapi-secret` header (or Bearer) against `VAPI_WEBHOOK_SECRET` (`src/lib/vapi/webhookAuth.ts`).
  - The public key is served from `/api/vapi/public-config`.
- **Remi**, Vapi assistant `f27f59c7-b119-4e6a-86d5-000b135e7336`:
  - maxDuration 5400 s; silence timeout 60 s.
  - Start-speaking: wait 0.8 s, onPunctuation 1.0, onNoPunctuation 2.5, onNumber 1.0. These were tuned because Remi was interrupting.
  - Published v6.
  - First message: "Hi, this is Remi, your AI interviewer from Warpwork. This call is recorded to make your drafts. Got a few minutes?" The app sends the first message, model and system prompt as overrides on every call, from the seeded persona (`convex/lib/remi.ts`, which reads `BRAND_NAME`), so the Vapi dashboard copy doesn't need editing.
- **OpenAI** runs the processor behind a provider interface, so another provider can be swapped in per persona. xAI works; the Anthropic adapter is still a stub.
- **Env var names:**
  - Convex: `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, `REMI_ASSISTANT_ID`, `VAPI_WEBHOOK_SECRET`, `OPENAI_API_KEY`.
  - Vercel (Production): `CONVEX_DEPLOY_KEY`, `VAPI_PUBLIC_KEY`, `VAPI_PRIVATE_KEY`, `VAPI_WEBHOOK_SECRET`.
- Later: Stripe, Twilio, Resend (email), Sentry (errors), and possibly the Vapi MCP.

### Data model (core tables)

- users
- consents (never deleted; kinds: recording / ai_calls / open_mode_18plus)
- apps/products
- personas (prompt, model, voice, max seconds, is_sensitive)
- subscriptions
- schedules
- calls (mode, channel, status, transcript, duration, cost, sensitive; from #5 also grounding counts and no_drafts_reason)
- memories (kind fact/goal/open_thread/idea/theme, importance 1–5, sensitive)
- outputs (session_summary/theme/post/script/newsletter/idea, source_excerpt, status draft/approved/exported)

Sections 3–5 add: weaves, orgs, memberships/roles and audit_log. Always derive `userId` from auth; never trust a client-supplied id.

## 9. Remi: the interview behavior

- Asks early how much time they have and respects it.
- Bird's-eye first, plus the short-answer rule and the 10–15 minute reflections from section 2.
- Warm, curious podcast-host energy. One short question at a time, turns under two sentences, and silence is fine.
- No advice, coaching or opinions.
- Closing: a one-sentence big-picture summary, a thanks, "drafts will be ready shortly," then end the call.
- The prompt gets: a session length suffix, the top 15 non-sensitive memories, the last 3 session summaries, and an optional "today's focus."
- Processor: chunked summarization for sessions over about 30 minutes, validated JSON with one retry, and no invented facts.

## 10. Costs and pricing

- **Measured:** about **$0.07/min** for browser sessions (Vapi with GPT-4.1 Mini). Plan for $0.10–0.17/min for long or phone calls. A 90-minute session costs roughly **$7–9**.
- Store `cost_usd` per call (done); the admin page shows daily and monthly totals (not built yet). Add a global daily spend cap with a pause-all switch (not built yet).
- Draft Create pricing:

  | Plan | Price | Includes | Margin at full use |
  |---|---|---|---|
  | Starter | $29/mo | 4 quick sessions | ~86% |
  | Pro | $59/mo | 8 quick sessions | ~86% |
  | Deep | $79/mo | 2 deep sessions (60 min) + 4 quick | ~80% |

- Free trial idea: 7 days, 2 sessions.
- Long deep sessions are expensive, so this will need seed funding to scale. That's expected.

## 11. Lessons learned and gotchas

- **Convex prod keys:** Convex refuses the production deploy key in preview builds (fixed in #4). A preview deploy key comes later if we want full previews.
- **Pasting the JWT private key** into a single-line env field can strip the BEGIN/END markers. Use the one-line version.
- **Copying the Vapi key:** Vapi's copy button can grab a whole block, and the key ended up pasted 3 times once. Check key *lengths*, never print values.
- **Vapi limits:** free Vapi numbers can't dial out, and Vapi rejects Twilio trial numbers.
- **Mic and SDK loading:** no mic and no SDK until Start is clicked.
- **Sign-up form:** the password must be visible with a toggle and typed twice.

## 12. Guardrails

- Never commit, log, print or echo secrets. I paste secrets myself.
- Convex MCP stays on **dev**. Production changes happen only through normal reviewed deploys.
- Consent is a launch blocker. Store the exact consent text, time, IP and device. Disclose AI and recording on every session.
- For phone calls (later): AI voices count as "artificial voice" under the TCPA. Calling hours are 8am–9pm local only, and "stop calling me" revokes consent.
- Users can view, edit and delete memories. Deleting an account removes content but keeps consent records. (Not built yet; part of workspace polish.)
- Have a lawyer review the terms, privacy policy, consent text, the 18+ mode and healthcare claims before charging anyone.

## 13. Decision log (append as we go)

- 2026-10-04: Build a suite on one engine; each product gets its own MAP.
- 2026-10-04: Moved the build from MadeThis to Claude Code (Next.js + Convex + Vercel + Vapi + OpenAI).
- 2026-10-04: Browser deep sessions come before phone calls.
- 2026-10-0x: No visible modes; one "Start talking" button; lenses stay internal.
- 2026-10-0x: "Weaves" is the feature name for cross-session topic grouping.
- 2026-10-0x: Working brand is Warpwork; Weaveworks, Heddle, Selvedge and Tapestry were rejected.
- 2026-10-0x: Healthcare = build the foundations now, sign BAAs later.
- 2026-10-10: Grounding uses close matching, not exact. A quote that can't be matched is removed and the draft stays (shown without a "You said" line).
- 2026-10-10: Previews build the site only, against prod Convex, with no prod key and no backend push. A Convex preview/dev deploy key can give them their own backend later.
- 2026-10-10: Production deploys re-run the idempotent seed so config (brand, persona prompt) reaches prod without a manual step.
- 2026-10-10: Claude opens one PR per section and waits for my OK to merge it and before starting the next section.

## 14. Open questions

- Is one 10-minute session a week enough for daily posters, or do they want shorter, more frequent ones?
- Which product launches publicly first: Create alone, or Create + Clarity?
- Final name, domain and handles.
- Beta plan: dogfood with me as user #1 (music and business), then 10 beta creators. Success gate: 6 of 10 post something from their drafts and say they'd pay.

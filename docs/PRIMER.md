# Warpwork primer: everything decided so far

*Written 2026-10-10 from my planning chat with Claude (Cowork). Read it before any work on this repo. If this primer and the repo disagree, the repo wins for **code and status**, and this primer wins for **product intent**. When you find a conflict, tell me.*

---

## Vision (read this first)

**A personal AI that calls you.** Think Grok or Claude, but it **reaches out**: it phones you, remembers you across months, and turns the conversation into something useful for you or your family.

- Talking to AI is a commodity. Being **called, remembered and followed up with** is not. That's the moat, so every decision should lean into it.
- Long term, the products merge into one assistant that already knows you. In the short term, we win specific jobs where calling matters most.
- **Daily is the wedge** (section 3): friendly check-in calls for aging parents. Create stays alive as my own tool and a side product. The other products are on hold.

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

Build the loop once. Each new product is then mostly config plus a landing page. The lead product is now **Daily** (section 3), which runs the same loop over scheduled phone calls.

Every product is planned in **MAP** format: **Market** (who it's for), **Asset** (what we build and what they get), **Promotion** (how it spreads).

## 2. Product principles (don't break these)

1. **Bird's-eye first.** Start broad and only zoom in where the user has energy. After two short or flat answers on a thread, zoom out or change area. Every 10–15 minutes, reflect the big picture back in one sentence and ask if it's right.
2. **Long sessions are the core value.** Quick is about 10 minutes; Deep is 30–90 minutes.
3. **Their words, never invented.** Outputs must be grounded in what the user said: no invented facts, numbers or stories. (Grounding uses *close* matching, not word-for-word. Speech-to-text shifts small words.)
4. **No choice overload.** One **"Start talking"** button. No visible "modes" picker. The product you entered through (URL/landing page) sets the configuration. Internally we call these **lenses**. Users never see that word.
5. **Private by default.** Transcripts, recordings and memories are visible only to their owner (or their org, under org rules).
6. **Desktop-first web app.** Designed for laptops but usable at phone width. Mobile app later.
7. **Phone first for Daily. Browser stays for Create.** Scheduled outbound phone calls are now the top build priority.
8. **Built for scale and regulated buyers.** Architecture should let us sell to healthcare later (see section 7).
9. **Honest AI.** Remi always discloses it's an AI and that the session is recorded. No advice or coaching. It draws out *their* thinking.
10. **Elder-friendly by default.**
    - Slower, clearer speech.
    - Longer patience before Remi speaks: start with a longer wait than Create's current settings and tune it with real seniors.
    - Repeats on request and never rushes.
    - Short calls (3–10 minutes) unless the parent wants to keep talking.
11. **Check-in, not care.**
    - Daily is a wellness check-in, not a medical service.
    - No diagnoses, no medical advice, and no claims that it monitors health.
    - Medication questions are self-reported only ("Did you take your morning pills?") and never instructions.
    - Every page says it is **not an emergency service**.

## 3. The suite (working ICPs and MAPs, refine as we learn)

| Product | Market (ICP) | Asset (what they get) | Promotion |
|---|---|---|---|
| **Daily** *(lead product, building next)* | Adult children of aging parents. The adult child sets it up and pays | A warm daily check-in call for the parent, and a short summary for the family | Adult children and family word of mouth; placeholder price $39/month, tested in the pilot |
| **Create** *(live; my own tool and a side product)* | Creators, DJs, coaches, solo experts who need to post but hate writing | A week of posts, short-video scripts, a newsletter and an idea bank, in their own voice | "My AI interviewed me" clips; creators post the outputs, which markets us |
| **Clarity** *(live, on hold: no new work)* | Individuals who want to think out loud: life direction, decisions, journaling without writing | Session summaries, themes over time (Weaves), open threads, private insight | Personal stories and word of mouth; "talk it out" positioning |
| **Founder** *(live, on hold: no new work)* | Early-stage founders | Investor updates, pitch narrative, decision log, weekly founder reflection | Founder communities and build-in-public posts |
| **Legacy** *(on hold)* | Older adults and families preserving life stories | A memoir/story book built from long interviews (family gift) | Gift purchases by adult children; holidays and milestones |
| **Voices** *(B2B, on hold)* | Product, research and marketing teams | AI-run customer interviews at scale, themes across interviews, quotes | Sales-led; case studies |
| **Intake** *(healthcare B2B, on hold)* | Clinics and practices | Pre-visit patient intake conversations turned into structured summaries for clinicians | Sales-led; needs BAAs and compliance first (section 7) |

**Why Daily leads:**
- Calling *is* the product, and big chat apps don't do it.
- Clear buyer (the adult child), a recurring emotional need, and low churn once the habit forms.
- The economics work: about 5 minutes a day is roughly $10–15 a month in cost, against a placeholder price of $39 a month.
- It's the natural path toward healthcare later.

Create gets no new features unless they're shared engine work. Clarity, Founder, Legacy, Voices and Intake stay as entries in the product config and aren't built further.

### Daily MVP: what to build

1. **Family setup** (web, done by the adult child):
   - The parent's name, phone number and timezone.
   - A call window (for example, 9–10am) and the days to call.
   - Topics Remi can bring up (grandkids, garden, church, sports) and topics to avoid.
   - Optional self-reported check items: meds, sleep, meals.
   - Who gets the summary (one or more family members) and how (email first; SMS later).
   - An emergency contact.
2. **Parent consent on the first call** (required, a launch blocker):
   - The adult child **cannot** consent for the parent. Calls to the parent need the parent's own consent (TCPA, AI voice).
   - The first call opens with: "Hi [name], this is Remi, an AI assistant. [Child] set up a short daily check-in call for you. I'm not a person. Calls are recorded, and a short summary goes to [child]. Is it OK if I call you each morning?"
   - Store a clear yes, plus the recording and transcript snippet, as the consent record. A no means no further calls, and the family is notified.
   - "Stop calling me" at any time revokes consent and notifies the family.
3. **The daily call:**
   - Outbound via Vapi plus a Twilio number, placed by a scheduler (a Convex cron, calling hours of 8am–9pm local only, and one retry).
   - Warm conversation with memory of the parent's life ("How did the tomatoes do?").
   - Asks the chosen check items naturally.
   - Ends kindly. The parent can talk longer if they want, with a cap per call.
4. **The family summary** (after each call):
   - Whether the call was answered, how long it lasted, and the parent's mood in their own words.
   - Check items as self-reported ("said they took their morning pills").
   - One or two highlights and anything the parent asked Remi to pass on.
   - **Privacy rule:** the parent is told what gets shared. If they say "don't tell [child] that," respect it, unless it's a safety concern.
5. **Alerts:**
   - **No answer twice in a row:** notify the family.
   - **Concerning words** (fell, can't get up, chest pain, confused, "help"): notify the family right away. If it sounds like an emergency, Remi says plainly: "Please hang up and call 911," then notifies the family. Remi never gives medical advice.
   - Keep an alert log for each family.
6. **Family dashboard** (simple): calls this week, a streak, and the latest summary. Settings for the schedule, topics, recipients and pausing.
7. **Data model additions:** `care_circles` (the family group; adult child = owner), `care_recipients` (the parent, their phone, consent status and preferences), `circle_members` (who gets summaries and alerts), `check_in_schedules`, `call_summaries`, `alerts`. Reuse `calls`, `memories` and `consents`.
8. **Ask me before adding** (paid or legal steps):
   - **Twilio upgrade.** About $20; Vapi rejects trial numbers.
   - **SMS.** US business texting needs A2P 10DLC registration, so start with email (Resend or similar) and add SMS later.
   - **Stripe** for Daily billing. The placeholder is $39/month; billing comes after the pilot proves demand.

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

- **Working brand: Warpwork.** (2–3 syllables matters for pronunciation and accessibility.) Keep it in one `BRAND_NAME` constant. **A rename is likely before launch**, so never hard-code the brand name.
- **Direction:** the brand should be a **character name people address**, like "Did ___ call you today, Mom?" The assistant and the brand may become the same name.
- **"Remi"** stays as the interviewer's in-product name for now. USPTO has many live REMI marks in software, telecom and medical classes, so it can't be the company brand. Keep the persona name in config too (`ASSISTANT_NAME`) so it can change without code edits.
- **"Dialed"** is the old codename; the repo is spelled **Dailed**. DIALED has live USPTO registrations (Class 42 #98710235, Class 9 #88340816), so it can't be the public name.
- Rejected:
  - Weaveworks: live marks in Classes 9 and 42, owned by Weaveworks Ltd (I used to work there).
  - Heddle: pending Class 42 application #99768659 by Threadline Systems.
  - Selvedge: sounds like "salvage."
  - Tapestry: Tapestry Inc. (Coach) is building AI.
- No WARPWORK/WARPWORKS marks found in my quick search. Still to do: domain and social handles, plus a proper trademark clearance before launch.
- "Suite" is the word for the product family.

## 5. Current state (2026-10-11, verify with git)

- Repo **fenuaibabao/Dailed**, live at **https://dailed.vercel.app**.
- Merged:
  - #1 Milestone 2: browser sessions, webhook, processor.
  - #2 Password show/hide toggle plus confirm-password field on sign-up.
  - #3 `.mcp.json` with Vercel and Convex MCP (dev only).
  - #4 Section 0: preview builds never use the prod Convex key; `BRAND_NAME = "Warpwork"`. First green preview. Production deploys re-run the seed, so Remi's greeting and the app name follow `BRAND_NAME`.
  - #5 Section 1: close-match grounding (`convex/lib/grounding.ts`), at least one post and one script per session of 2+ minutes or a recorded reason, per-session grounding counts. Also added this primer and `CLAUDE.md`.
  - #7 Remi turn-taking: Remi waits longer before replying, set in code (`convex/lib/turnTaking.ts`) instead of the Vapi dashboard.
  - #6 Section 2: products as configuration. Create and Clarity are live products with landing pages at `/create` and `/clarity`; Founder, Legacy, Voices and Intake show "coming soon". The session page has one Start talking button.
  - #8 Section 3: Weaves. After each session its main topics are filed into Weaves (new or existing), shown on the session page. Only sessions from #8 onward are woven.
  - #9 Section 4: workspaces, roles and `phi_mode`. Workspaces at `/app/workspaces` with owner/admin/member roles and invite codes; new sessions record the chosen workspace; health-data mode blocks sessions in that workspace until every vendor has a BAA.
  - #10 Section 5: audit log, retention, redaction, export. An append-only audit log; keep-forever by default or 30/90/365-day retention per person and per workspace, applied by a daily cleanup; optional transcript redaction (always on in health-data mode); a "Your data" page at `/app/privacy` with a full JSON download; deleting a single session.
  - #11 Founder enabled. Weekly check-in at `/founder` producing a weekly reflection, investor update, decision log, pitch narrative (when there's enough) and threads for next week; numbers the founder didn't say are flagged "[check this number]".
- All six suite sections (0 to 5) are merged.
  - #12 Redesign step 1: the style system (fonts, colors, cards, buttons, dark sidebar, phone bottom tab bar) on every page.
  - #13 Redesign step 2: Create, Clarity and Founder landing pages from one template.
  - #14 Redesign step 3: sign in, sign up and the one-time consent step. It also fixed a live bug where every sign-in or sign-up failure showed "Something went wrong on our side", and it carries the Daily-first primer update.
  - #15 Section 2 for Daily: Daily as a "coming soon" product at `/daily`, the assistant's name as config (`ASSISTANT_NAME`), and a Products menu on every product page and in the signed-in app.
- Now: Daily-first roadmap item 3, the design pass for Daily's screens, one PR each: the Daily page, then family setup, then the family dashboard. The Daily page is open as a PR and waits on my OK to merge.
- The end-to-end loop works: sign up → browser session → webhook → Convex call row → outputs. The first session ran 226 s, cost $0.26 and produced 9 outputs, but **no posts or scripts**. Drafts were dropped because quotes had to match the transcript word for word (fixed in #5; needs a live re-test).
- **Strategy changed on 2026-10-11 to Daily-first** (Vision, section 3). Weaves, workspaces/roles/`phi_mode`, the audit log and Founder were already built and live before that. They stay as they are, with no new work on them until after the Daily pilot.
- Not built yet: the admin cost page and daily spend cap (section 10), memory view/edit/delete and delete account (section 12), the Anthropic LLM adapter (stubbed; OpenAI and xAI work).

## 6. Roadmap (in order)

**Daily-first roadmap (from 2026-10-11; replaces the order below):**
1. **Finish section 1:** the grounding fix is merged (#5); what's left is a live re-test of a Create session of 2+ minutes.
2. **Finish section 2:** products as configuration. Add `daily` as a product next to `create`, plus `ASSISTANT_NAME` as config.
3. **Design pass:** only the shared style system and the screens Daily needs (landing, sign-up, family setup, dashboard). Redesign steps 1–3 below are that shared base; steps 4–7 (Create's screens) are on hold.
4. **Phone calls (Milestone 6):** after I approve the Twilio upgrade, add a number and scheduled outbound calls. Test by calling me first.
5. **Daily MVP:** items 1–6 in section 3, "Daily MVP".
6. **Pilot:** 10 families, free for one month. Track:
   - Answer rate.
   - Whether parents like it, from their own feedback on the call.
   - Whether family members open the summaries.
   - Whether families would pay $39/month.
   - **Success gate:** 5 of 10 would pay.
7. **Later, only after the pilot:** Stripe billing, HIPAA/BAAs and the other suite products. Weaves, orgs/roles/`phi_mode` and the audit log/retention/redaction were already built before this change; they stay, with no new work until after the pilot.

**Not now:** building all six products, HIPAA/BAAs, a general assistant, ads before the pilot, raising money before proof.

**Original suite roadmap (sections 1–5 all merged):**

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

**Redesign (one PR per step, desktop and phone screenshots before each merge).** Since the Daily-first change, only the shared base (steps 1–3) and the screens Daily needs are built; steps 4–7 are on hold. The visual spec is the key-screens canvas: https://claude.ai/artifact/WX93MFV33uV2XQ6nBV9Gwp (23 boards: desktop screens, landing pages, auth and a phone row). Sample names, numbers, prices and counts in it are filler: use real data, and don't build anything just because it appears in a sample.
1. Style system: colors, type, cards, buttons, dark sidebar, phone bottom nav. Applied everywhere without changing features.
2. Public pages: Create landing (`/`) and Clarity landing (`/clarity`) from the shared template.
3. Auth: sign in, sign up (eye icons, confirm password, inline errors), consent step.
4. Live session screen (dark): big current question, live transcript, Mute / Change topic / End, AI and recording label, a timer to the time the person said they have. "Big picture so far" and the Weaves panel stay hidden placeholders for now.
5. Writing your drafts → Drafts ready, then Session detail.
6. Content Studio (Copy, Download, Rewrite, Delete with Undo, Approve) and the Sessions list.
7. Home (first-time and returning) and Settings (memories edit/delete, turn off recording, delete account).
Later, with their own features: the Weaves screen (section 3) and Plans plus minutes cards (billing).

Later, ask before starting each:
- Workspace polish: Studio, session detail, settings with memory edit and delete, delete account.
- Stripe billing.
- Scheduled phone calls: now roadmap item 4 above. Still needs my OK for the Twilio upgrade, about $20, because Vapi rejects trial numbers.
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
  - Turn-taking lives in code, `convex/lib/turnTaking.ts`, sent with every call as `startSpeakingPlan`. Remi waits about 2.5 s of quiet after a finished sentence, 4 s when you trail off on "and", "because", "um" or a comma, and 1.2 s after a bare "yeah" or "no", plus a 0.8 s start delay. These are custom endpointing rules, which Vapi applies ahead of smart endpointing and the transcriber's own turn detection; the dashboard's punctuation timings (onPunctuation 1.0, onNoPunctuation 2.5, onNumber 1.0) sit below those and could be skipped, which is the likely reason Remi still interrupted.
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
- weaves and weaveLinks (section 3)
- orgs (name, phiMode, inviteCode) and memberships (role owner/admin/member); users.activeOrgId and calls.orgId (section 4)
- auditLog (append-only); retentionDays and redactTranscripts on users and orgs; calls.purgedAt (section 5)

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
- **Daily:** about 5 minutes a day costs roughly $10–15 a month per family, against a placeholder price of $39/month. Billing waits until the pilot proves demand.

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
- For phone calls: AI voices count as "artificial voice" under the TCPA. Calling hours are 8am–9pm local only, and "stop calling me" revokes consent.
- **Daily:** the parent's own consent on the first call is required; the adult child can't consent for them. Daily is not a medical or emergency service, and every Daily page says so.
- Users can view, edit and delete memories. Deleting an account removes content but keeps consent records. (Not built yet; part of workspace polish. Deleting a single session and exporting all data arrive with section 5.)
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
- 2026-10-10: Remi's turn-taking (when it starts talking) is set in code and sent on every call, not tuned in the Vapi dashboard. It errs on waiting too long rather than interrupting.
- 2026-10-10: Previews build the site only, against prod Convex, with no prod key and no backend push. A Convex preview/dev deploy key can give them their own backend later.
- 2026-10-10: Production deploys re-run the idempotent seed so config (brand, persona prompt) reaches prod without a manual step.
- 2026-10-10: Claude opens one PR per section and waits for my OK to merge it and before starting the next section.
- 2026-10-10: Products live in `src/config/products.ts`. Each landing page is `/<slug>` and the home page is Create. The product carries through sign-up as `?product=`. Session length isn't picked up front: Remi asks how much time you have (10 to 90 minutes).
- 2026-10-10: Clarity outputs are a private summary, themes and open threads, with no posts, scripts or newsletter. Clarity has its own memory, separate from Create.
- 2026-10-10: Workspaces (orgs) are optional; personal use needs none. Roles are owner, admin and member. People join with an invite code, not email. Sessions stay private to the person even inside a workspace; sharing with a team comes with Voices and Intake.
- 2026-10-10: `phi_mode` ("health-data mode") is per workspace and set by owners. Until Vapi, Convex, Vercel and the model provider have all signed BAAs, a health-data workspace can't run sessions at all. The list of BAA-covered vendors lives in code (`convex/lib/phi.ts`), so changing it is a reviewed change.
- 2026-10-10: Retention defaults to keeping everything. Deleting content keeps the session's dated row (date, length, cost) as a record; consents and the audit log are never deleted. The shorter of a person's and a workspace's limit wins.
- 2026-10-10: Redaction is pattern-based (emails and any 9+ digit run) and applied before a transcript is stored or sent to a model; with redaction on, the recording link isn't kept because the audio can't be redacted. It's a safety net, not de-identification.
- 2026-10-10: Founder outputs: weekly reflection (summary), themes, one investor update, up to 5 decisions, a pitch narrative only when there's enough, and threads for next week. No posts or scripts. Numbers in the investor update or pitch must be ones the founder said; the model is asked once more, then leftovers are flagged "[check this number]" rather than removed.
- 2026-10-10: Weaves are per person and per product. A session joins up to 3 weaves; an existing weave keeps its name and its summary is updated each time. Sensitive sessions only join sensitive weaves. Weaving runs after a session's drafts are saved, and a weaving failure never affects the drafts.
- 2026-10-11: The key-screens canvas is the visual spec for the redesign, built in 7 steps (section 6). Style: IBM Plex Sans and Mono, warm off-white background (#F2F1ED), white cards with a soft shadow, blue accent (#2F4BD8), a dark sidebar on desktop and a dark bottom tab bar on phones. The app is light-only; dark is used only for the sidebar and the live session screen. Shared pieces live in `src/app/globals.css` (tokens and `.btn`, `.card`, `.field`, `.eyebrow`) and `src/components/shell/AppShell.tsx`. Nav shows only pages that exist; Sessions, Weaves, Studio and Settings join as they're built.
- 2026-10-11: Landing pages share one template (`ProductLanding`), with each live product's copy in `src/config/landing.ts`, kept out of the backend. Copy only promises outputs the product really makes: Clarity's page offers a private summary, themes and open threads, not the design's "one-page decision brief", which would be a new feature. Pricing and the Terms, Privacy and Help links are left off until billing and those pages exist. The examples are labelled as examples and carry no made-up session times.
- 2026-10-11: Recording consent is its own one-time step at `/consent`, right after sign-up and before the first session. The session page sends anyone without consent there, and anyone who already agreed skips it. The consent sentence itself is unchanged. Sign-in and sign-up use the design's friendlier error wording. "Forgot password" is left off until password reset exists.
- 2026-10-11: Sign-in and sign-up errors must name the real problem on the live site too. Production Convex hides error messages and keeps only a ConvexError's data, and Convex Auth's Next.js proxy forwarded only the message, so every failure looked like a server error. A small patch (`patches/@convex-dev+auth+0.0.96.patch`, applied by `patch-package` on install) passes the data on; `tests/unit/authProxy.test.ts` guards it. Re-check the patch when upgrading `@convex-dev/auth`.
- 2026-10-11: Vision is "a personal AI that calls you." The moat is calling, memory and follow-up.
- 2026-10-11: Daily (check-in calls for aging parents) is the lead product. Create is the founder's tool and a side product; the others are on hold.
- 2026-10-11: Phone calls move to top priority after the grounding and config work.
- 2026-10-11: Daily is a non-medical wellness check-in. The parent's own consent is required on the first call, and every page says it's not an emergency service.
- 2026-10-11: Email summaries come first; SMS waits until A2P 10DLC registration.
- 2026-10-11: The brand will likely become a character name; `BRAND_NAME` and `ASSISTANT_NAME` stay as config.
- 2026-10-11: Weaves, workspaces/roles/`phi_mode`, the audit log and Founder were built before the Daily-first change. They stay live as they are, with no new work until after the pilot. The redesign keeps only the shared base (steps 1–3) and Daily's screens; Create's remaining screens (steps 4–7) are on hold.
- 2026-10-11: `daily` is in the product config as "coming soon" at `/daily`, with a not-an-emergency-service line on its page. It's switched on once outbound calls and family setup work. The assistant's name is `ASSISTANT_NAME` in `src/config/brand.ts`; Remi's prompt, first words and the UI read it.
- 2026-10-12: Every product landing page has a "Products" menu in the header and a list of all products in the footer, built from the product config, so new products appear on their own. Products that aren't live are marked "Soon". Clarity and Founder stay visible while on hold.
- 2026-10-14: The signed-in app lists every product too (a Products list in the sidebar, and the Products menu in the phone top bar), because the founder is usually signed in. The links go to each product's page.
- 2026-10-14: The Daily page explains the service before launch: how it works, an example family summary marked as an example, and the safety promises (the parent decides, Remi says it's an AI, a check-in not care, the parent knows what's shared). It says "coming soon" with no sign-up button until family setup exists.

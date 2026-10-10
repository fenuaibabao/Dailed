# CLAUDE.md

Every session must read `docs/PRIMER.md` first. It holds the product intent, principles, roadmap, guardrails and decision log. If the primer and the repo disagree, the repo wins for code and status and the primer wins for product intent; tell the founder about any conflict.

Keep `docs/PRIMER.md` current: update section 5 (current state) when a PR opens or merges, and add product decisions to section 13 (decision log).

Before pushing, run `npm run check` (typecheck, lint, tests, build; set a dummy `NEXT_PUBLIC_CONVEX_URL` to build without a Convex deployment). Never commit, log or print secrets.

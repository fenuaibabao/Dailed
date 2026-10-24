import { BRAND_NAME } from "./brand";

/**
 * The suite. Every product is the same interview loop with a different
 * configuration (internally a "lens"; users never see that word): who it's
 * for, what Remi focuses on, how long a session may run, which outputs come
 * back and who receives them. Enabled products get an app row and a Remi
 * persona from the seed; the rest are listed so their landing pages can say
 * "coming soon".
 */

export type OutputKind =
  | "session_summary"
  | "theme"
  | "post"
  | "script"
  | "newsletter"
  | "idea"
  | "investor_update"
  | "decision"
  | "pitch";

export type OutputTemplate = {
  kind: OutputKind;
  label: string;
  instructions: string;
  maxCount: number;
};

export type ProductConfig = {
  slug: string;
  name: string;
  enabled: boolean;
  /** One line on the landing page. */
  headline: string;
  /** Who it's for (the M in MAP). */
  audience: string;
  /** What Remi is drawing out in this product. Added to Remi's prompt. */
  interviewFocus: string;
  /** What Remi says the recording is for, in the first message. */
  recordingPurpose: string;
  /** Longest session allowed. Remi asks how much time they have and paces to it. */
  maxSessionSeconds: number;
  outputs: OutputTemplate[];
  /** Who receives the outputs. Only "self" exists until orgs (section 4). */
  recipient: "self" | "org";
  /** A plain safety line every page of this product shows, e.g. "not an emergency service". */
  disclaimer?: string;
  /**
   * Seeded with an app row and persona before launch, for work that runs
   * server side (Daily's scheduled calls), while its page still says
   * "coming soon" and browser sessions stay refused.
   */
  seededBeforeLaunch?: boolean;
};

const SUMMARY: OutputTemplate = {
  kind: "session_summary",
  label: "What you talked about",
  instructions: "A bird's-eye summary of the session in 5 to 8 sentences.",
  maxCount: 1,
};
const THEMES: OutputTemplate = {
  kind: "theme",
  label: "Big ideas",
  instructions: "3 to 5 big-picture through-lines across what they said.",
  maxCount: 5,
};

const NINETY_MINUTES = 90 * 60;

const create: ProductConfig = {
  slug: "create",
  name: `${BRAND_NAME} Create`,
  enabled: true,
  headline: "Just talk. Get a week of posts in your own words.",
  audience: "Creators, coaches and solo experts who need to post but hate writing",
  interviewFocus:
    "This is Create. Draw out stories, opinions, lessons and moments they could share publicly, so they can be turned into posts and scripts in their own words.",
  recordingPurpose: "so we can turn your words into posts",
  maxSessionSeconds: NINETY_MINUTES,
  outputs: [
    SUMMARY,
    THEMES,
    {
      kind: "post",
      label: "Posts",
      instructions:
        "Short social posts, each built on something specific the user said, with the source excerpt.",
      maxCount: 5,
    },
    {
      kind: "script",
      label: "Video scripts",
      instructions: "Hook, 3 beats, close. Under 60 seconds spoken.",
      maxCount: 2,
    },
    {
      kind: "newsletter",
      label: "Newsletter",
      instructions: "Only when the session has enough material for one.",
      maxCount: 1,
    },
    { kind: "idea", label: "Ideas for next time", instructions: "Seeds for future sessions.", maxCount: 10 },
  ],
  recipient: "self",
};

const clarity: ProductConfig = {
  slug: "clarity",
  name: `${BRAND_NAME} Clarity`,
  enabled: true,
  headline: "Talk it out. See what you really think.",
  audience: "People working through a decision, a direction or a busy mind, without writing",
  interviewFocus:
    "This is Clarity, a private reflection session. Help them think out loud about what's on their mind: decisions, direction, what's working and what isn't. Nothing from this session is meant for publishing. If they disclose abuse, a crisis or thoughts of self-harm, respond with care and suggest they reach out to someone they trust or a local crisis line.",
  recordingPurpose: "so we can write your private note",
  maxSessionSeconds: NINETY_MINUTES,
  outputs: [
    SUMMARY,
    THEMES,
    {
      kind: "idea",
      label: "Still thinking about",
      instructions: "Questions and threads worth coming back to next time.",
      maxCount: 10,
    },
  ],
  recipient: "self",
};

const founder: ProductConfig = {
  slug: "founder",
  name: `${BRAND_NAME} Founder`,
  enabled: true,
  headline: "Talk about your week. Get your update for investors.",
  audience: "Early-stage founders who owe investors updates and want a record of their decisions",
  interviewFocus:
    "This is Founder, a founder's weekly check-in. Cover the week in this rough order, following their energy: what shipped or moved forward; the numbers they track (revenue, users, growth, runway), without pressing if they'd rather not share; customers and what they learned from them; decisions they made or are weighing, and why; what's blocking them or worrying them; and what help or introductions they'd ask investors for. Near the end, ask how they're doing personally this week. Never estimate or suggest numbers yourself.",
  recordingPurpose: "so we can write your investor update and notes",
  maxSessionSeconds: NINETY_MINUTES,
  outputs: [
    {
      kind: "session_summary",
      label: "Your week",
      instructions: "How the week went, in 5 to 8 sentences.",
      maxCount: 1,
    },
    THEMES,
    {
      kind: "investor_update",
      label: "Investor update",
      instructions: "Highlights, numbers, lowlights and asks, in their voice. Only numbers they said.",
      maxCount: 1,
    },
    {
      kind: "decision",
      label: "What you decided",
      instructions: "Each decision made or being weighed, with their reasoning.",
      maxCount: 5,
    },
    {
      kind: "pitch",
      label: "Your company story",
      instructions: "Problem, solution, why now and traction, only when they talked about the company enough.",
      maxCount: 1,
    },
    { kind: "idea", label: "For next week", instructions: "Open questions and threads to pick up next week.", maxCount: 10 },
  ],
  recipient: "self",
};

function comingSoon(slug: string, label: string, headline: string, audience: string): ProductConfig {
  return {
    slug,
    name: `${BRAND_NAME} ${label}`,
    enabled: false,
    headline,
    audience,
    interviewFocus: "",
    recordingPurpose: "",
    maxSessionSeconds: NINETY_MINUTES,
    outputs: [SUMMARY, THEMES],
    recipient: "self",
  };
}

// The lead product (docs/PRIMER.md, "Daily MVP"): check-in phone calls for
// aging parents, set up by an adult child. Its page says "coming soon" until
// the pilot; it's seeded so scheduled test calls can run.
const daily: ProductConfig = {
  ...comingSoon(
    "daily",
    "Daily",
    "A friendly check-in call for your mom or dad, every day.",
    "For families with older parents",
  ),
  seededBeforeLaunch: true,
  maxSessionSeconds: 20 * 60,
  outputs: [],
  disclaimer:
    "Daily is a friendly check-in call. It is not a doctor or an emergency service. In an emergency, call 911.",
};

export const PRODUCTS = {
  create,
  daily,
  clarity,
  founder,
  legacy: comingSoon(
    "legacy",
    "Legacy",
    "Tell your stories. Keep them for the family.",
    "Older adults and families keeping their life stories",
  ),
  voices: comingSoon(
    "voices",
    "Voices",
    "Talk with lots of customers. Hear it in their words.",
    "Product, research and marketing teams",
  ),
  intake: comingSoon(
    "intake",
    "Intake",
    "A chat before the doctor visit, written up for the doctor.",
    "Clinics and practices",
  ),
} as const satisfies Record<string, ProductConfig>;

export type ProductSlug = keyof typeof PRODUCTS;

/** The product people get when they arrive without one (the home page). */
export const DEFAULT_PRODUCT: ProductSlug = "create";

export const ALL_PRODUCTS: ProductConfig[] = Object.values(PRODUCTS);
export const ENABLED_PRODUCTS: ProductConfig[] = ALL_PRODUCTS.filter((p) => p.enabled);
/** Products that get an app row and persona from the seed. */
export const SEEDED_PRODUCTS: ProductConfig[] = ALL_PRODUCTS.filter((p) => p.enabled || p.seededBeforeLaunch === true);

export function getProduct(slug: string | null | undefined): ProductConfig | null {
  if (!slug) return null;
  return ALL_PRODUCTS.find((p) => p.slug === slug) ?? null;
}

/** The product's landing page. The default product's is the home page. */
export function productPath(slug: string): string {
  return slug === DEFAULT_PRODUCT ? "/" : `/${slug}`;
}

/** An enabled product for this slug, or the default. Never throws. */
export function enabledProductOrDefault(slug: string | null | undefined): ProductConfig {
  const product = getProduct(slug);
  return product?.enabled ? product : PRODUCTS[DEFAULT_PRODUCT];
}

/** True when the product's outputs include the Founder set (investor update, decisions, pitch). */
export function producesFounderNotes(outputs: { kind: string }[]): boolean {
  return outputs.some((o) => o.kind === "investor_update");
}

/** True when the product's outputs include public drafts (posts or scripts). */
export function producesDrafts(outputs: { kind: string }[]): boolean {
  return outputs.some((o) => o.kind === "post" || o.kind === "script");
}

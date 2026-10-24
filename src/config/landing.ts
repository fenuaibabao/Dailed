import { ASSISTANT_KIND, ASSISTANT_NAME, BRAND_NAME, NOT_A_PERSON } from "./brand";

/**
 * Landing page copy, one entry per live product, plus Daily ahead of launch. Every product uses the same
 * page template (src/components/product/ProductLanding.tsx). Kept apart from
 * products.ts so marketing copy never ships to the Convex backend.
 *
 * Copy must only promise outputs the product really produces (see its
 * `outputs` in products.ts). Examples are illustrations, not real sessions.
 *
 * Write so a five-year-old could follow how it works: short sentences, everyday
 * words, no jargon. Never say "AI"; use ASSISTANT_KIND and NOT_A_PERSON.
 */

export type LandingStep = { title: string; body: string };

export type LandingExample = {
  heading: string;
  /** A line the person might say. */
  said: string;
  /** Who said it, above the quote. Defaults to "You said". */
  saidLabel?: string;
  /** What kind of output the card shows, e.g. "Instagram post". */
  outputLabel: string;
  /** The small note beside the label. Defaults to "Built only from what you said". */
  outputNote?: string;
  outputTitle?: string;
  /** Plain paragraphs, or labelled sections for structured outputs. */
  output: string | { label: string; body: string }[];
};

export type LandingCopy = {
  /** Short label for the product next to the logo. */
  shortName: string;
  eyebrow: string;
  title: string;
  intro: string;
  /** Shown instead of the sign-up button while the product isn't live. */
  comingSoon?: string;
  /** The "How it works" heading. Defaults to "Three steps. You only do the talking." */
  stepsHeading?: string;
  steps: [LandingStep, LandingStep, LandingStep];
  example?: LandingExample;
  trust: LandingStep[];
};

const R = ASSISTANT_NAME;
const KIND = ASSISTANT_KIND;

/** The same honest line on every product page. */
const NOT_A_PERSON_STEP: LandingStep = {
  title: `${R} is ${NOT_A_PERSON}`,
  body: `${R} always says so first, and says that the talk is being recorded.`,
};

export const LANDING: Record<string, LandingCopy> = {
  create: {
    shortName: "Create",
    eyebrow: "For creators and coaches",
    title: "Just talk. Get a week of posts in your own words.",
    intro: `${R} is a ${KIND}. ${R} asks you questions, and you answer out loud. Then you get your posts, video scripts and a newsletter, made only from what you said.`,
    steps: [
      {
        title: "Talk",
        body: `${R} asks how long you can talk. Then ${R} asks about your work. When you love a topic, ${R} asks more. When you don't, ${R} moves on.`,
      },
      {
        title: "Look",
        body: "Read what was made for you. Each piece shows the words you said, so it sounds like you.",
      },
      { title: "Use", body: "Copy what you like. Post it anywhere you want." },
    ],
    example: {
      heading: "What you said, and what you get",
      said: "“The owner never heard my mix. He saw the bar stay full past one.”",
      outputLabel: "Instagram post",
      output:
        "Two years of sending mixes into the void. Zero callbacks.\n\nThen one slow Tuesday: twelve people in the room, four of them dancing. I dropped my setlist and played for those four.\n\nBy midnight it was forty.\n\nThe owner never heard my mix. He saw the bar stay full past one. That night turned into my residency.\n\nIf you're trying to get booked, stop polishing the mix. Fill the room.",
    },
    trust: [
      NOT_A_PERSON_STEP,
      { title: "Only you can see it", body: "What you say and what you get belong to you. You can delete any talk, any time." },
      { title: "We never post for you", body: `${BRAND_NAME} never posts on your accounts. You choose what to share.` },
    ],
  },
  daily: {
    shortName: "Daily",
    eyebrow: "For families with older parents",
    title: "A friendly phone call for your mom or dad, every day.",
    intro: `${R} is a ${KIND}. ${R} calls your parent at a time you pick, for a short, happy chat about their day. After the call, you get a short note about how they're doing.`,
    comingSoon: "Coming soon. We're starting with a few families first.",
    stepsHeading: "Three steps. Your parent just picks up the phone.",
    steps: [
      {
        title: "Set it up",
        body: "Tell us your parent's name, phone number and a good time to call, plus what they love to talk about.",
      },
      {
        title: `${R} calls`,
        body: `On the first call, ${R} says it's ${NOT_A_PERSON}, and asks your parent: "Can I call you each day?" Only your parent can say yes.`,
      },
      {
        title: "You hear how it went",
        body: `After each call, you get a short note: how they sounded, what they talked about, and anything they asked ${R} to tell you.`,
      },
    ],
    example: {
      heading: "What your parent says, and what you get",
      saidLabel: "Your mom said",
      said: "“The tomatoes finally came in. I gave a whole bag to Linda next door.”",
      outputLabel: "Family note",
      outputNote: "Just an example, not a real call",
      output: [
        { label: "The call", body: "She picked up at 9:10am and talked for 6 minutes. She sounded happy." },
        { label: "Highlights", body: "She picked her first tomatoes and shared them with Linda next door." },
        { label: "She said", body: "She slept well and took her morning pills." },
        { label: "She wants you to know", body: "She's asking if you're still coming on Sunday." },
      ],
    },
    trust: [
      {
        title: "Your parent decides",
        body: `${R} only keeps calling if your parent says yes. They can say "stop calling" any time, and we'll tell you.`,
      },
      {
        title: `${R} is ${NOT_A_PERSON}`,
        body: `${R} never pretends to be a person. ${R} says so on every call, and says the call is recorded.`,
      },
      {
        title: "A check-in, not a doctor",
        body: `${R} never gives medical advice. If something sounds like an emergency, ${R} tells your parent to hang up and call 911, then tells you.`,
      },
      {
        title: "Your parent knows what you'll see",
        body: `${R} tells your parent what goes in your note. If they ask ${R} to keep something private, ${R} does, unless it's about their safety.`,
      },
    ],
  },
  clarity: {
    shortName: "Clarity",
    eyebrow: "For big choices and busy minds",
    title: "Talk it out. See what you really think.",
    intro: `${R} is a ${KIND}. ${R} helps you think out loud. ${R} asks what matters to you, notices what you keep coming back to, and writes you a private note from what you said.`,
    steps: [
      {
        title: "Talk",
        body: `Tell ${R} what's on your mind. ${R} asks how long you can talk, then asks the kind of questions a good friend would.`,
      },
      {
        title: "Look",
        body: "Read your private note: the big ideas you kept coming back to, and the questions you still have.",
      },
      {
        title: "Come back",
        body: `Keep it to yourself, or share it with someone you trust. Next time, ${R} remembers where you left off.`,
      },
    ],
    example: {
      heading: "What you said, and what you get",
      said: "“I keep saying I want stability, but every time I picture staying I feel flat.”",
      outputLabel: "Private note",
      outputTitle: "Take the new job, or stay?",
      output: [
        {
          label: "What you talked about",
          body: "You talked about a job in another city. You said you want things to stay steady, but only when you talked about what other people expect. You sounded excited every time you talked about the new team.",
        },
        { label: "Big ideas", body: "Growing matters more than staying put, for now. Worry about letting people down. Timing." },
        { label: "Still thinking about", body: "Have you asked your partner what they want, not just what they'll accept?" },
      ],
    },
    trust: [
      {
        title: `${R} is ${NOT_A_PERSON}`,
        body: `${R} isn't a therapist and doesn't give advice. ${R} always says so first, and says that the talk is being recorded.`,
      },
      { title: "Only you can see it", body: "What you say and your notes belong to you. You can delete any talk, any time." },
      { title: "We never share it for you", body: `${BRAND_NAME} never sends your notes to anyone. You decide who sees them.` },
    ],
  },
  founder: {
    shortName: "Founder",
    eyebrow: "For people starting a company",
    title: "Talk about your week. Get your update for investors.",
    intro: `${R} is a ${KIND}. Once a week, ${R} asks how your company is going, and you answer out loud. Then you get a note about your week, an update for the people who invested, a list of what you decided and why, and your company's story when there's enough to tell.`,
    steps: [
      {
        title: "Talk",
        body: `${R} asks what changed, your numbers, what customers taught you, what you decided and what's in your way.`,
      },
      {
        title: "Look",
        body: "Read your investor update and your list of choices. If a number shows up that you didn't say, it's marked so you can check it.",
      },
      { title: "Send", body: "Copy the update into an email and send it yourself." },
    ],
    trust: [
      NOT_A_PERSON_STEP,
      { title: "Only you can see it", body: "What you say, your numbers and your notes belong to you. You can delete any talk, any time." },
      { title: "We never send it for you", body: `${BRAND_NAME} never emails your investors. You choose what to send and when.` },
    ],
  },
};

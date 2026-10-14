import { ASSISTANT_NAME, BRAND_NAME } from "./brand";

/**
 * Landing page copy, one entry per live product, plus Daily ahead of launch. Every product uses the same
 * page template (src/components/product/ProductLanding.tsx). Kept apart from
 * products.ts so marketing copy never ships to the Convex backend.
 *
 * Copy must only promise outputs the product really produces (see its
 * `outputs` in products.ts). Examples are illustrations, not real sessions.
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

const AI_DISCLOSURE = `${ASSISTANT_NAME} says it's an AI at the start of every session, and that the session is recorded.`;

export const LANDING: Record<string, LandingCopy> = {
  create: {
    shortName: "Create",
    eyebrow: "For creators and coaches",
    title: "Talk it through. Get a week of posts in your own words.",
    intro:
      `${ASSISTANT_NAME}, an AI interviewer, asks you good questions out loud. Afterwards you get a private summary and drafts of posts, short video scripts and a newsletter, built only from what you said.`,
    steps: [
      {
        title: "Talk",
        body: `${ASSISTANT_NAME} asks how much time you have, then asks about your work. It goes deeper where you have energy and moves on when you don't.`,
      },
      {
        title: "Review",
        body: "Read your summary and drafts. Each one sits next to the words it came from, so it sounds like you.",
      },
      { title: "Use", body: "Copy what you like and post it wherever you post." },
    ],
    example: {
      heading: "What you said, and what you get",
      said: "“The owner never heard my mix. He saw the bar stay full past one.”",
      outputLabel: "Instagram post",
      output:
        "Two years of sending mixes into the void. Zero callbacks.\n\nThen one slow Tuesday: twelve people in the room, four of them dancing. I dropped my setlist and played for those four.\n\nBy midnight it was forty.\n\nThe owner never heard my mix. He saw the bar stay full past one. That night turned into my residency.\n\nIf you're trying to get booked, stop polishing the mix. Fill the room.",
    },
    trust: [
      { title: `${ASSISTANT_NAME} is an AI`, body: `Not a person. ${AI_DISCLOSURE}` },
      {
        title: "Private to you",
        body: "Your sessions, summaries and drafts are yours alone. Delete any session, any time.",
      },
      {
        title: "Nothing is posted for you",
        body: `${BRAND_NAME} never posts on your accounts. You choose what to use and where.`,
      },
    ],
  },
  daily: {
    shortName: "Daily",
    eyebrow: "For families with aging parents",
    title: "A friendly phone call for your mom or dad, every day.",
    intro:
      `${ASSISTANT_NAME}, an AI, calls your parent at a time you choose for a short, warm chat about their day. Afterwards you get a short summary, so you know how they're doing on the days you can't call.`,
    comingSoon: "Coming soon. We're starting with a small group of families.",
    stepsHeading: "Three steps. Your parent just answers the phone.",
    steps: [
      {
        title: "Set it up",
        body: "Add your parent's name, phone number and the best time to call, plus what they love to talk about.",
      },
      {
        title: `${ASSISTANT_NAME} calls`,
        body: `On the first call, ${ASSISTANT_NAME} says it's an AI and asks your parent if it can keep calling. Only your parent can say yes.`,
      },
      {
        title: "You hear how it went",
        body: `After each call you get a short summary: how they sounded, what they talked about, and anything they asked ${ASSISTANT_NAME} to pass on.`,
      },
    ],
    example: {
      heading: "What your parent says, and what you get",
      saidLabel: "Your mom said",
      said: "“The tomatoes finally came in. I gave a whole bag to Linda next door.”",
      outputLabel: "Family summary",
      outputNote: "An example, not a real call",
      output: [
        { label: "The call", body: "Answered at 9:10am and talked for 6 minutes. She sounded cheerful." },
        { label: "Highlights", body: "Picked her first tomatoes and shared them with her neighbor Linda." },
        { label: "She said", body: "She slept well and took her morning pills." },
        { label: "Passing on", body: "She wants to know if you're still coming on Sunday." },
      ],
    },
    trust: [
      {
        title: "Your parent decides",
        body: `Calls only continue after your parent says yes on the first call. They can tell ${ASSISTANT_NAME} to stop at any time, and you'll be told.`,
      },
      {
        title: `${ASSISTANT_NAME} is an AI`,
        body: `${ASSISTANT_NAME} never pretends to be a person. It says it's an AI and that calls are recorded.`,
      },
      {
        title: "A check-in, not care",
        body: `${ASSISTANT_NAME} never gives medical advice. If something sounds like an emergency, it tells your parent to hang up and call 911, then lets you know.`,
      },
      {
        title: "Your parent knows what you'll see",
        body: `${ASSISTANT_NAME} tells your parent what goes in your summary. If they ask to keep something private, it stays private, unless it's about their safety.`,
      },
    ],
  },
  clarity: {
    shortName: "Clarity",
    eyebrow: "For big decisions and busy minds",
    title: "Talk it through. See what you really think.",
    intro:
      `${ASSISTANT_NAME}, an AI interviewer, helps you think out loud about what's on your mind. It asks what matters, notices what you keep coming back to, and writes you a private summary from what you said.`,
    steps: [
      {
        title: "Talk",
        body: `Tell ${ASSISTANT_NAME} what's on your mind. It asks how much time you have, then asks the questions a good friend would.`,
      },
      {
        title: "Review",
        body: "Read your private summary, the themes you kept coming back to, and the threads that are still open.",
      },
      {
        title: "Come back",
        body: `Keep it for yourself, or copy it to share with someone you trust. ${ASSISTANT_NAME} remembers where you left off next time.`,
      },
    ],
    example: {
      heading: "What you said, and what you get",
      said: "“I keep saying I want stability, but every time I picture staying I feel flat.”",
      outputLabel: "Private summary",
      outputTitle: "Take the new role, or stay?",
      output: [
        {
          label: "Summary",
          body: "You talked through a job offer in another city. You said stability three times, but only when talking about other people's expectations. Your energy rose every time you described the new team.",
        },
        { label: "Themes", body: "Growth over stability for now. Fear of letting people down. Timing." },
        { label: "Still open", body: "Have you asked your partner what they want, not what they'll accept?" },
      ],
    },
    trust: [
      { title: `${ASSISTANT_NAME} is an AI`, body: `Not a person, and not therapy or professional advice. ${AI_DISCLOSURE}` },
      {
        title: "Private to you",
        body: "Your sessions and summaries are yours alone. Delete any session, any time.",
      },
      {
        title: "Nothing is shared for you",
        body: `${BRAND_NAME} never sends your summary to anyone. You decide if and with whom.`,
      },
    ],
  },
  founder: {
    shortName: "Founder",
    eyebrow: "For early-stage founders",
    title: "Talk through the week. Get your investor update.",
    intro:
      `${ASSISTANT_NAME}, an AI interviewer, runs your weekly check-in out loud. Afterwards you get a weekly reflection, an investor update, a log of your decisions and why you made them, and a pitch narrative when there's enough to tell.`,
    steps: [
      {
        title: "Talk",
        body: `${ASSISTANT_NAME} asks what moved, the numbers you track, what customers taught you, what you decided and what's in the way.`,
      },
      {
        title: "Review",
        body: "Read your investor update and decision log. Any number you didn't actually say is flagged for you to check.",
      },
      { title: "Send", body: "Copy the update into your email and send it yourself." },
    ],
    trust: [
      { title: `${ASSISTANT_NAME} is an AI`, body: `Not a person. ${AI_DISCLOSURE}` },
      {
        title: "Private to you",
        body: "Your sessions, numbers and notes are yours alone. Delete any session, any time.",
      },
      {
        title: "Nothing is sent for you",
        body: `${BRAND_NAME} never emails your investors. You choose what to send and when.`,
      },
    ],
  },
};

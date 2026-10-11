import { BRAND_NAME } from "./brand";

/**
 * Landing page copy, one entry per live product. Every product uses the same
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
  /** What kind of output the card shows, e.g. "Instagram post". */
  outputLabel: string;
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
  steps: [LandingStep, LandingStep, LandingStep];
  example?: LandingExample;
  trust: LandingStep[];
};

const AI_DISCLOSURE = "Remi says it's an AI at the start of every session, and that the session is recorded.";

export const LANDING: Record<string, LandingCopy> = {
  create: {
    shortName: "Create",
    eyebrow: "For creators and coaches",
    title: "Talk it through. Get a week of posts in your own words.",
    intro:
      "Remi, an AI interviewer, asks you good questions out loud. Afterwards you get a private summary and drafts of posts, short video scripts and a newsletter, built only from what you said.",
    steps: [
      {
        title: "Talk",
        body: "Remi asks how much time you have, then asks about your work. It goes deeper where you have energy and moves on when you don't.",
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
      { title: "Remi is an AI", body: `Not a person. ${AI_DISCLOSURE}` },
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
  clarity: {
    shortName: "Clarity",
    eyebrow: "For big decisions and busy minds",
    title: "Talk it through. See what you really think.",
    intro:
      "Remi, an AI interviewer, helps you think out loud about what's on your mind. It asks what matters, notices what you keep coming back to, and writes you a private summary from what you said.",
    steps: [
      {
        title: "Talk",
        body: "Tell Remi what's on your mind. It asks how much time you have, then asks the questions a good friend would.",
      },
      {
        title: "Review",
        body: "Read your private summary, the themes you kept coming back to, and the threads that are still open.",
      },
      {
        title: "Come back",
        body: "Keep it for yourself, or copy it to share with someone you trust. Remi remembers where you left off next time.",
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
      { title: "Remi is an AI", body: `Not a person, and not therapy or professional advice. ${AI_DISCLOSURE}` },
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
      "Remi, an AI interviewer, runs your weekly check-in out loud. Afterwards you get a weekly reflection, an investor update, a log of your decisions and why you made them, and a pitch narrative when there's enough to tell.",
    steps: [
      {
        title: "Talk",
        body: "Remi asks what moved, the numbers you track, what customers taught you, what you decided and what's in the way.",
      },
      {
        title: "Review",
        body: "Read your investor update and decision log. Any number you didn't actually say is flagged for you to check.",
      },
      { title: "Send", body: "Copy the update into your email and send it yourself." },
    ],
    trust: [
      { title: "Remi is an AI", body: `Not a person. ${AI_DISCLOSURE}` },
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

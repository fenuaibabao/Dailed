// A stand-in for the first real session (226 seconds, 9 outputs, no posts or
// scripts). The real transcript lives on Convex, which tests can't reach, so
// this one is written in the same Vapi format ("AI:" / "User:" lines) with the
// same kind of speech-to-text noise: fillers, dropped small words, run-ons.
export const SESSION_226_SECONDS = 226;

export const SESSION_226_TRANSCRIPT = [
  "AI: Hi, this is Remi, your AI interviewer from Warpwork. This call is recorded to make your drafts. Got a few minutes?",
  "User: Yeah, I've got a few minutes. Um, I wanted to talk about the app I'm building actually.",
  "AI: Great. What is it, in a sentence?",
  "User: So it's an AI that calls you and, uh, interviews you, and then it turns what you said into posts and scripts in your own words.",
  "AI: Why build that?",
  "User: Because I have all these ideas when I'm talking but the second I sit down to write I freeze up. Like the blank page just kills it for me.",
  "AI: When did you notice that?",
  "User: Honestly when I was doing sales calls. I'd explain something really well on the phone and then I'd try to write the same thing in a LinkedIn post and it came out stiff and corporate.",
  "AI: What's been hardest about building it so far?",
  "User: The hardest part has been the plumbing, like getting the sign in to work and the webhooks and all that, not the AI part at all. The AI part was kind of the easy bit.",
  "AI: Who is it for?",
  "User: People who are good at talking but hate writing. Founders, coaches, salespeople. Anyone who's like, I know what I think, I just can't get it on the page.",
  "AI: What would success look like in a month?",
  "User: If I'm posting three times a week without writing anything from scratch, and the posts actually sound like me, that's the win.",
  "AI: Thanks, that's a great place to stop for today.",
  "User: Cool, thanks Remi.",
].join("\n");

/**
 * What the model returned, roughly: the quotes are close to what the user
 * said but tidied up, which the old exact-match check rejected.
 */
export const SESSION_226_MODEL_REPLY = {
  session_summary: "You talked about the app you're building and why talking comes easier to you than writing.",
  themes: ["Talking beats writing", "Plumbing is harder than AI", "Sounding like yourself"],
  posts: [
    {
      platform: "linkedin",
      title: "The blank page",
      body: "I have my best ideas out loud. The second I sit down to write, I freeze.",
      // Tidied: "I'm talking but" → "I'm talking, but", "freeze up" kept, "Like" dropped.
      source_excerpt:
        "I have all these ideas when I'm talking, but the second I sit down to write I freeze up. The blank page just kills it for me.",
    },
    {
      platform: "x",
      title: "Plumbing first",
      body: "Building an AI product: the AI was the easy part. Sign-in and webhooks were the hard part.",
      // Paraphrase of one moment, not a quote.
      source_excerpt: "The plumbing, sign in and webhooks, was harder than the AI part, which was the easy bit.",
    },
  ],
  scripts: [
    {
      title: "Why I'm building this",
      hook: "I explain things well on the phone and terribly in writing.",
      beats: [
        "On sales calls I'd nail the explanation.",
        "Then I'd write the same thing as a post and it came out stiff.",
        "So I'm building an AI that interviews you and writes in your words.",
      ],
      close: "If you can say it, you can post it.",
      // One word changed ("explained") and "really" dropped.
      source_excerpt:
        "I'd explained something well on the phone and then I'd try to write the same thing in a LinkedIn post and it came out stiff and corporate",
    },
  ],
  newsletter: null,
  ideas: ["Who the first ten users should be", "What 'sounds like me' means", "Pricing"],
  memories: [{ kind: "goal", content: "Post three times a week without writing from scratch", importance: 5 }],
  no_drafts_reason: null,
};

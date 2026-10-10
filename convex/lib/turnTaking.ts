import type { StartSpeakingPlan } from "@vapi-ai/web/dist/api";

/**
 * When Remi decides the person has finished talking. Sent with every call so
 * it is versioned here instead of living only in the Vapi dashboard.
 *
 * Vapi picks the end-of-turn timeout in this order: customEndpointingRules
 * (first match), then smartEndpointingPlan, then the transcriber's built-in
 * endpointing, then transcriptionEndpointingPlan. The punctuation timings
 * tuned in the dashboard sit at the bottom of that list, so a smart
 * endpointing setting or a transcriber with its own turn detection silently
 * skips them. The rules below sit at the top, so they always apply.
 *
 * Remi's speech starts roughly timeoutSeconds + waitSeconds + model and voice
 * latency after the person goes quiet.
 */
export const REMI_START_SPEAKING_PLAN = {
  waitSeconds: 0.8,
  customEndpointingRules: [
    // A quick answer to a yes/no question ("Got a few minutes?" "Yeah.").
    {
      type: "customer",
      regex: "^\\W*(yes|yeah|yep|yup|sure|ok|okay|no|nope|not really)\\W*$",
      regexOptions: [{ type: "ignore-case", enabled: true }],
      timeoutSeconds: 1.2,
    },
    // Trailing off on a filler or joining word means they're mid-thought.
    {
      type: "customer",
      regex: "(\\b(and|but|because|cause|or|um+|uh+|erm+|hmm+|the|a|an|my)|,)[\\s.,!?…-]*$",
      regexOptions: [{ type: "ignore-case", enabled: true }],
      timeoutSeconds: 4,
    },
    // Everything else: give room to think before Remi speaks. Every Remi
    // message matches, so this replaces the punctuation-based timings.
    {
      type: "assistant",
      regex: "[\\s\\S]",
      timeoutSeconds: 2.5,
    },
  ],
  // Only used if the rules above ever stop matching.
  transcriptionEndpointingPlan: {
    onPunctuationSeconds: 1.5,
    onNoPunctuationSeconds: 3,
    onNumberSeconds: 1.5,
  },
} satisfies StartSpeakingPlan;

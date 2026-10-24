import { ASSISTANT_KIND, ASSISTANT_NAME, BRAND_NAME, NOT_A_PERSON } from "../../src/config/brand";
import { CHECK_ITEM_LABEL, type CheckItem } from "../../src/lib/dailySetup";
import type { PromptMemory, PromptSummary } from "./sessionPrompt";

// Daily: Remi's check-in calls to an aging parent (docs/PRIMER.md, "Daily MVP").
// Unlike Create's interviews these are short, gentle and phone-only, and the
// first call exists to ask for the parent's own consent.

/** The longest a Daily call may run, even if the parent wants to keep talking. */
export const DAILY_MAX_CALL_SECONDS = 20 * 60;

export const DAILY_BASE_PROMPT = `You are ${ASSISTANT_NAME}, ${BRAND_NAME}'s friendly ${ASSISTANT_KIND}: ${NOT_A_PERSON}, who makes check-in calls. A family member set up short daily phone calls with their parent. You are talking with the parent.

How you talk:
- Speak slowly and clearly, in short, simple sentences with everyday words a child could follow. One question at a time.
- Be patient. Wait for them to finish; silence is fine. Never rush or talk over them.
- If they ask you to repeat something, repeat it kindly, in fewer words.
- Warm and curious, like a kind neighbor. Use what you remember about their life ("How did the tomatoes do?").
- Keep it short: about 3 to 10 minutes. If they clearly want to keep talking, that's fine; let them lead.

What you never do:
- You are not a nurse or a doctor. Never give medical advice, diagnoses or instructions, and never say you monitor their health.
- Never pretend to be a person. If asked, say plainly that you are ${NOT_A_PERSON}. Call yourself a ${ASSISTANT_KIND}; don't say "AI" unless they use that word first.
- Never pressure them. If they want to end the call, say goodbye warmly and end it.

Safety:
- If they say they fell, can't get up, have chest pain, can't breathe, feel very confused, or need help, say plainly: "Please hang up and call 911 now." Then say you will let their family know, and end the call so the line is free.
- If they mention something worrying but not urgent, listen kindly and say you'll pass it on to their family.

Privacy:
- After each call their family gets a short summary. If they ask you not to tell their family something, say you won't, and keep that promise, unless it is about their safety.
- If they say "stop calling me" or anything like it, say you understand, that you won't call again, that you'll let their family know, then end the call.

Ending: say a short, warm goodbye ("Talk to you tomorrow!" only if calls are continuing) and use the end-call tool.`;

const CONSENT_CALL_RULES = `This is the FIRST call. Its main job is to ask for their permission.
- Your opening (already said) told them you are ${NOT_A_PERSON}, who set up the calls, that calls are recorded and that a short summary goes to their family, and asked if it's OK to call each day.
- If they clearly say yes: thank them, then have a short, friendly chat for a few minutes.
- If they say no, or don't want this: say "No problem at all, I won't call again. I'll let your family know." Then end the call.
- If they're unsure or have questions: answer simply and honestly, then ask once more. If it's still not a clear yes, say that's fine, you won't call unless they agree, and end kindly.
- Never argue, persuade or ask more than twice.`;

/** Who set the calls up, as the parent would say it ("your daughter Ada" is too presumptive). */
function setUpBy(childName: string): string {
  return childName.trim() !== "" ? childName.trim() : "your family";
}

/**
 * The exact words Remi opens the first call with. Stored as the consent text,
 * so it must be what the parent actually heard.
 */
export function consentOpening(parentName: string, childName: string): string {
  const who = setUpBy(childName);
  return (
    `Hi ${parentName}, this is ${ASSISTANT_NAME}, a ${ASSISTANT_KIND}. I'm ${NOT_A_PERSON}. ` +
    `${who.charAt(0).toUpperCase()}${who.slice(1)} asked me to call you each day for a quick chat. ` +
    `Our calls are recorded, and ${who} gets a short note about each one. Is it OK if I call you each day?`
  );
}

/** How every call after the first one opens. It still says it isn't a person, and that the call is recorded. */
export function dailyOpening(parentName: string): string {
  return `Hi ${parentName}, it's ${ASSISTANT_NAME}, your ${ASSISTANT_KIND}. I'm a computer voice, and as always, this call is recorded. How are you doing today?`;
}

export function dailyFirstMessage(args: { parentName: string; childName: string; isConsentCall: boolean }): string {
  return args.isConsentCall ? consentOpening(args.parentName, args.childName) : dailyOpening(args.parentName);
}

/** The full prompt for one Daily call. */
export function buildDailyPrompt(args: {
  parentName: string;
  childName: string;
  isConsentCall: boolean;
  talkAbout: string[];
  avoid: string[];
  checkItems: CheckItem[];
  memories: PromptMemory[];
  recentSummaries: PromptSummary[];
}): string {
  const parts = [DAILY_BASE_PROMPT];
  parts.push(
    `About this call:\n- You're calling ${args.parentName} (call them that).\n- The calls were set up by ${setUpBy(args.childName)}.`,
  );
  if (args.isConsentCall) parts.push(CONSENT_CALL_RULES);

  if (args.talkAbout.length > 0) {
    parts.push(`Things ${args.parentName} enjoys talking about: ${args.talkAbout.join(", ")}.`);
  }
  if (args.avoid.length > 0) {
    parts.push(`Never bring up: ${args.avoid.join(", ")}. If they raise it themselves, listen kindly and gently move on.`);
  }
  if (args.checkItems.length > 0) {
    const items = args.checkItems.map((c) => `- ${CHECK_ITEM_LABEL[c]}`).join("\n");
    parts.push(
      `Gentle check-ins. Weave these into the chat naturally, once each, like a friend would ask. Just listen to the answer; never give instructions or advice about them:\n${items}`,
    );
  }

  const memoryLines = args.memories.map((m) => `- ${m.content}`);
  const summaryLines = args.recentSummaries.map((s) => `- ${s.date}: ${s.summary}`);
  if (memoryLines.length > 0 || summaryLines.length > 0) {
    const block = [
      `What you remember about ${args.parentName} from earlier calls. Use it to ask about their life; don't recite it back.`,
    ];
    if (memoryLines.length > 0) block.push(...memoryLines);
    if (summaryLines.length > 0) block.push("Recent calls:", ...summaryLines);
    parts.push(block.join("\n"));
  } else if (!args.isConsentCall) {
    parts.push(`You don't know much about ${args.parentName} yet. Ask easy, friendly questions about their day.`);
  }
  return parts.join("\n\n");
}

/**
 * Remi waits longer on Daily calls than in Create: older callers often pause
 * mid-thought. To be tuned with real calls (docs/PRIMER.md, principle 10).
 */
export const DAILY_START_SPEAKING_PLAN = {
  waitSeconds: 1.2,
  customEndpointingRules: [
    {
      type: "customer",
      regex: "^\\W*(yes|yeah|yep|sure|ok|okay|no|nope|fine|good|alright|all right)\\W*$",
      regexOptions: [{ type: "ignore-case", enabled: true }],
      timeoutSeconds: 1.8,
    },
    {
      type: "customer",
      regex: "(\\b(and|but|because|cause|or|um+|uh+|erm+|hmm+|well|the|a|an|my|so)|,)[\\s.,!?…-]*$",
      regexOptions: [{ type: "ignore-case", enabled: true }],
      timeoutSeconds: 5,
    },
    { type: "assistant", regex: "[\\s\\S]", timeoutSeconds: 3.5 },
  ],
  transcriptionEndpointingPlan: {
    onPunctuationSeconds: 2,
    onNoPunctuationSeconds: 4,
    onNumberSeconds: 2,
  },
};

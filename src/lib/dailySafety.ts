// Safety checks on what the parent said during a Daily call. These are plain
// word lists on purpose: they run alongside the model's reading of the call,
// so a family is alerted even if the model misses something. A false alarm
// costs a text to a worried child; a missed fall costs much more.

/** Words that mean the family should hear right away. Checked on the parent's lines only. */
export const CONCERN_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "a fall", pattern: /\b(i|i've|i have|i just|she|he)\s+(fell|fallen|had a fall)\b|\bfell (down|over)\b|\btook a (fall|tumble)\b/i },
  { label: "can't get up", pattern: /\b(can'?t|cannot|couldn'?t) get up\b/i },
  { label: "chest pain", pattern: /\bchest (pain|hurts|is hurting|pressure|tight)/i },
  { label: "trouble breathing", pattern: /\b(can'?t|cannot|hard to|trouble) breath(e|ing)\b|\bshort of breath\b/i },
  { label: "confusion", pattern: /\b(i'?m|i am|feel|feeling) (so )?(confused|lost)\b|\bdon'?t know where i am\b/i },
  { label: "a call for help", pattern: /\bhelp me\b|\bi need help\b|\bcall (an )?ambulance\b|\bcall 911\b/i },
  { label: "a stroke sign", pattern: /\b(face|arm) (is )?(drooping|numb|went numb)\b|\bslurr(ed|ing)\b/i },
];

/** Labels of every concern pattern found in the parent's own words. */
export function findConcerns(parentSpeech: string): string[] {
  return CONCERN_PATTERNS.filter((c) => c.pattern.test(parentSpeech)).map((c) => c.label);
}

/**
 * Whether the parent asked Daily to stop calling. A backstop for the model:
 * "stop calling me", "don't call me again", "take me off".
 */
export function asksToStop(parentSpeech: string): boolean {
  return /\b(stop|quit) calling( me\b|\s*([.!?,]|$))|\b(don'?t|do not|never) call (me )?(again|anymore|any more)\b|\btake me off\b|\bno more calls\b/im.test(
    parentSpeech,
  );
}

/** Lowercase words only, so a quote can be found in a transcript despite punctuation. */
export function normalizeWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `quote` appears in `speech`, ignoring case, punctuation and spacing. */
export function containsQuote(speech: string, quote: string): boolean {
  const q = normalizeWords(quote);
  return q !== "" && ` ${normalizeWords(speech)} `.includes(` ${q} `);
}

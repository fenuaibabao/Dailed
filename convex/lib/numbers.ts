// Founder outputs quote numbers (revenue, users, runway). A number the
// person didn't say must not slip into an investor update, so every number
// in the text is looked up in their own words. Unmatched ones are flagged
// in place for them to check, rather than silently trusted or removed.

export const CHECK_MARK = " [check this number]";

// 1, 12, 1,200, 3.5, 40% ($ and suffixes stay outside the match).
const NUMBER = /\d+(?:[.,]\d+)*/g;

function normalize(token: string): string {
  // "1,200" and "1200" are the same number; "3.50" and "3.5" too.
  const plain = token.replace(/,(?=\d{3}\b)/g, "");
  return plain.includes(".") ? plain.replace(/\.?0+$/, "") : plain;
}

function spokenNumbers(speech: string): Set<string> {
  return new Set(Array.from(speech.matchAll(NUMBER), (m) => normalize(m[0])));
}

/** Numbers in the text the person never said. Single digits are ignored (lists, "2 things"). */
export function unmatchedNumbers(text: string, speech: string): string[] {
  const said = spokenNumbers(speech);
  const missing = new Set<string>();
  for (const m of text.matchAll(NUMBER)) {
    const n = normalize(m[0]);
    if (n.replace(/\D/g, "").length < 2) continue;
    if (!said.has(n)) missing.add(m[0]);
  }
  return [...missing];
}

/** Flags each number the person didn't say, right after it (and any %, k, M or B). */
export function flagUnmatchedNumbers(text: string, speech: string): { text: string; flagged: number } {
  const missing = new Set(unmatchedNumbers(text, speech));
  if (missing.size === 0) return { text, flagged: 0 };
  let flagged = 0;
  const result = text.replace(/\d+(?:[.,]\d+)*(?:\s?(?:%|percent|[kKmMbB]\b))?/g, (match) => {
    const number = /\d+(?:[.,]\d+)*/.exec(match)![0];
    if (!missing.has(number)) return match;
    flagged++;
    return match + CHECK_MARK;
  });
  return { text: result, flagged };
}

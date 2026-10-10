// Checks a draft's source_excerpt against what the user actually said.
//
// Speech-to-text and models both shift small words, so an exact match is too
// strict. A quote is kept when it matches, fixed when it is close to (or a
// clear paraphrase of) a specific stretch of the user's speech, and dropped
// otherwise. A fixed quote is replaced by the user's own words from the
// transcript, so what we show as "You said" is always something they said.

/** Share of matching words (in order) for a quote to count as the same passage. */
export const SIMILARITY_THRESHOLD = 0.85;
/** A changed quote still counts when this many consecutive words are really theirs. */
export const MIN_RUN_WORDS = 8;
/** Share of a quote's content words found close together for it to count as a paraphrase. */
export const PARAPHRASE_COVERAGE = 0.75;
/** Fewer words than this can't identify a moment. */
export const MIN_QUOTE_WORDS = 4;
const MIN_PARAPHRASE_CONTENT_WORDS = 4;

// Transcribers and models disagree on fillers; they never carry meaning here.
const FILLER_WORDS = new Set(["um", "umm", "uh", "uhh", "er", "erm", "ah", "hmm", "mm", "mhm"]);

const STOP_WORDS = new Set(
  (
    "a an and are as at be been but by can could did do does for from had has have he her his i if in " +
    "into is it it's its just me my of on or our really she so that that's the their them then there " +
    "they this to too us very was we were what when which who will with would you your i'm i've i'd " +
    "don't didn't can't won't not no yes yeah like kind sort get got going gonna want wanna thing things"
  ).split(" "),
);

type Token = { norm: string; start: number; end: number };

/** Words with their offsets in the original text, ignoring case, punctuation and fillers. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/[a-z0-9'‘’]+/gi)) {
    const norm = match[0].toLowerCase().replace(/[‘’]/g, "'").replace(/^'+|'+$/g, "");
    if (norm === "" || FILLER_WORDS.has(norm)) continue;
    tokens.push({ norm, start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

function lcsLength(a: string[], b: string[]): number {
  let prev = new Array<number>(b.length + 1).fill(0);
  for (const word of a) {
    const row = new Array<number>(b.length + 1).fill(0);
    for (let j = 0; j < b.length; j++) {
      row[j + 1] = word === b[j] ? prev[j] + 1 : Math.max(prev[j + 1], row[j]);
    }
    prev = row;
  }
  return prev[b.length];
}

function spanText(speech: string, tokens: Token[], from: number, to: number): string {
  return speech.slice(tokens[from].start, tokens[to].end).replace(/\s+/g, " ").trim();
}

export type QuoteOutcome =
  | { status: "kept"; excerpt: string }
  | { status: "fixed"; excerpt: string; how: "similar" | "run" | "paraphrase" }
  | { status: "dropped" };

export function groundQuote(quote: string, speech: string): QuoteOutcome {
  const needleTokens = tokenize(quote);
  const needle = needleTokens.map((t) => t.norm);
  const n = needle.length;
  if (n < MIN_QUOTE_WORDS) return { status: "dropped" };
  const hay = tokenize(speech);
  const words = hay.map((t) => t.norm);

  // 1. Close match: a window of about the same length sharing ≥85% of the
  //    quote's words in order. Windows are prefiltered by word overlap.
  const needleCounts = new Map<string, number>();
  for (const w of needle) needleCounts.set(w, (needleCounts.get(w) ?? 0) + 1);
  let best = { score: 0, from: -1, to: -1 };
  const minWindow = Math.max(1, n - 2);
  for (let i = 0; i + minWindow <= words.length; i++) {
    const counts = new Map(needleCounts);
    let overlap = 0;
    for (let k = i; k < Math.min(words.length, i + n + 2); k++) {
      const left = counts.get(words[k]) ?? 0;
      if (left > 0) {
        counts.set(words[k], left - 1);
        overlap++;
      }
    }
    if (overlap < SIMILARITY_THRESHOLD * n) continue;
    for (let w = minWindow; w <= n + 2 && i + w <= words.length; w++) {
      const score = lcsLength(needle, words.slice(i, i + w)) / Math.max(n, w);
      if (score > best.score) best = { score, from: i, to: i + w - 1 };
    }
  }
  if (best.score >= SIMILARITY_THRESHOLD) {
    const excerpt = spanText(speech, hay, best.from, best.to);
    return best.score === 1 ? { status: "kept", excerpt } : { status: "fixed", excerpt, how: "similar" };
  }

  // 2. A long quote with a change in it: its longest run of real words.
  let run = { length: 0, end: -1 };
  let prev = new Array<number>(n + 1).fill(0);
  for (let i = 0; i < words.length; i++) {
    const row = new Array<number>(n + 1).fill(0);
    for (let j = 0; j < n; j++) {
      if (words[i] === needle[j]) {
        row[j + 1] = prev[j] + 1;
        if (row[j + 1] > run.length) run = { length: row[j + 1], end: i };
      }
    }
    prev = row;
  }
  if (run.length >= MIN_RUN_WORDS) {
    return { status: "fixed", excerpt: spanText(speech, hay, run.end - run.length + 1, run.end), how: "run" };
  }

  // 3. A paraphrase of one moment: most of the quote's content words show up
  //    close together. The fix is the stretch from the first to the last of them.
  const content = [...new Set(needle.filter((w) => !STOP_WORDS.has(w)))];
  if (content.length >= MIN_PARAPHRASE_CONTENT_WORDS) {
    const wanted = new Set(content);
    const windowSize = n * 2;
    let para = { coverage: 0, from: -1, to: -1 };
    for (let i = 0; i < words.length; i++) {
      if (!wanted.has(words[i])) continue; // windows start on a content word
      const found = new Set<string>();
      let last = i;
      for (let k = i; k < Math.min(words.length, i + windowSize); k++) {
        if (wanted.has(words[k])) {
          found.add(words[k]);
          last = k;
        }
      }
      const coverage = found.size / content.length;
      if (coverage > para.coverage) para = { coverage, from: i, to: last };
    }
    if (para.coverage >= PARAPHRASE_COVERAGE) {
      return { status: "fixed", excerpt: spanText(speech, hay, para.from, para.to), how: "paraphrase" };
    }
  }

  return { status: "dropped" };
}

/** True when the quote is backed by something the user said (kept or fixed). */
export function isGroundedQuote(quote: string, speech: string): boolean {
  return groundQuote(quote, speech).status !== "dropped";
}

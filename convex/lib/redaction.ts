// Hides personal identifiers in transcripts before they are stored or sent
// to a model: email addresses, and phone, account, card or ID numbers (any
// run of 9 or more digits, allowing spaces, dots, dashes and brackets in
// between). Years, prices and short numbers are left alone.
//
// This is pattern matching, not understanding: names and street addresses
// stay. It is a safety net, not a guarantee.

export const EMAIL_MARK = "[email]";
export const NUMBER_MARK = "[number]";
const MIN_DIGITS = 9;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
// Starts and ends on a digit; allows +, brackets and separators (not line breaks) in between.
const DIGIT_RUN = /\+?\(?\d[\d \t().-]*\d/g;

export function redact(text: string): { text: string; count: number } {
  let count = 0;
  const withoutEmails = text.replace(EMAIL, () => {
    count++;
    return EMAIL_MARK;
  });
  const result = withoutEmails.replace(DIGIT_RUN, (match) => {
    const digits = match.replace(/\D/g, "").length;
    if (digits < MIN_DIGITS) return match;
    count++;
    return NUMBER_MARK;
  });
  return { text: result, count };
}

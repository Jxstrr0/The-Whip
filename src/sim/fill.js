// Filling {slot}s in a line of copy. Names and phrases keep the case they take mid-sentence ("the Rural Roads
// Fund Act", "the whip"), so a slot that opens a sentence gets its capital here.

export function capFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// What can sit before a slot that starts a sentence: nothing, an opening quote, or the end of the last sentence.
const OPENS = /(^|^["“‘(]|[.!?…]["”’)]?\s+|[.!?…]\s+["“‘(])$/;

export function fill(text, ctx, missing = (k) => `{${k}}`) {
  return text.replace(/\{(\w+)\}/g, (_, k, at) => {
    const v = ctx[k];
    if (v == null) return missing(k);
    return OPENS.test(text.slice(0, at)) ? capFirst(String(v)) : v;
  });
}

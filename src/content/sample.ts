/**
 * Lesson 1 — Mādhyandina Saṃhitā, Adhyāya 1 (opening verses).
 *
 * Text is real accented Devanāgarī from the Mādhyandina corpus (see vsData.ts),
 * parsed into syllables + svara by `buildMantra`/`devanagari.ts`. The svara →
 * gesture motions are then compiled by the gesture engine.
 *
 * Still `validated: false`: the text/accents should be cross-checked against the
 * source PDF and signed off by a reciter, and the syllable timings are uniform
 * placeholders until reference audio is aligned.
 */

import type { Lesson } from "./schema";
import { buildMantra } from "./devanagari";
import { VS_ADHYAYA_1 } from "./vsData";
import { ADHYAYA_1_AUDIO_URL, ADHYAYA_1_SEGMENTS, INVOCATION_SEGMENT } from "./audioSegments";

/** Verse numbers (ASCII) whose accents have been cross-checked against the PDF. */
const PDF_CHECKED = new Set(["1", "2", "3"]);

const DEV_DIGITS = "०१२३४५६७८९";
const toAscii = (s: string) =>
  [...s].map((c) => (DEV_DIGITS.includes(c) ? String(DEV_DIGITS.indexOf(c)) : c)).join("");

/**
 * Invocation "Hariḥ Oṃ" — hand-authored demo for the finger layer:
 * ha → shoulder (svarita next), riḥ → udātta home + visarga fingers,
 * o → home + open hand, m् → home + fist (word-final halant).
 */
const INVOCATION = buildMantra("invocation", "Hariḥ Oṃ", "हरि॑ः ओम्", false, {
  url: ADHYAYA_1_AUDIO_URL,
  start: INVOCATION_SEGMENT[0],
  end: INVOCATION_SEGMENT[1],
});

export const SAMPLE_LESSON: Lesson = {
  id: "vs-adhyaya-1",
  title: "Adhyāya 1 — opening",
  description:
    "Vājasaneyi-Mādhyandina Saṃhitā, first adhyāya. Accents from the corpus; timings are placeholders pending audio.",
  mantras: [
    INVOCATION,
    ...VS_ADHYAYA_1.map((v) => {
      const n = toAscii(v.n);
      const seg = ADHYAYA_1_SEGMENTS[n];
      const audio = seg ? { url: ADHYAYA_1_AUDIO_URL, start: seg[0], end: seg[1] } : undefined;
      return buildMantra(`vs-1-${n}`, `VS 1.${n}`, v.devanagari, PDF_CHECKED.has(n), audio);
    }),
  ],
};

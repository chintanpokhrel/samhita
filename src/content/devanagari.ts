/**
 * Devanāgarī syllabifier + svara extractor.
 *
 * Splits accented Devanāgarī into aksharas (orthographic syllables) and derives
 * each akshara's svara from its Vedic accent mark:
 *   anudātta ॒ (U+0952) → "anudatta"   ·   svarita ॑ (U+0951) → "svarita"
 *   unmarked → "udatta"
 *
 * This is the bridge from corpus text (e.g. the Mādhyandina saṃhitā in Unicode)
 * to the gesture engine: the output feeds compileGestures directly.
 */

import type { Syllable, Svara, Mantra } from "./schema";

const cp = (c: string) => c.codePointAt(0) ?? 0;
const inRange = (c: string, lo: number, hi: number) => {
  const n = cp(c);
  return n >= lo && n <= hi;
};

const VIRAMA = "्";
const ANUDATTA = "॒";
const SVARITA = "॑";

const isConsonant = (c: string) => inRange(c, 0x0915, 0x0939) || inRange(c, 0x0958, 0x095f);
const isIndependentVowel = (c: string) =>
  inRange(c, 0x0904, 0x0914) || inRange(c, 0x0960, 0x0961);
const isMatra = (c: string) =>
  inRange(c, 0x093a, 0x093c) || inRange(c, 0x093e, 0x094c) || inRange(c, 0x0962, 0x0963);
/** Combining signs that attach to the current akshara. */
/** Visarga is pronounced as its own short beat, so it becomes its own akshara. */
const isVisarga = (c: string) => c === "ः" || c === ":";
const isAttaching = (c: string) =>
  c === VIRAMA ||
  isMatra(c) ||
  c === "ँ" || c === "ं" || c === "ऀ" || // candrabindu / anusvara
  c === "़" || c === "ऽ" || // nukta, avagraha
  inRange(c, 0x0951, 0x0954) || // accents
  inRange(c, 0x1cd0, 0x1cff) || // Vedic Extensions
  inRange(c, 0xa8e0, 0xa8ff); // Combining Devanagari
const isBoundary = (c: string) =>
  /\s/.test(c) || c === "।" || c === "॥" || c === "|" ||
  inRange(c, 0x0966, 0x096f) || /\d/.test(c);

/** Split accented Devanāgarī into aksharas. */
export function splitAksharas(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let prevVirama = false;
  for (const c of text) {
    if (isBoundary(c)) {
      if (cur) out.push(cur);
      cur = "";
      prevVirama = false;
    } else if (isVisarga(c)) {
      // Close the current akshara and emit the visarga as its own beat.
      if (cur) out.push(cur);
      out.push(c);
      cur = "";
      prevVirama = false;
    } else if (isIndependentVowel(c)) {
      if (cur) out.push(cur);
      cur = c;
      prevVirama = false;
    } else if (isConsonant(c)) {
      if (cur && !prevVirama) {
        out.push(cur);
        cur = c;
      } else {
        cur += c; // conjunct continuation after a virama
      }
      prevVirama = false;
    } else if (isAttaching(c)) {
      cur += c;
      prevVirama = c === VIRAMA;
    } else {
      cur += c;
      prevVirama = false;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function svaraOf(akshara: string): Svara {
  if (akshara.includes(ANUDATTA)) return "anudatta";
  if (akshara.includes(SVARITA)) return "svarita";
  return "udatta";
}

/** Derive the finger shape from orthographic marks (visarga / word-final halant). */
function mudraOf(akshara: string): Syllable["mudra"] {
  if (akshara.endsWith(VIRAMA)) return "fist"; // bare final consonant
  if (akshara.includes("ः") || akshara.includes(":")) return "visarga";
  return undefined;
}

/** Parse accented Devanāgarī into syllables with svara + mudra (no timing). */
export function parseSyllables(text: string): Syllable[] {
  return splitAksharas(text).map((a) => ({
    devanagari: a,
    svara: svaraOf(a),
    mudra: mudraOf(a),
  }));
}

/**
 * Build a Mantra from accented Devanāgarī. Timings are uniform placeholders
 * (no reference audio yet) so the recite-along clock has something to run on.
 */
export function buildMantra(
  id: string,
  reference: string,
  text: string,
  pdfChecked = false,
  audio?: Mantra["audio"],
  msPerSyllable = 650,
): Mantra {
  const parsed = parseSyllables(text);
  // Relative durations (visarga is a short beat); scaled to the audio segment
  // length when audio is present, otherwise uniform placeholders.
  const durs = parsed.map((s) => (s.mudra === "visarga" ? msPerSyllable * 0.5 : msPerSyllable));
  const total = durs.reduce((a, b) => a + b, 0) || 1;
  const scale = audio ? ((audio.end - audio.start) * 1000) / total : 1;
  let t = 0;
  const syllables = parsed.map((s, i) => {
    const d = durs[i] * scale;
    const out = { ...s, startMs: t, endMs: t + d };
    t += d;
    return out;
  });
  return {
    id,
    reference,
    devanagari: text,
    syllables,
    pdfChecked,
    audio,
    validated: false,
  };
}

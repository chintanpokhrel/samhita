/**
 * Content model for Madhyandina Saṃhitā recitation.
 *
 * Design principle (see project plan): the *gesture* is treated as a function of
 * the *svara*, derived by a ruleset, with optional per-syllable overrides for
 * places where the tradition deviates from the accent pattern. This keeps a
 * single source of truth — the svara-marked text — driving both the avatar's
 * hands and the correctness check on the student's hands.
 *
 * IMPORTANT: All sacred content (text, svara assignments, gesture conventions)
 * must be validated by a qualified reciter before being treated as correct.
 * Sample data shipped in this repo is explicitly marked UNVALIDATED.
 */

/**
 * Vedic pitch accents (svara). The visible Devanagari marks:
 *  - anudātta  ॒  (U+0952, below the akshara) — grave / low
 *  - svarita   ॑  (U+0951, above the akshara) — falling
 *  - udātta         — unmarked in the common Madhyandina convention (the "raised" tone)
 *  - pracaya        — monotone syllables following a svarita until the next udātta
 */
export type Svara =
  | "udatta"
  | "anudatta"
  | "svarita"
  | "dirgha-svarita" // independent / long svarita
  | "pracaya";

/**
 * Right-hand finger shape, layered on top of the arm position. Derived from
 * orthographic marks (visarga, word-final halant) or assigned explicitly.
 *  - default:   open hand (four fingers up at the knuckle, thumb out)
 *  - visarga:   index + little out, middle + ring curled to the palm
 *  - fist:      all four fingers curled (word-final halant)
 *  - longGung:  fist with only the index extended
 *  - shortGung: thumb tip touching the forefinger
 */
export type FingerShape = "default" | "visarga" | "fist" | "longGung" | "shortGung";

/** One akshara (syllable) — the atomic unit of recitation and gesture. */
export interface Syllable {
  /** Devanagari for this akshara, including its accent combining mark(s). */
  devanagari: string;
  /** IAST transliteration, for learners and for debugging. Optional. */
  transliteration?: string;
  svara: Svara;
  /** Right-hand finger shape for this akshara (default open hand if absent). */
  mudra?: FingerShape;
  /**
   * Optional gesture override. When absent, the gesture is derived from `svara`
   * via the ruleset in gestures.ts. When present, this id wins.
   */
  gestureId?: string;
  /** Alignment to reference audio, in milliseconds from mantra start. */
  startMs?: number;
  endMs?: number;
}

/** A unit of recitation — typically one mantra / ṛc / yajus. */
export interface Mantra {
  /** Stable internal id. */
  id: string;
  /** Canonical reference, e.g. "VS 1.1" (Vājasaneyi Saṃhitā, Mādhyandina). */
  reference: string;
  /** Full Devanagari text with accent marks (denormalized for display). */
  devanagari: string;
  /** Full IAST transliteration. Optional. */
  transliteration?: string;
  /** Ordered syllables — the spine of recitation, svara, and gesture timing. */
  syllables: Syllable[];
  /** Reference recitation: a segment [start, end] (seconds) of an audio file. */
  audio?: { url: string; start: number; end: number };
  /** True once the accents have been cross-checked against the source PDF. */
  pdfChecked?: boolean;
  /** True only after a qualified reciter has signed off on text + svara + timing. */
  validated: boolean;
}

/** A lesson groups mantras into a teachable sequence. */
export interface Lesson {
  id: string;
  title: string;
  description: string;
  mantras: Mantra[];
}

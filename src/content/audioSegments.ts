/**
 * Per-mantra segments [startSec, endSec] within the recitation audio file.
 *
 * Boundaries supplied by the user from the recording: one continuous ~173.6 s
 * track — opening "Hariḥ Oṃ" (0–2s), VS 1.1–1.8, then a closing "Hariḥ Oṃ".
 * Keys are ASCII verse numbers. (Per-syllable onset alignment within each
 * segment is still even-spread; a later refinement.)
 */
export const ADHYAYA_1_AUDIO_URL = "/audio/adhyaya1.m4a";

/** Opening "Hariḥ Oṃ" invocation. */
export const INVOCATION_SEGMENT: [number, number] = [0, 3];

export const ADHYAYA_1_SEGMENTS: Record<string, [number, number]> = {
  "1": [3, 41],
  "2": [41, 64],
  "3": [64, 86],
  "4": [86, 103],
  "5": [103, 117],
  "6": [117, 130],
  "7": [130, 146],
  "8": [146, 169],
};

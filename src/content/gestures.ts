/**
 * Mādhyandina gesture model.
 *
 * Two layers:
 *  1. ARM MOTION (active) — the gross-motor hand/arm movement that tracks the
 *     svara sequence. This is the convention described by the user and is
 *     SEQUENCE-DEPENDENT: a syllable's motion depends on the next svara and on
 *     runs of anudātta, so it is produced by `compileGestures()` walking the
 *     whole syllable list — not a per-syllable lookup.
 *  2. FINGER GESTURE (deferred) — precise finger positions, to be layered on
 *     later. Kept below for when we get to it.
 *
 * ⚠️ The arm-motion rules below are this assistant's INTERPRETATION of the
 * described convention and must be validated by the reciter. The mapping of
 * positions to 3D transforms (in AvatarScene) is separate and visually tunable.
 */

import type { Svara, Syllable } from "./schema";

// ─────────────────────────────────────────────────────────────────────────
// Layer 1 — ARM MOTION (active)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Named arm positions — the vocabulary for "which is which".
 *  - udatta:     home/start. Arm bent at a right angle, fingers perpendicular to
 *                the hand. Udātta syllables sit here. (Unmarked in text.)
 *  - ground:     hand falls all the way down to touch the ground.
 *  - shoulder:   hand raised to touch the shoulder.
 *  - rightThigh: hand touches the right thigh (an anudātta whose next svara is
 *                not a svarita).
 *  - left:       hand swings out to the left; alternates with rightThigh through
 *                a run of anudāttas.
 */
export type ArmPosition = "udatta" | "ground" | "shoulder" | "rightThigh" | "left";

export interface ArmPositionDef {
  name: string;
  description: string;
  /** Coarse zone, for the camera's (advisory) student-position check. */
  zone: "level" | "lowered" | "raised";
}

export const ARM_POSITIONS: Record<ArmPosition, ArmPositionDef> = {
  udatta: {
    name: "Udātta",
    description: "Arm at a right angle (home position).",
    zone: "level",
  },
  ground: {
    name: "Ground",
    description: "Hand falls all the way to touch the ground.",
    zone: "lowered",
  },
  shoulder: {
    name: "Shoulder",
    description: "Hand raised to the shoulder.",
    zone: "raised",
  },
  rightThigh: {
    name: "Right thigh",
    description: "Hand touches the right thigh.",
    zone: "lowered",
  },
  left: {
    name: "Left",
    description: "Hand swings out to the left.",
    zone: "level",
  },
};

/** The motion to perform on one syllable. */
export interface GestureStep {
  /** Resting position the arm lands on for this syllable. */
  position: ArmPosition;
  /**
   * Waypoints the arm travels through across the syllable's duration, ending at
   * `position`. (The avatar interpolates from its current pose through these.)
   */
  waypoints: ArmPosition[];
  /** Human-readable instruction for the learner. */
  instruction: string;
}

const isAnudatta = (s: Svara) => s === "anudatta";
const isSvarita = (s: Svara) => s === "svarita" || s === "dirgha-svarita";

/**
 * Compile a syllable sequence into per-syllable arm positions (one per akshara;
 * the avatar interpolates between them). Derived from a full annotation of VS 1.1.
 *
 * A "low passage" runs from an anudātta to the resolving svarita:
 *  - Passage with a SINGLE anudātta → that anudātta = `ground` (floor); the
 *    following unmarked syllables HOLD at the `shoulder` until the svarita.
 *  - Passage with TWO+ anudāttas → the FIRST = `rightThigh` and the following
 *    syllables HOLD `left` until the next anudātta; the later anudātta(s) =
 *    `ground`, then HOLD at the `shoulder` until the svarita.
 *  - svarita → `udatta` home (the fall).
 *  - Outside any passage, udātta / pracaya rest at `udatta` home — except a
 *    udātta whose next svara is a svarita rises to the `shoulder` (so the svarita
 *    can fall from there, e.g. the opening "ha" before "riḥ").
 */
export function compileGestures(syllables: Syllable[]): GestureStep[] {
  const steps: GestureStep[] = [];
  let inLow = false; // within an unresolved low passage (anudātta → svarita)?
  let holdPos: ArmPosition = "udatta"; // where udāttas rest: home / left / shoulder

  // Count anudāttas from index i up to (not including) the next svarita.
  const anudattasUntilSvarita = (i: number) => {
    let c = 0;
    for (let j = i; j < syllables.length; j++) {
      if (isSvarita(syllables[j].svara)) break;
      if (isAnudatta(syllables[j].svara)) c++;
    }
    return c;
  };

  // Each syllable maps to ONE arm position; the avatar interpolates between
  // consecutive positions, so the "dip then rise" plays out across syllables.
  const push = (position: ArmPosition, instruction: string) =>
    steps.push({ position, waypoints: [position], instruction });

  for (let i = 0; i < syllables.length; i++) {
    const sv = syllables[i].svara;
    const next = i + 1 < syllables.length ? syllables[i + 1].svara : undefined;
    const nextIsSvarita = next !== undefined && isSvarita(next);

    if (syllables[i].gestureId) {
      // Per-syllable override escape hatch (a known ArmPosition id).
      const pos = (syllables[i].gestureId as ArmPosition) ?? "udatta";
      push(pos, ARM_POSITIONS[pos]?.description ?? "");
      inLow = isAnudatta(sv) ? true : isSvarita(sv) ? false : inLow;
      continue;
    }

    if (isSvarita(sv)) {
      push("udatta", "Svarita — move into the home position.");
      inLow = false;
      holdPos = "udatta";
    } else if (isAnudatta(sv)) {
      if (!inLow && anudattasUntilSvarita(i) >= 2) {
        // First of two+ anudāttas in the passage → right thigh; then hold left.
        push("rightThigh", "Anudātta (first of several) — touch the right thigh.");
        holdPos = "left";
      } else {
        // Single / later anudātta → down to the floor; then hold at the shoulder.
        push("ground", "Anudātta — down to the floor.");
        holdPos = "shoulder";
      }
      inLow = true;
    } else if (inLow) {
      // Unmarked syllable inside a passage holds the carry position.
      push(
        holdPos,
        holdPos === "left" ? "Hold to the left." : "Hold at the shoulder (awaiting the svarita).",
      );
    } else if (nextIsSvarita) {
      // A svarita falls from the shoulder, so the syllable before it rises there.
      push("shoulder", "Rise to the shoulder (the svarita falls from here).");
    } else {
      push("udatta", "Udātta — home (arm at a right angle).");
    }
  }

  return steps;
}

// ─────────────────────────────────────────────────────────────────────────
// Layer 2 — FINGER GESTURE (deferred; kept for later)
// ─────────────────────────────────────────────────────────────────────────

export type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";

export type FingerState = "extended" | "curled" | "touchThumb";

/** Coarse hand zone used by the camera's advisory student-position check. */
export type HandZone = "chest" | "raised" | "lowered" | "forward";

export interface HandGesture {
  id: string;
  name: string;
  description: string;
  zone: HandZone;
  fingers: Record<FingerName, FingerState>;
}

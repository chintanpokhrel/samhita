/**
 * Classify a MediaPipe hand (21 landmarks) into our discrete gesture model
 * (per-finger state + a coarse hand zone), then compare it to a reference
 * gesture to produce correction feedback.
 *
 * NOTE on zone: with hand-only landmarks we can only roughly estimate vertical
 * position from the wrist's height in frame. A reliable zone (relative to the
 * body/chest) needs PoseLandmarker — a later addition — so for now zone is
 * advisory and excluded from the pass/fail match. Finger states are the
 * dependable signal.
 */

import type { Landmark } from "./useTracking";
import type {
  FingerName,
  FingerState,
  HandGesture,
  HandZone,
} from "../content/gestures";

const TIP: Record<FingerName, number> = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const PIP: Record<FingerName, number> = { thumb: 2, index: 6, middle: 10, ring: 14, pinky: 18 };
const NON_THUMB: FingerName[] = ["index", "middle", "ring", "pinky"];

/** Normalized distance below which a fingertip counts as touching the thumb tip. */
const TOUCH_THRESHOLD = 0.06;
/** A finger reads as extended when its tip is this much farther from the wrist than its PIP. */
const EXTEND_RATIO = 1.1;

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export interface ClassifiedHand {
  zone: HandZone;
  fingers: Record<FingerName, FingerState>;
}

export function classifyHand(lm: Landmark[]): ClassifiedHand {
  const wrist = lm[0];
  const thumbTip = lm[TIP.thumb];

  const fingers = {} as Record<FingerName, FingerState>;
  for (const f of NON_THUMB) {
    const tip = lm[TIP[f]];
    const pip = lm[PIP[f]];
    if (dist(tip, thumbTip) < TOUCH_THRESHOLD) fingers[f] = "touchThumb";
    else if (dist(tip, wrist) > dist(pip, wrist) * EXTEND_RATIO) fingers[f] = "extended";
    else fingers[f] = "curled";
  }

  // The thumb itself reads as "touching" when any finger is on it.
  const anyTouch = NON_THUMB.some((f) => fingers[f] === "touchThumb");
  const thumbExtended = dist(thumbTip, wrist) > dist(lm[PIP.thumb], wrist) * EXTEND_RATIO;
  fingers.thumb = anyTouch ? "touchThumb" : thumbExtended ? "extended" : "curled";

  // Coarse, advisory zone from wrist height (0 = top of frame, 1 = bottom).
  let zone: HandZone = "chest";
  if (wrist.y < 0.35) zone = "raised";
  else if (wrist.y > 0.65) zone = "lowered";

  return { zone, fingers };
}

export interface GestureComparison {
  /** True when every finger matches the reference (zone is advisory, excluded). */
  match: boolean;
  fingerMatches: Record<FingerName, boolean>;
  /** Human-readable corrections for the fingers that don't match. */
  hints: string[];
}

export function compareToReference(
  student: ClassifiedHand,
  ref: HandGesture,
): GestureComparison {
  const fingerMatches = {} as Record<FingerName, boolean>;
  const hints: string[] = [];

  for (const f of Object.keys(ref.fingers) as FingerName[]) {
    const ok = student.fingers[f] === ref.fingers[f];
    fingerMatches[f] = ok;
    if (!ok) hints.push(targetHint(f, ref.fingers[f]));
  }

  return {
    match: Object.values(fingerMatches).every(Boolean),
    fingerMatches,
    hints,
  };
}

function targetHint(f: FingerName, target: FingerState): string {
  switch (target) {
    case "touchThumb":
      return f === "thumb" ? "bring a fingertip to the thumb" : `touch ${f} to thumb`;
    case "extended":
      return `extend ${f}`;
    case "curled":
      return `curl ${f}`;
  }
}

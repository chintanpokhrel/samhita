/**
 * Classify the student's right-arm position from MediaPipe Pose landmarks into
 * our ArmPosition vocabulary, RELATIVE TO THE BODY (shoulder/hip anchors) so it
 * works regardless of camera distance or framing.
 *
 * The reciting hand is the (anatomical) right hand. Thresholds are deliberately
 * exposed as constants — they are the knobs to tune against real students.
 */

import type { Pose, Landmark } from "./useTracking";
import type { ArmPosition } from "../content/gestures";

// MediaPipe Pose (BlazePose) landmark indices.
const L_SHOULDER = 11, R_SHOULDER = 12, R_WRIST = 16, L_HIP = 23, R_HIP = 24;

// Vertical thresholds, normalized so 0 = shoulder line, 1 = hip line.
const VY_SHOULDER = 0.25; // at/above this → shoulder
const VY_GROUND = 1.15; // below this → ground
const VY_LOW = 0.8; // below this → low region (thigh/ground)
// Horizontal: shoulder-widths the wrist has crossed past shoulder-center toward
// the body's left. Beyond this → "left".
const HX_LEFT = 0.3;

export function classifyArmPosition(pose: Pose): ArmPosition | null {
  if (!pose || pose.length < 25) return null;
  const rs = pose[R_SHOULDER];
  const ls = pose[L_SHOULDER];
  const rw = pose[R_WRIST];
  const hipY = (pose[L_HIP].y + pose[R_HIP].y) / 2;
  const shoulderY = (ls.y + rs.y) / 2;
  const sx = (ls.x + rs.x) / 2;
  const sw = Math.max(0.001, Math.abs(ls.x - rs.x));

  const vy = (rw.y - shoulderY) / Math.max(0.001, hipY - shoulderY);
  // Person's right shoulder sits at smaller x than center, so crossing toward
  // the body's left increases (x - sx). Normalize by shoulder width.
  const hx = (rw.x - sx) / sw;

  if (vy < VY_SHOULDER) return "shoulder";
  if (vy >= VY_GROUND) return "ground";
  if (vy >= VY_LOW) return hx > HX_LEFT ? "left" : "rightThigh";
  return hx > HX_LEFT ? "left" : "udatta";
}

/** Pull out the right-arm chain (shoulder→elbow→wrist) for overlay drawing. */
export function rightArmChain(pose: Pose): Landmark[] | null {
  if (!pose || pose.length < 17) return null;
  return [pose[R_SHOULDER], pose[14], pose[R_WRIST]];
}

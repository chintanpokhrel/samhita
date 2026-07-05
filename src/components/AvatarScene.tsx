import {
  VRM,
  VRMLoaderPlugin,
  VRMUtils,
  type VRMHumanBoneName,
  type VRMHumanoid,
} from "@pixiv/three-vrm";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import type { Group } from "three";
import { MathUtils } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ArmPosition } from "../content/gestures";
import type { FingerShape } from "../content/schema";
import { usePlayback } from "../state/playback";
import { ErrorBoundary } from "./ErrorBoundary";

const AVATAR_URL = "/avatar.vrm";

type Vec3 = [number, number, number];
type Transform = { pos: Vec3; rot: Vec3 };

// ─── Placeholder (capsule) arm transforms, used when no VRM is present ───────
const POSITION_TRANSFORM: Record<ArmPosition, Transform> = {
  udatta: { pos: [0.2, 0.62, 0.42], rot: [0.6, 0, -0.25] },
  ground: { pos: [0.34, 0.02, 0.28], rot: [0.15, 0, -0.3] },
  shoulder: { pos: [0.2, 0.98, 0.2], rot: [0.0, 0, -0.2] },
  rightThigh: { pos: [0.44, 0.12, 0.3], rot: [0.45, 0, -0.5] },
  left: { pos: [-0.06, 0.52, 0.32], rot: [0.4, 0, 0.7] },
};

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  MathUtils.lerp(a[0], b[0], t),
  MathUtils.lerp(a[1], b[1], t),
  MathUtils.lerp(a[2], b[2], t),
];

// ─── VRM right-arm bone poses per gesture position ───────────────────────────
// Euler XYZ (radians) for the normalized humanoid bones. From the VRM rest
// (T-pose) the right arm points along -X; z≈-1.2 lowers it to the side, and
// lowerArm flexion is about Y. These are a first pass — tuned visually.
type BonePose = { upperArm: Vec3; lowerArm: Vec3; hand: Vec3 };

// Right arm, in the rig's local frame: upperArm.z swings the arm in the frontal
// plane (≈+1.5 straight down, ≈0 horizontal, negative up); upperArm.y swings it
// forward (+) / across the body; lowerArm.y flexes the elbow forward.
const ARM_BONE_POSE: Record<ArmPosition, BonePose> = {
  udatta: { upperArm: [0.0, 0.3, 1.2], lowerArm: [0.0, 1.9, 0.0], hand: [0, 0, 0] },
  ground: { upperArm: [0.0, 0.9, 1.25], lowerArm: [0.0, 0.6, 0.0], hand: [0, 0, 0] },
  // Upper arm stays down at the side (like udātta); a stronger elbow fold raises
  // the forearm straight up so the hand reaches shoulder/head height.
  shoulder: { upperArm: [0.0, 0.3, 1.2], lowerArm: [0.0, 2.5, 0.0], hand: [0, 0, 0] },
  rightThigh: { upperArm: [0.0, 0.5, 1.25], lowerArm: [0.0, 0.8, 0.0], hand: [0, 0, 0] },
  left: { upperArm: [0.0, 2.2, 0.7], lowerArm: [0.0, 1.0, 0.0], hand: [0, 0, 0] },
};

const lerpPose = (a: BonePose, b: BonePose, t: number): BonePose => ({
  upperArm: lerp3(a.upperArm, b.upperArm, t),
  lowerArm: lerp3(a.lowerArm, b.lowerArm, t),
  hand: lerp3(a.hand, b.hand, t),
});

/** Interpolate from a start pose through the waypoint poses by progress p∈[0,1]. */
function poseAt(from: BonePose, waypoints: ArmPosition[], p: number): BonePose {
  const nodes = [from, ...waypoints.map((w) => ARM_BONE_POSE[w])];
  const segCount = nodes.length - 1;
  const seg = p * segCount;
  const i = Math.min(segCount - 1, Math.max(0, Math.floor(seg)));
  return lerpPose(nodes[i], nodes[i + 1], seg - i);
}

// Constant roll about the forearm's long axis (the hand bone's local X) so the
// palm faces INWARD toward the body (thumb pointing outward) in every position.
// (z would bend the wrist; x is the true supinate/pronate roll.)
const PALM_UP_ROLL: Vec3 = [-1.5, 0, 0];

function applyPose(hu: VRMHumanoid, pose: BonePose) {
  const set = (b: VRMHumanBoneName, r: Vec3) => {
    const n = hu.getNormalizedBoneNode(b);
    if (n) n.rotation.set(r[0], r[1], r[2]);
  };
  set("rightUpperArm", pose.upperArm);
  set("rightLowerArm", pose.lowerArm);
  set("rightHand", [
    pose.hand[0] + PALM_UP_ROLL[0],
    pose.hand[1] + PALM_UP_ROLL[1],
    pose.hand[2] + PALM_UP_ROLL[2],
  ]);
}

// ─── Finger shapes (right hand) ──────────────────────────────────────────────
// Per joint z-rotation: UP = bent up at the knuckle (open mudrā, the user-tuned
// default); CURL = folded into the palm; STRAIGHT = extended out. Curl direction
// is a first pass — tune via the finger tester + screenshots.
type Curl = { p: number; i: number; d: number };
const UP: Curl = { p: 1.5, i: 0, d: 0 };
// Curl folds INTO the palm (same direction as the knuckle-up bend, all joints).
const CURL: Curl = { p: 1.6, i: 1.7, d: 1.0 };
const STRAIGHT: Curl = { p: 0, i: 0, d: 0 };
const THUMB_IN: Curl = { p: 0.6, i: 0.4, d: 0 };

type HandPose = { thumb: Curl; index: Curl; middle: Curl; ring: Curl; little: Curl };

const FINGER_POSE: Record<FingerShape, HandPose> = {
  default: { thumb: STRAIGHT, index: UP, middle: UP, ring: UP, little: UP },
  // visarga: index + little out, middle + ring curled to the palm
  visarga: { thumb: STRAIGHT, index: UP, middle: CURL, ring: CURL, little: UP },
  // halant: full fist
  fist: { thumb: THUMB_IN, index: CURL, middle: CURL, ring: CURL, little: CURL },
  // long guṅg: fist with only the index extended
  longGung: { thumb: THUMB_IN, index: UP, middle: CURL, ring: CURL, little: CURL },
  // short guṅg: thumb tip toward the forefinger
  shortGung: { thumb: { p: 0.8, i: 0.4, d: 0 }, index: { p: 0.6, i: 0, d: 0 }, middle: UP, ring: UP, little: UP },
};

const FINGER_BONES: Record<keyof HandPose, [VRMHumanBoneName, VRMHumanBoneName, VRMHumanBoneName]> = {
  thumb: ["rightThumbMetacarpal", "rightThumbProximal", "rightThumbDistal"],
  index: ["rightIndexProximal", "rightIndexIntermediate", "rightIndexDistal"],
  middle: ["rightMiddleProximal", "rightMiddleIntermediate", "rightMiddleDistal"],
  ring: ["rightRingProximal", "rightRingIntermediate", "rightRingDistal"],
  little: ["rightLittleProximal", "rightLittleIntermediate", "rightLittleDistal"],
};

function applyFingers(hu: VRMHumanoid, shape: FingerShape) {
  const pose = FINGER_POSE[shape];
  for (const finger of Object.keys(pose) as (keyof HandPose)[]) {
    const [b0, b1, b2] = FINGER_BONES[finger];
    const c = pose[finger];
    for (const [bone, z] of [[b0, c.p], [b1, c.i], [b2, c.d]] as const) {
      const n = hu.getNormalizedBoneNode(bone);
      if (n) n.rotation.set(0, 0, z);
    }
  }
}

/** Pose the legs into a cross-legged seat + a calm resting left arm (once). */
function applySeatedPose(hu: VRMHumanoid) {
  const set = (b: VRMHumanBoneName, x: number, y: number, z: number) => {
    const n = hu.getNormalizedBoneNode(b);
    if (n) n.rotation.set(x, y, z);
  };
  // Sukhāsana: hips flexed + abducted + externally rotated; knees folded with the
  // shins angled inward (lowerLeg.y) so they CROSS in front rather than meeting.
  set("leftUpperLeg", -1.3, 0.45, 0.5);
  set("rightUpperLeg", -1.3, -0.45, -0.5);
  set("leftLowerLeg", 2.65, 0.6, 0);
  set("rightLowerLeg", 2.65, -0.6, 0);
  set("spine", 0.05, 0, 0);
  // Left arm rests down by the lap (mirror of the right: NEGATIVE z lowers it).
  set("leftUpperArm", 0.15, 0, -1.4);
  set("leftLowerArm", 0, -0.55, 0);
  // (Right-hand fingers are posed per-syllable each frame; see applyFingers.)
}

function VrmAvatar({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });
  const vrm = gltf.userData.vrm as VRM;
  const lastActive = useRef(-2);
  // Track the *logical* pose ourselves (without the palm roll) so we never read
  // the rolled value back off the bones — reading + re-adding the roll compounds
  // and makes the wrist spin out of control.
  const curPose = useRef<BonePose>(ARM_BONE_POSE.udatta);
  const fromPose = useRef<BonePose>(ARM_BONE_POSE.udatta);

  useEffect(() => {
    if (!vrm) return;
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.combineSkeletons(vrm.scene);
    // Normalize VRM 0.x to the VRM 1.0 orientation so any model we drop in faces
    // the same way (then rotation.y = 0 faces the camera).
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.rotation.y = 0;
    vrm.scene.position.y = -0.45; // drop a little so the head has headroom
    applySeatedPose(vrm.humanoid);
    vrm.humanoid.update();
  }, [vrm]);

  useFrame((_, delta) => {
    if (!vrm) return;
    const hu = vrm.humanoid;
    const { steps, activeIndex, mantra, elapsedMs, previewPos, previewMudra } =
      usePlayback.getState();

    if (previewPos) {
      // Dev pose tester — hold a single position for tuning.
      curPose.current = ARM_BONE_POSE[previewPos];
      lastActive.current = -2;
    } else if (activeIndex < 0 || !steps[activeIndex]) {
      // ease the arm back toward the udātta home pose
      const k = 1 - Math.exp(-6 * delta);
      curPose.current = lerpPose(curPose.current, ARM_BONE_POSE.udatta, k);
      lastActive.current = -2;
    } else {
      if (lastActive.current !== activeIndex) {
        fromPose.current = curPose.current;
        lastActive.current = activeIndex;
      }
      const step = steps[activeIndex];
      const syl = mantra?.syllables[activeIndex];
      const start = syl?.startMs ?? 0;
      const end = syl?.endMs ?? start + 1;
      const p = Math.min(1, Math.max(0, (elapsedMs - start) / Math.max(1, end - start)));
      curPose.current = poseAt(fromPose.current, step.waypoints, p);
    }
    applyPose(hu, curPose.current);

    // Finger shape: tester override → active syllable's mudrā → default.
    const shape: FingerShape =
      previewMudra ?? mantra?.syllables[activeIndex]?.mudra ?? "default";
    applyFingers(hu, shape);

    vrm.update(delta);
  });

  return vrm ? <primitive object={vrm.scene} /> : null;
}

/** Cross-legged capsule stand-in; right arm follows the gesture waypoints. */
function PlaceholderAvatar() {
  const bodyRef = useRef<Group>(null);
  const armRef = useRef<Group>(null);
  const lastActive = useRef(-2);
  const fromPos = useRef<Vec3>(POSITION_TRANSFORM.udatta.pos);
  const fromRot = useRef<Vec3>(POSITION_TRANSFORM.udatta.rot);

  useFrame((state, delta) => {
    if (bodyRef.current) {
      bodyRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.06;
    }
    const arm = armRef.current;
    if (!arm) return;
    const { steps, activeIndex, mantra, elapsedMs, previewPos } = usePlayback.getState();

    if (previewPos) {
      const t = POSITION_TRANSFORM[previewPos];
      arm.position.set(t.pos[0], t.pos[1], t.pos[2]);
      arm.rotation.set(t.rot[0], t.rot[1], t.rot[2]);
      lastActive.current = -2;
      return;
    }

    if (activeIndex < 0 || !steps[activeIndex]) {
      const home = POSITION_TRANSFORM.udatta;
      const L = 6;
      arm.position.set(
        MathUtils.damp(arm.position.x, home.pos[0], L, delta),
        MathUtils.damp(arm.position.y, home.pos[1], L, delta),
        MathUtils.damp(arm.position.z, home.pos[2], L, delta),
      );
      arm.rotation.set(
        MathUtils.damp(arm.rotation.x, home.rot[0], L, delta),
        MathUtils.damp(arm.rotation.y, home.rot[1], L, delta),
        MathUtils.damp(arm.rotation.z, home.rot[2], L, delta),
      );
      lastActive.current = -2;
      return;
    }
    if (lastActive.current !== activeIndex) {
      fromPos.current = [arm.position.x, arm.position.y, arm.position.z];
      fromRot.current = [arm.rotation.x, arm.rotation.y, arm.rotation.z];
      lastActive.current = activeIndex;
    }
    const step = steps[activeIndex];
    const syl = mantra?.syllables[activeIndex];
    const start = syl?.startMs ?? 0;
    const end = syl?.endMs ?? start + 1;
    const p = Math.min(1, Math.max(0, (elapsedMs - start) / Math.max(1, end - start)));
    const posNodes = [fromPos.current, ...step.waypoints.map((w) => POSITION_TRANSFORM[w].pos)];
    const rotNodes = [fromRot.current, ...step.waypoints.map((w) => POSITION_TRANSFORM[w].rot)];
    const segCount = posNodes.length - 1;
    const seg = p * segCount;
    const i = Math.min(segCount - 1, Math.max(0, Math.floor(seg)));
    const f = seg - i;
    const pos = lerp3(posNodes[i], posNodes[i + 1], f);
    const rot = lerp3(rotNodes[i], rotNodes[i + 1], f);
    arm.position.set(pos[0], pos[1], pos[2]);
    arm.rotation.set(rot[0], rot[1], rot[2]);
  });

  return (
    <group ref={bodyRef} position={[0, -0.4, 0]}>
      <mesh position={[0, 1.15, 0]}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial color="#d9a066" />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <capsuleGeometry args={[0.28, 0.5, 8, 16]} />
        <meshStandardMaterial color="#e8d4b0" />
      </mesh>
      <mesh position={[0, 0.18, 0.05]} rotation={[Math.PI / 2.4, 0, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.3, 24]} />
        <meshStandardMaterial color="#c98a5a" />
      </mesh>
      <mesh position={[-0.34, 0.5, 0.18]} rotation={[0.5, 0, 0.5]}>
        <capsuleGeometry args={[0.08, 0.4, 8, 16]} />
        <meshStandardMaterial color="#d9a066" />
      </mesh>
      <group ref={armRef} position={POSITION_TRANSFORM.udatta.pos} rotation={POSITION_TRANSFORM.udatta.rot}>
        <mesh>
          <capsuleGeometry args={[0.08, 0.4, 8, 16]} />
          <meshStandardMaterial color="#d9a066" />
        </mesh>
        <mesh position={[0, -0.28, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#e7b884" />
        </mesh>
      </group>
    </group>
  );
}

function Avatar() {
  const [hasVrm, setHasVrm] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(AVATAR_URL, { method: "HEAD" })
      .then((r) => {
        const type = r.headers.get("content-type") ?? "";
        if (alive) setHasVrm(r.ok && !type.includes("text/html"));
      })
      .catch(() => alive && setHasVrm(false));
    return () => {
      alive = false;
    };
  }, []);

  if (hasVrm === null) return null;
  if (!hasVrm) return <PlaceholderAvatar />;
  return (
    <ErrorBoundary label="VRM avatar" fallback={<PlaceholderAvatar />}>
      <Suspense fallback={<PlaceholderAvatar />}>
        <VrmAvatar url={AVATAR_URL} />
      </Suspense>
    </ErrorBoundary>
  );
}

export function AvatarScene() {
  return (
    <div className="panel avatar-panel">
      <div className="panel-header">Teacher (ācārya)</div>
      <div className="avatar-stage">
        <Canvas camera={{ position: [0, 0.7, 2.6], fov: 37 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 4, 3]} intensity={1.1} />
          <Avatar />
          <OrbitControls
            target={[0, 0.75, 0]}
            enablePan={false}
            minDistance={1.2}
            maxDistance={4}
          />
        </Canvas>
      </div>
    </div>
  );
}

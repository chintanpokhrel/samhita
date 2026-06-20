/**
 * Combined MediaPipe pipeline: one webcam feed driving both the Hand Landmarker
 * (21 landmarks/hand — for the finger layer, later) and the Pose Landmarker
 * (33 body landmarks — used now to grade arm position relative to the body).
 *
 * Assets are served locally from /public/mediapipe (see `pnpm assets`).
 */

import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

const WASM_PATH = "/mediapipe/wasm";
const HAND_MODEL = "/mediapipe/hand_landmarker.task";
const POSE_MODEL = "/mediapipe/pose_landmarker_lite.task";

export type Landmark = { x: number; y: number; z: number };
/** One entry per detected hand; each is 21 normalized landmarks. */
export type Hands = Landmark[][];
/** 33 normalized body landmarks for the first detected person, or null. */
export type Pose = Landmark[] | null;

export type TrackingStatus = "idle" | "loading" | "running" | "error";

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof ErrorEvent !== "undefined" && e instanceof ErrorEvent) {
    return e.message || `${e.type} loading resource`;
  }
  if (typeof e === "object" && e !== null && "type" in e) {
    return `Failed to load resource (${(e as Event).type})`;
  }
  return String(e);
}

export function useTracking(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hands, setHands] = useState<Hands>([]);
  const [pose, setPose] = useState<Pose>(null);

  const handRef = useRef<HandLandmarker | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        setStatus("loading");
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);

        const mk = <T,>(p: Promise<T>) => p;
        const [hand, poseLm] = await Promise.all([
          mk(
            HandLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" },
              runningMode: "VIDEO",
              numHands: 2,
            }).catch(() =>
              HandLandmarker.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: HAND_MODEL, delegate: "CPU" },
                runningMode: "VIDEO",
                numHands: 2,
              }),
            ),
          ),
          mk(
            PoseLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
              runningMode: "VIDEO",
              numPoses: 1,
            }).catch(() =>
              PoseLandmarker.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: POSE_MODEL, delegate: "CPU" },
                runningMode: "VIDEO",
                numPoses: 1,
              }),
            ),
          ),
        ]);
        if (cancelled) {
          hand.close();
          poseLm.close();
          return;
        }
        handRef.current = hand;
        poseRef.current = poseLm;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) throw new Error("Video element not mounted");
        video.srcObject = stream;
        await video.play();
        setStatus("running");

        let lastVideoTime = -1;
        const loop = () => {
          const v = videoRef.current;
          if (v && v.currentTime !== lastVideoTime && v.readyState >= 2) {
            lastVideoTime = v.currentTime;
            const ts = performance.now();
            const h = handRef.current?.detectForVideo(v, ts);
            setHands(h?.landmarks ?? []);
            const p = poseRef.current?.detectForVideo(v, ts);
            setPose(p?.landmarks?.[0] ?? null);
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        if (cancelled) return;
        setError(describeError(e));
        setStatus("error");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      handRef.current?.close();
      poseRef.current?.close();
      handRef.current = null;
      poseRef.current = null;
    };
  }, [videoRef]);

  return { status, error, hands, pose };
}

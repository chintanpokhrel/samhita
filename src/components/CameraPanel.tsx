import { useEffect, useRef } from "react";
import { useTracking, type Hands, type Pose } from "../vision/useTracking";
import { classifyArmPosition, rightArmChain } from "../vision/classifyPose";
import { usePlayback, referenceStep } from "../state/playback";
import { ARM_POSITIONS } from "../content/gestures";

/** MediaPipe hand-skeleton connections (pairs of landmark indices). */
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17], // palm base
];

function draw(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  hands: Hands,
  pose: Pose,
  good: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = (canvas.width = video.videoWidth || canvas.clientWidth);
  const h = (canvas.height = video.videoHeight || canvas.clientHeight);
  ctx.clearRect(0, 0, w, h);

  // Right arm (shoulder → elbow → wrist) — the graded chain.
  const arm = rightArmChain(pose);
  if (arm) {
    ctx.strokeStyle = good ? "#8fd14f" : "#ff9d4d";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(arm[0].x * w, arm[0].y * h);
    ctx.lineTo(arm[1].x * w, arm[1].y * h);
    ctx.lineTo(arm[2].x * w, arm[2].y * h);
    ctx.stroke();
    // wrist marker
    ctx.fillStyle = good ? "#aef27a" : "#ffb86b";
    ctx.beginPath();
    ctx.arc(arm[2].x * w, arm[2].y * h, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hands (kept for the finger layer; thin overlay).
  ctx.strokeStyle = "#ffcc55";
  ctx.lineWidth = 2;
  for (const hand of hands) {
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(hand[a].x * w, hand[a].y * h);
      ctx.lineTo(hand[b].x * w, hand[b].y * h);
      ctx.stroke();
    }
  }
}

export function CameraPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { status, error, hands, pose } = useTracking(videoRef);
  const activeIndex = usePlayback((s) => s.activeIndex);

  const step = activeIndex >= 0 ? referenceStep() : null;
  const studentPos = classifyArmPosition(pose);
  const match = step != null && studentPos === step.position;

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) draw(canvas, video, hands, pose, match);
  }, [hands, pose, match]);

  return (
    <div className="panel camera-panel">
      <div className="panel-header">
        You {pose ? "· tracking" : "· (stand back so your torso is visible)"}
      </div>
      <div className="camera-stage">
        {/* mirrored so it reads like a mirror to the student */}
        <video ref={videoRef} className="mirror" playsInline muted />
        <canvas ref={canvasRef} className="mirror overlay" />

        {step && (
          <div className={`feedback ${match ? "feedback-good" : "feedback-bad"}`}>
            {!pose ? (
              <span>Make sure your upper body is in frame</span>
            ) : match ? (
              <span>✓ {ARM_POSITIONS[step.position].name}</span>
            ) : (
              <span>
                {step.instruction}
                {studentPos && (
                  <em className="detected"> (you: {ARM_POSITIONS[studentPos].name})</em>
                )}
              </span>
            )}
          </div>
        )}

        {status !== "running" && (
          <div className="camera-status">
            {status === "loading" && "Loading models & camera…"}
            {status === "idle" && "Starting…"}
            {status === "error" && `Camera/model error: ${error}`}
          </div>
        )}
      </div>
    </div>
  );
}

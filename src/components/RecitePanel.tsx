import { useEffect, useRef } from "react";
import { usePlayback, referenceStep } from "../state/playback";
import { ARM_POSITIONS, type ArmPosition } from "../content/gestures";
import type { FingerShape } from "../content/schema";

const POSES: ArmPosition[] = ["udatta", "ground", "shoulder", "rightThigh", "left"];
const MUDRAS: FingerShape[] = ["default", "visarga", "fist", "longGung", "shortGung"];

/**
 * Recite-along strip: shows the active mantra's syllables, highlights the one
 * currently being recited, and surfaces the gesture derived from its svara.
 * All timing/state lives in the shared playback store so the avatar and the
 * feedback engine stay in sync with what's shown here.
 */
const RATES = [0.25, 0.5, 0.75, 1];

export function RecitePanel() {
  const mantra = usePlayback((s) => s.mantra);
  const playing = usePlayback((s) => s.playing);
  const activeIndex = usePlayback((s) => s.activeIndex);
  const rate = usePlayback((s) => s.rate);
  const previewPos = usePlayback((s) => s.previewPos);
  const previewMudra = usePlayback((s) => s.previewMudra);
  const play = usePlayback((s) => s.play);
  const playFrom = usePlayback((s) => s.playFrom);
  const stop = usePlayback((s) => s.stop);
  const setRate = usePlayback((s) => s.setRate);
  const setPreview = usePlayback((s) => s.setPreview);
  const setPreviewMudra = usePlayback((s) => s.setPreviewMudra);

  // Keep the active syllable scrolled into view within the capped strip.
  const activeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex]);

  if (!mantra) return null;

  const step = activeIndex >= 0 ? referenceStep() : null;

  return (
    <div className="panel recite-panel">
      <div className="panel-header">
        {mantra.reference}
        {mantra.validated ? (
          <span className="badge-ok">validated</span>
        ) : mantra.pdfChecked ? (
          <span className="badge-checked">PDF-checked · reciter pending</span>
        ) : (
          <span className="badge-unvalidated">unvalidated</span>
        )}
      </div>

      <div className="syllables">
        {mantra.syllables.map((s, i) => (
          <span
            key={i}
            ref={i === activeIndex ? activeRef : undefined}
            role="button"
            tabIndex={0}
            onClick={() => playFrom(s.startMs ?? 0)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && playFrom(s.startMs ?? 0)}
            className={`syllable svara-${s.svara} ${i === activeIndex ? "active" : ""}`}
            title={`${s.transliteration ? s.transliteration + " · " : ""}${s.svara} — click to play from here`}
          >
            {s.devanagari}
          </span>
        ))}
      </div>

      <div className="recite-controls">
        <button onClick={() => (playing ? stop() : play())}>
          {playing ? "■ Stop" : "▶ Recite along"}
        </button>
        <div className="speed-control" role="group" aria-label="Playback speed">
          {RATES.map((r) => (
            <button
              key={r}
              className={`speed-btn ${r === rate ? "active" : ""}`}
              onClick={() => setRate(r)}
            >
              {r}×
            </button>
          ))}
        </div>
        <div className="pose-tester" role="group" aria-label="Arm pose tester">
          <span className="muted">arm:</span>
          {POSES.map((p) => (
            <button
              key={p}
              className={`speed-btn ${p === previewPos ? "active" : ""}`}
              onClick={() => setPreview(p === previewPos ? null : p)}
            >
              {ARM_POSITIONS[p].name}
            </button>
          ))}
        </div>
        <div className="pose-tester" role="group" aria-label="Finger shape tester">
          <span className="muted">hand:</span>
          {MUDRAS.map((m) => (
            <button
              key={m}
              className={`speed-btn ${m === previewMudra ? "active" : ""}`}
              onClick={() => setPreviewMudra(m === previewMudra ? null : m)}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="gesture-readout">
          {step ? (
            <>
              <strong>{ARM_POSITIONS[step.position].name}</strong> — {step.instruction}
            </>
          ) : (
            <span className="muted">Press play to begin</span>
          )}
        </div>
      </div>
    </div>
  );
}

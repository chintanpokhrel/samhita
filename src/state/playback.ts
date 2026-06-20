import { create } from "zustand";
import { useEffect, useRef } from "react";
import type { Mantra, FingerShape } from "../content/schema";
import { compileGestures, type GestureStep, type ArmPosition } from "../content/gestures";

const HOME_STEP: GestureStep = {
  position: "udatta",
  waypoints: ["udatta"],
  instruction: "Udātta — arm at a right angle (home).",
};

/**
 * Single source of truth for recitation playback. The recite-along strip, the
 * avatar's arm, and the student-feedback engine all read from here, so they
 * stay in lockstep on a single clock.
 *
 * `steps` is the compiled arm-motion sequence (one per syllable), produced once
 * per mantra by `compileGestures`.
 */
interface PlaybackStore {
  mantra: Mantra | null;
  steps: GestureStep[];
  playing: boolean;
  elapsedMs: number;
  /** Playback speed multiplier (1 = real time). */
  rate: number;
  /** Index into mantra.syllables, or -1 when nothing is active. */
  activeIndex: number;
  /** Bumped on each play/seek so the clock restarts from `elapsedMs`. */
  epoch: number;
  /** Dev pose tester: when set, the avatar holds this position (overrides playback). */
  previewPos: ArmPosition | null;
  /** Dev finger tester: when set, the avatar holds this finger shape. */
  previewMudra: FingerShape | null;

  setMantra: (m: Mantra) => void;
  play: () => void;
  /** Start (or jump) playback from a given time offset in ms. */
  playFrom: (ms: number) => void;
  stop: () => void;
  setRate: (rate: number) => void;
  setPreview: (pos: ArmPosition | null) => void;
  setPreviewMudra: (m: FingerShape | null) => void;
  /** Internal: advance the clock; recomputes activeIndex and ends playback. */
  _setElapsed: (ms: number) => void;
}

export const usePlayback = create<PlaybackStore>((set, get) => ({
  mantra: null,
  steps: [],
  playing: false,
  elapsedMs: 0,
  rate: 0.75, // default — 1x is too fast to follow, 0.5x drags
  activeIndex: -1,
  epoch: 0,
  previewPos: null,
  previewMudra: null,

  setMantra: (m) =>
    set({
      mantra: m,
      steps: compileGestures(m.syllables),
      elapsedMs: 0,
      activeIndex: -1,
      playing: false,
    }),
  play: () =>
    set((s) => ({ playing: true, elapsedMs: 0, activeIndex: -1, epoch: s.epoch + 1, previewPos: null })),
  playFrom: (ms) => {
    const { mantra, epoch } = get();
    if (!mantra) return;
    const idx = mantra.syllables.findIndex(
      (s) => ms >= (s.startMs ?? 0) && ms < (s.endMs ?? 0),
    );
    set({ playing: true, elapsedMs: ms, activeIndex: idx, epoch: epoch + 1, previewPos: null });
  },
  stop: () => set({ playing: false, elapsedMs: 0, activeIndex: -1 }),
  setRate: (rate) => set({ rate }),
  setPreview: (previewPos) => set({ previewPos }),
  setPreviewMudra: (previewMudra) => set({ previewMudra }),

  _setElapsed: (ms) => {
    const { mantra } = get();
    if (!mantra) return;
    const total = mantra.syllables.at(-1)?.endMs ?? 0;
    if (ms >= total) {
      set({ playing: false, elapsedMs: 0, activeIndex: -1 });
      return;
    }
    const idx = mantra.syllables.findIndex(
      (s) => ms >= (s.startMs ?? 0) && ms < (s.endMs ?? 0),
    );
    set({ elapsedMs: ms, activeIndex: idx });
  },
}));

/** The arm-motion step for the syllable currently being recited (home if none). */
export function referenceStep(): GestureStep {
  const { steps, activeIndex } = usePlayback.getState();
  if (activeIndex < 0) return HOME_STEP;
  return steps[activeIndex] ?? HOME_STEP;
}

/**
 * Drives the playback clock with requestAnimationFrame while playing. Mount
 * once near the app root.
 */
export function usePlaybackClock() {
  const rafRef = useRef<number | null>(null);
  const playing = usePlayback((s) => s.playing);
  const epoch = usePlayback((s) => s.epoch);
  // When the active mantra has audio, the AudioPlayer drives the clock instead.
  const hasAudio = usePlayback((s) => !!s.mantra?.audio);

  useEffect(() => {
    if (!playing || hasAudio) return;
    // Start from the current position (supports seeking via playFrom) and
    // accumulate scaled time so changing `rate` mid-playback applies smoothly.
    let last = performance.now();
    let acc = usePlayback.getState().elapsedMs;
    const tick = () => {
      const now = performance.now();
      acc += (now - last) * usePlayback.getState().rate;
      last = now;
      usePlayback.getState()._setElapsed(acc);
      if (usePlayback.getState().playing) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, epoch, hasAudio]);
}

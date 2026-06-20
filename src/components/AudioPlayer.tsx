import { useEffect, useRef } from "react";
import { usePlayback } from "../state/playback";

/**
 * Plays the reference recitation for the active mantra and drives the playback
 * clock from the real audio time (so the syllable highlight + avatar follow the
 * actual recording). Active only when the current mantra has an `audio` segment;
 * otherwise the synthetic clock in usePlaybackClock runs instead.
 */
export function AudioPlayer() {
  const ref = useRef<HTMLAudioElement>(null);
  const audio = usePlayback((s) => s.mantra?.audio);
  const playing = usePlayback((s) => s.playing);
  const epoch = usePlayback((s) => s.epoch);
  const rate = usePlayback((s) => s.rate);

  // Keep playback rate in sync (preserve pitch so slow speeds stay listenable).
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.playbackRate = rate;
      el.preservesPitch = true;
    }
  }, [rate]);

  // Load the source file when it changes.
  useEffect(() => {
    const el = ref.current;
    if (el && audio && !el.src.endsWith(audio.url)) el.src = audio.url;
  }, [audio?.url]);

  // Start / seek / stop, and drive the clock while playing.
  useEffect(() => {
    const el = ref.current;
    if (!el || !audio) return;
    if (!playing) {
      el.pause();
      return;
    }
    el.currentTime = audio.start + usePlayback.getState().elapsedMs / 1000;
    el.playbackRate = rate;
    el.preservesPitch = true;
    el.play().catch(() => {});

    let raf = 0;
    const tick = () => {
      const e = ref.current;
      if (!e) return;
      if (e.currentTime >= audio.end || e.ended) {
        usePlayback.getState().stop();
        e.pause();
        return;
      }
      usePlayback.getState()._setElapsed((e.currentTime - audio.start) * 1000);
      if (usePlayback.getState().playing) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, epoch, audio]);

  return <audio ref={ref} preload="auto" />;
}

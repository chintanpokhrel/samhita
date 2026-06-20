import { useEffect, useState } from "react";
import type { Lesson } from "../content/schema";
import { usePlayback } from "../state/playback";

/** Pick which mantra of the lesson is loaded into the playback store. */
export function MantraSelector({ lesson }: { lesson: Lesson }) {
  const [index, setIndex] = useState(0);
  const setMantra = usePlayback((s) => s.setMantra);

  useEffect(() => {
    const m = lesson.mantras[index];
    if (m) setMantra(m);
  }, [index, lesson, setMantra]);

  const count = lesson.mantras.length;
  const go = (i: number) => setIndex(Math.min(count - 1, Math.max(0, i)));

  return (
    <div className="mantra-selector">
      <button onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous mantra">
        ‹
      </button>
      <select value={index} onChange={(e) => setIndex(Number(e.target.value))}>
        {lesson.mantras.map((m, i) => (
          <option key={m.id} value={i}>
            {m.reference}
          </option>
        ))}
      </select>
      <button
        onClick={() => go(index + 1)}
        disabled={index === count - 1}
        aria-label="Next mantra"
      >
        ›
      </button>
      <span className="muted">
        {index + 1} / {count}
      </span>
    </div>
  );
}

import { useState } from "react";
import "./App.css";
import { AvatarScene } from "./components/AvatarScene";
import { CameraPanel } from "./components/CameraPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RecitePanel } from "./components/RecitePanel";
import { MantraSelector } from "./components/MantraSelector";
import { AudioPlayer } from "./components/AudioPlayer";
import { SAMPLE_LESSON } from "./content/sample";
import { usePlaybackClock } from "./state/playback";

type Mode = "along" | "watch";

export default function App() {
  // Drive the recitation clock; the selector loads the chosen mantra.
  usePlaybackClock();
  const [mode, setMode] = useState<Mode>("along");

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>संहिता</h1>
          <div className="subtitle">
            Mādhyandina Saṃhitā recitation teacher · {SAMPLE_LESSON.title}
          </div>
        </div>
        <div className="header-controls">
          <div className="mode-toggle" role="group" aria-label="Mode">
            <button className={mode === "along" ? "active" : ""} onClick={() => setMode("along")}>
              Recite-along
            </button>
            <button className={mode === "watch" ? "active" : ""} onClick={() => setMode("watch")}>
              Avatar only
            </button>
          </div>
          <MantraSelector lesson={SAMPLE_LESSON} />
        </div>
      </header>

      <main className={`stage-grid ${mode === "watch" ? "watch" : ""}`}>
        <ErrorBoundary label="Avatar scene">
          <AvatarScene />
        </ErrorBoundary>
        {mode === "along" && (
          <ErrorBoundary label="Camera">
            <CameraPanel />
          </ErrorBoundary>
        )}
      </main>

      <footer className="app-footer">
        <ErrorBoundary label="Recite panel">
          <RecitePanel />
        </ErrorBoundary>
      </footer>

      <AudioPlayer />
    </div>
  );
}

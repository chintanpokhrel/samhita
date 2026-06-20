import "./App.css";
import { AvatarScene } from "./components/AvatarScene";
import { CameraPanel } from "./components/CameraPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RecitePanel } from "./components/RecitePanel";
import { MantraSelector } from "./components/MantraSelector";
import { AudioPlayer } from "./components/AudioPlayer";
import { SAMPLE_LESSON } from "./content/sample";
import { usePlaybackClock } from "./state/playback";

export default function App() {
  // Drive the recitation clock; the selector loads the chosen mantra.
  usePlaybackClock();

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>संहिता</h1>
          <div className="subtitle">
            Mādhyandina Saṃhitā recitation teacher · {SAMPLE_LESSON.title}
          </div>
        </div>
        <MantraSelector lesson={SAMPLE_LESSON} />
      </header>

      <main className="stage-grid">
        <ErrorBoundary label="Avatar scene">
          <AvatarScene />
        </ErrorBoundary>
        <ErrorBoundary label="Camera">
          <CameraPanel />
        </ErrorBoundary>
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

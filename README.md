# Sāmhitā — Madhyandina Saṃhitā recitation teacher

An interactive teacher for the **Mādhyandina Saṃhitā of the Śukla Yajurveda**.
What makes this recension distinctive is that correct recitation (*pāṭha*) is
performed with specific **hand and finger movements that encode the svaras**
(udātta / anudātta / svarita). This app teaches text + svara + gesture as one
synchronized unit, with a 3D avatar ācārya and camera-based feedback on the
student's hands.

## Status

Working web core (also runs as a Tauri desktop app). It includes:

- **Real text** — Mādhyandina Saṃhitā adhyāya 1 (accented Devanāgarī from a
  Unicode corpus), parsed to per-syllable svara by `src/content/devanagari.ts`.
- **Svara → arm-gesture compiler** (`compileGestures`) — derived and validated
  against a full hand annotation of VS 1.1.
- **3D avatar ācārya** (`three-vrm`) seated cross-legged, right arm + fingers
  driven by the compiled gesture timeline; finger mudrās (visarga, halant-fist…)
  in progress.
- **Reference audio** for the invocation + VS 1.1–1.8, segmented per mantra; the
  recite clock follows the real recording.
- **Live camera feedback** — MediaPipe hand + pose tracking grades the student's
  arm position against the reference in real time.
- Recite-along strip with a verse selector, speed control, and click-to-seek.

## ⚠️ Sacred-content accuracy

Text comes from a scholarly Unicode corpus; VS 1.1–1.3 have been cross-checked
against the source PDF (`pdfChecked`). The arm-gesture rule reproduces a full
reciter annotation of VS 1.1. **Nothing is `validated: true` yet** — that flag is
reserved for a qualified reciter's final sign-off on text + svara + gesture +
timing. Finger gestures and per-syllable audio alignment are still being refined.

## Architecture

| Layer | Tech |
|-------|------|
| UI / 3D | React 19, react-three-fiber, drei |
| Avatar | VRM (`@pixiv/three-vrm`) |
| Vision | MediaPipe Tasks (`HandLandmarker`, later `PoseLandmarker`) |
| Audio | Web Audio API |
| Desktop shell | **Tauri** (`src-tauri/`, WebView2) |
| Mobile (later) | same web core as PWA / Capacitor |

## Build order (the plan)

1. ✅ Content model + real corpus text (accented Devanāgarī → svara via `devanagari.ts`)
2. ✅ Recite-along player (syllable + svara highlight, selector, speed, click-to-seek)
3. ✅ Avatar reciting — VRM arm driven by the svara→gesture compiler (validated vs VS 1.1)
4. ✅ Camera + hand & pose tracking; arm-position feedback graded in real time
5. ✅ Reference audio integrated (invocation + VS 1.1–1.8), recite clock follows it
6. 🟡 Finger mudrās — visarga + halant(fist) wired; long/short guṅg + curl tuning pending
7. ⬜ Per-syllable audio onset alignment (currently even-spread within each verse)
8. ⬜ More gestures: hand-flip, flip-and-pull (at ground / thigh)
9. ⬜ Reciter validation pass; expand to more adhyāyas; lip-sync; a production avatar

## Develop

```sh
pnpm install
pnpm assets     # copy MediaPipe WASM + download the hand-landmark model into public/
pnpm dev        # open http://localhost:5173 — allow camera access
pnpm typecheck
```

The MediaPipe WASM and model are served **locally** from `public/mediapipe`
(populated by `pnpm assets`) so the app runs offline with no cross-origin
dependency. These files are git-ignored; re-run `pnpm assets` after a fresh clone.

### Local assets (git-ignored — provide your own)

These are not committed (size / source rights); the app falls back gracefully or
needs them supplied locally:

- `public/avatar.vrm` — rigged humanoid avatar. The scene auto-detects it and
  otherwise renders a primitive placeholder. (Author in VRoid Studio / Blender.)
- `public/audio/adhyaya1.m4a` — reference recitation. Extract from a recording
  with ffmpeg; segment boundaries live in `src/content/audioSegments.ts`.
- `public/mediapipe/**` — run `pnpm assets`.

### Desktop shell (Tauri)

The Tauri shell lives in `src-tauri/`. It wraps the same web core in a native
window via WebView2.

```sh
pnpm tauri dev      # launch the desktop app (runs `pnpm dev` + opens a window)
pnpm tauri build    # produce a distributable installer
```

Requires the Rust toolchain (`rustup`, MSVC), MSVC C++ build tools, and the
WebView2 runtime (preinstalled on Windows 11).

# Sāmhitā — Project Status & Roadmap

_Last updated: June 2026._

An interactive teacher for the **Mādhyandina Saṃhitā of the Śukla Yajurveda** —
teaching recitation as one synchronized unit of **text + svara + hand gesture**,
with a 3D avatar ācārya, reference audio, and live camera feedback.

---

## Where we are

The full teaching loop works end to end on one clock: pick a verse → the avatar
recites it (real audio + svara-driven arm/finger gestures) while the syllables
highlight, and the camera grades the student's arm position in real time.

### What works today

- **Text** — Mādhyandina Saṃhitā, adhyāya 1 (all 31 verses) as accented
  Devanāgarī from a Unicode corpus, parsed to per-syllable svara.
- **Svara → arm-gesture compiler** — derived from and **validated against a full
  hand annotation of VS 1.1** (reproduces all 81 syllables exactly).
- **3D avatar ācārya** (VRM) — seated cross-legged, right arm + fingers driven by
  the compiled gesture timeline; loads any VRM 0.x/1.0 without rework.
- **Finger mudrās** — visarga and word-final halant (fist) auto-detected from the
  text and applied to the hand.
- **Reference audio** — the reciter's recording for the invocation + VS 1.1–1.8,
  segmented per mantra; the recite clock follows the real audio (pitch-preserved
  slow-down).
- **Live camera feedback** — MediaPipe hand + pose tracking derives the student's
  right-arm position (body-relative) and grades it against the reference.
- **UI** — verse selector, speed control (0.25–1×), click-a-syllable to seek,
  height-capped auto-scrolling recite strip, and a **Recite-along / Avatar-only**
  mode toggle.

---

## The gesture model (the core convention, recorded)

**Arm positions:** `udatta` (home, arm at a right angle) · `ground` (floor) ·
`shoulder` · `rightThigh` · `left`. Each akshara maps to **one** position; the
avatar interpolates between them, so a "dip then rise" plays out across syllables.

**Rule** (in `compileGestures`, validated vs VS 1.1):
- A **svarita** falls from the shoulder to the `udatta` **home**.
- A **low passage** runs from an anudātta to the resolving svarita:
  - **single** anudātta → it sits at the `ground`; following unmarked syllables
    **hold at the `shoulder`** until the svarita.
  - **two+** anudāttas → the **first** goes to the `rightThigh` (followers hold
    `left`); the later anudātta(s) go to the `ground` (followers hold `shoulder`).
- Outside a passage, udātta/pracaya rest at **home**, except a udātta right before
  a svarita rises to the **shoulder** (so the svarita can fall — e.g. "ha" → "riḥ").

**Finger mudrās** (right hand): `default` (open) · `visarga` (index+little out,
middle+ring curled) · `fist` (halant) · `longGung` · `shortGung`. Visarga is
treated as its own short beat at home.

**Svara marks:** anudātta ॒ (U+0952) · svarita ॑ (U+0951) · udātta unmarked.

---

## Architecture & key files

| Area | Files |
|------|-------|
| Text → svara parsing | `src/content/devanagari.ts` (syllabifier + svara + mudrā) |
| Corpus text | `src/content/vsData.ts` (auto-generated), `src/content/sample.ts` (lesson) |
| Gesture compiler | `src/content/gestures.ts` (`compileGestures`, arm-position vocab) |
| Content schema | `src/content/schema.ts` (`Syllable`, `Mantra`, `FingerShape`) |
| Playback state/clock | `src/state/playback.ts` (zustand store, seek, rate) |
| Avatar (VRM, bones) | `src/components/AvatarScene.tsx` (arm/finger/seated pose, framing) |
| Audio | `src/components/AudioPlayer.tsx`, `src/content/audioSegments.ts` |
| Camera feedback | `src/components/CameraPanel.tsx`, `src/vision/useTracking.ts`, `src/vision/classifyPose.ts` |
| Recite strip / controls | `src/components/RecitePanel.tsx`, `MantraSelector.tsx` |
| Desktop shell | `src-tauri/` (Tauri + WebView2) |

Stack: React 19 + react-three-fiber + `@pixiv/three-vrm` + MediaPipe Tasks;
Vite; optional Tauri desktop build.

---

## Content & validation status

Three-state trust ladder per mantra:
- **unvalidated** → corpus text, not yet checked.
- **pdfChecked** → accents cross-checked against the source PDF. _Done: VS 1.1–1.3._
- **validated** → signed off by a qualified reciter. _Not yet set for anything —
  this is the final gate before the app should be relied upon to teach._

The arm-gesture rule is validated against the VS 1.1 annotation; other verses use
the same rule but haven't been individually checked against a reciter.

---

## Known limitations

- **Per-syllable audio sync is approximate** — syllables are evenly spread across
  each verse's real audio duration, not aligned to actual onsets.
- **Finger curl directions / thumb** poses are first-pass and rig-dependent; may
  need tuning per avatar.
- **Sukhāsana** is a bone approximation; the sample/VRoid avatar wears shoes
  (swap to barefoot in the model for a cleaner look).
- **Audio + avatar + VRM assets are git-ignored** (size / personal recording) —
  see README for how to supply them.
- Only **adhyāya 1** text is loaded; audio only for the invocation + VS 1.1–1.8.

---

## Pending / Roadmap

1. **More finger gestures** — long/short guṅg wired in the model but need
   real-world detail + curl tuning; _gathering info._
2. **Hand-flip and flip-and-pull** (at the ground / thigh positions) — new motions
   to model from recitation; _gathering info._
3. **Per-syllable audio alignment** — mark each syllable's onset (manual or forced
   alignment) for tight sync.
4. **Avatar polish** — barefoot/traditional attire, refine the sukhāsana, optional
   lip-sync.
5. **Broaden content** — cross-check remaining adhyāya-1 verses, add more adhyāyas
   (re-run the corpus generator), record their audio.
6. **Reciter validation pass** — flip verses to `validated: true`.
7. **Packaging** — Tauri desktop build; later a mobile/PWA path.

---

See [README.md](./README.md) for setup, local assets, and how to run.

/**
 * Populate public/mediapipe with the assets the hand tracker loads locally:
 *  - the WASM fileset, copied from the installed @mediapipe/tasks-vision package
 *  - the hand_landmarker.task model, downloaded from Google's model storage
 *
 * Run after `pnpm install`:  pnpm assets
 */
import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmSrc = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDst = join(root, "public/mediapipe/wasm");

const MODELS = [
  {
    file: "hand_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  },
  {
    file: "pose_landmarker_lite.task",
    url: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  },
];

await mkdir(wasmDst, { recursive: true });
await cp(wasmSrc, wasmDst, { recursive: true });
console.log("✓ copied WASM fileset →", wasmDst);

for (const { file, url } of MODELS) {
  const path = join(root, "public/mediapipe", file);
  try {
    await stat(path);
    console.log("✓ model already present →", path);
  } catch {
    console.log("… downloading", file);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${file} download failed: ${res.status}`);
    await writeFile(path, Buffer.from(await res.arrayBuffer()));
    console.log("✓ downloaded →", path);
  }
}

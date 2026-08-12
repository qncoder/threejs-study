# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

Vue 3 + Vite + Three.js GLB model structure viewer/editor. The default model loaded at startup is `src/ZF18000.glb` (despite the project name being `f309-glb-viewer`). The UI is in Simplified Chinese — keep new user-facing strings in Chinese to match.

A more detailed walkthrough of every module lives in `docs/project-structure.md`. Read it before working on App-level features; it documents the per-file responsibilities, node interaction rules, hide/script/focus/delete rules, and session-save format.

## Commands

```bash
npm run dev      # vite dev server on 127.0.0.1
npm run build    # vite production build
npm test         # vitest run (one shot, non-watch)

# Run a single test file
npx vitest run src/nodeVisibility.test.js

# Run tests matching a name pattern
npx vitest run -t "隐藏"
```

Vitest is configured via `vite.config.js` with `test.include: ['src/**/*.test.js']` — tests live next to their source.

## Architecture: thin App.vue, fat modules

`src/App.vue` is the single page component, but it is intentionally a **coordinator**, not a feature host. The pattern across the codebase:

- Each piece of behavior is an independent `src/*.js` module that exports **pure functions** taking the Three.js root / node / state and returning new state (sets, transforms, dialog descriptors). They do not import Vue and do not mutate App refs directly.
- `App.vue` holds the reactive `ref(...)` state (node rows, hidden uuid set, selected uuid, dialog states, undo stack, etc.) and the long-lived Three.js objects (`scene`, `camera`, `renderer`, `controls`, `transformControls`, `loader`) declared as plain `let` outside the reactive system.
- For each user action, App calls the relevant module function and replaces the ref's value with the returned new state. **Do not mutate `Set` instances in place** — modules return a new `Set` (see `nodeVisibility.toggleHiddenNode`) and App swaps it. The "immutability" rule from the global coding-style guide is actively enforced this way in the existing code.

When adding a feature, follow the same split: write a `src/<feature>.js` with pure helpers + a `src/<feature>.test.js`, then wire it from `App.vue`.

## Critical cross-module contracts

These are not obvious from any single file but are load-bearing:

1. **Session node keys (`userData.viewerSessionNodeKey`)** — `modelSessionState.js` assigns a stable per-node key (path-based for original GLB nodes, `created:<uuid>` for viewer-created Object3Ds). Three.js regenerates `uuid` on every load, so any code that persists a node reference across reloads must round-trip through this key, not the uuid. `prepareLoadedModelStructure` (in `modelLoadSetup.js`) is the only place that bootstraps both the keys and the session restore in the right order — call it from `App.vue` after `GLTFLoader` finishes; don't reimplement the sequence.

2. **Viewer-created vs. original nodes (`userData.createdInViewer`)** — `modelGrouping.markViewerCreatedObject3D` tags any Object3D created by the editor. The flag drives deletion safety (`deleteCreatedObject3D` refuses to delete untagged nodes), the auto `_pos` mesh-wrapping in `initializeMeshObject3Ds`, and session restore (`isViewerCreated` decides whether to recreate the node on load). Never create an `Object3D` and `add` it to the scene without going through `createPartObject3D` / `markViewerCreatedObject3D` — silent breakage of delete/session-restore otherwise.

3. **Effective hidden visibility** — `hiddenNodeUuids` is a **flat set of uuids that have been explicitly hidden**. To know whether a node is *actually* invisible on screen, walk ancestors with `isNodeEffectivelyHidden(node, hiddenNodeUuids, root)`. Picking, selection-clearing, and the "all hidden" check all use the effective form. `collectEffectivelyHiddenNodeUuids` materializes the closure when you need a flat list (e.g., for rendering).

4. **Node control scripts (`userData.controlScript`)** — User-written JS bound to a node. `nodeScriptControl.runNodeControlScript` `new Function(...)`s the source with `node, setPosition, setRotationDeg, setScale, deg, THREE, scene` in scope. The script string is persisted to `userData.controlScript` and round-tripped through `modelSessionState`. Reuse the helper for any script execution — don't `eval` directly. Although only those six bindings are injected, scripts run with full page-global access — real scripts in `script/` use `console`, `requestAnimationFrame` / `cancelAnimationFrame`, `performance.now()`, and stash animation state on `window.__<name>Store` so the previous frame can be canceled on re-run.

5. **`<meshName>_pos` Object3Ds are kinematic pivots, not just wrappers** — On every model load, `initializeMeshObject3Ds` adds a viewer-created `<meshName>_pos` Object3D next to each mesh under the same parent. Session restore runs *before* this initialization (see `prepareLoadedModelStructure`) so previously-saved `_pos` objects are recognized and not duplicated (canonical test: `modelLoadSetup.test.js`). The `_pos` naming convention is **load-bearing for user scripts**: every mechanism script in `script/` looks up its driving points by exact name (`flap1_driving_shaft_pos`, `flap1_hydraulic_fixed_pos`, `flap1_hydraulic_slidingshaft_pos`, `flap1_output_shaft_pos`, `flap1_pos`, `tailbeam_hydraulic_fixed`, etc.) and then writes positions/rotations to those Object3Ds. Renaming `_pos` siblings or changing the wrapping behavior will silently break every saved user script.

## Testing notes

- Tests construct Three.js scenes directly with `new Object3D()` / `new Mesh(new BoxGeometry(...), new MeshBasicMaterial())` rather than loading GLBs. No DOM/canvas mocking is needed because the tested modules are pure.
- When you add a feature, the test bar set by `docs/project-structure.md` (right-click menu, hide rules, focus targets, safe deletion, script bind/clear, drop rules, session save/restore) is the expected coverage — match the style of `modelLoadSetup.test.js` / `nodeVisibility.test.js`.

## Additional module groups

These modules add capabilities beyond the core viewer/editor described above:

- **Camera switching** (`viewerCamera.js`) — creates perspective or orthographic cameras and converts between them. `updateViewerCameraProjection` handles viewport resize for both types.
- **Pose motion** (`poseMotion.js`) — imports a JSON pose file (`normalizePosePayload`), applies it to the model by matching node paths, and interpolates between a start and end pose with `applyPoseTransition`. Works alongside `mechanismMotion.js` (rule-based animation of named parts at a progress 0–1).
- **GLB export** (`modelExport.js`) — exports the edited model back to `.glb` via Three.js `GLTFExporter`. The filename convention is `<original>-edited.glb`.
- **Monaco Editor** (`ScriptCodeEditor.vue`) — wraps `monaco-editor` for the script editing dialog. Ctrl+Enter triggers run. The component is `v-model`-bound and exposes `insertText` / `focus` for toolbar snippet buttons. `codeEditor.js` provides pure helpers for line counts, stats, and snippet insertion.
- **Node drop placement** (`nodeDropPlacement.js`) — complements `nodeDropRules.js` with a three-zone indicator (before/inside/after) based on cursor Y position within the row, enabling sibling reordering.
- **Node search** (`nodeSearch.js`) — filters the node list by keyword, matching against name/displayName/type/parentName/path. Returns a set of visible UUIDs that includes matched nodes and their subtrees.

## Other gotchas

- `index.html` loads `/src/main.js` which mounts `App.vue` into `#app`. There is no router — the app has two Vue components: `App.vue` (coordinator) and `ScriptCodeEditor.vue` (Monaco Editor wrapper for the node script dialog).
- The default GLB is imported via Vite's `?url` suffix: `import defaultModelUrl from './ZF18000.glb?url'`. New bundled models should follow the same pattern.
- `script/` contains user-authored example control scripts grouped by mechanism (`BackColumn/`, `Flap1_ZF18000/`, `Flap1_unity方法/`, `FlexBeamStrokeSlide/`, `FrontColumn/`, `FrontStroke/`, `TailBeam/`). They are reference snippets a user pastes into the node script dialog — not part of the build and not imported by the app. Two recurring patterns worth knowing when authoring new ones:
  - **Triangular-linkage solver** (`Flap1_ZF18000/run.js`, `Flap1_unity方法/untiy方法-测试完成.js`): name 5 reference Object3Ds A–E, capture initial pairwise distances once, then on each tick use the law of cosines to compute new world positions for C and D given a stepped `BC` length, write them with `setWorldPosition` (world → parent-local), and chain orientations with `customQuaternionLookAt` so each part faces the next.
  - **Re-runnable animated script** (`TailBeam/TailBeamMotion.js`): store the `requestAnimationFrame` id on `window.__<name>Store` and cancel the previous frame at the top of the script so re-executing replaces the running animation instead of layering on top; debug helpers added to `scene` use a stable name (e.g., `'TailBeam_ABC_Debug'`) and the script removes any prior helper of that name before redrawing.
- `.gitignore` excludes `dist/`, `node_modules/`, `vite-dev*.log`, `.tmp-*`, `test-results/`, and `playwright-report/`. The `vite-dev*.log` files in the working tree are runtime artifacts and should not be committed.
- `monaco-editor` is bundled via Vite workers (`editorWorker` + `tsWorker`). The setup lives in `ScriptCodeEditor.vue` — don't add a second `MonacoEnvironment` initialization.
- `scriptDebugHelpers.js` cleans up named debug Object3Ds (e.g. `TailBeam_ABC_Debug`) that user scripts add to the scene. If you add a new script mechanism that creates debug geometry, register the stable name in `SCRIPT_DEBUG_HELPER_NAMES` so it gets cleaned up.

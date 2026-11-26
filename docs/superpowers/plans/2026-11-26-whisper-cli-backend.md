# Whisper backend (whisper.node | whisper-cli) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every user choose how local Whisper runs — bundled `whisper-cpp-node` (whisper.node) or an external `whisper-cli` from whisper.cpp — and stop "Spustit přepis" from silently dropping jobs.

**Architecture:** The backend seam is `transcribeOnce()` in `ts/minutes/whisperTranscribe.main.ts`, which today calls `runWhisperTranscribeInProcess()` (utility process). A sibling `runWhisperCliTranscribe()` with the same request/result shape spawns `whisper-cli` on a temp 16 kHz WAV and parses its JSON. Backend availability for both is computed in `getCallSummaryExtensionPublic()`, so the settings dialog knows it before the user clicks anything. Pure logic (args, parsing, WAV encoding, backend resolution, blocked reason) lives in `*.std.ts` files with unit tests.

**Tech Stack:** TypeScript, Electron (main/preload/dom split by file suffix), React, mocha + chai via `electron-mocha` (`ts/test-node/minutes/*_test.*.ts`).

**Spec:** Design approved in conversation 2026-11-26 (no separate spec file — user rules forbid creating docs unless asked). Summary:
1. Settings `whisperBackend: 'node' | 'cli'` and `whisperCliPath: string` (`''` = find `whisper-cli` in `PATH`).
2. Default/effective backend: `node` if whisper.node loads, otherwise `cli`. Stored `node` with unavailable whisper.node falls back to `cli`. Stored `cli` never falls back to `node` (explicit choice; show reason instead).
3. Availability of both backends is known when the settings dialog opens; unavailable `node` is shown disabled with the reason; `cli` is never disabled, shows "nenalezen" + path field.
4. CLI backend: temp WAV, same parameters as today (language, prompt, temperature, beam/best_of, threads, GPU on/off + device index, VAD with the same thresholds and VAD model), JSON output, progress from stderr, job cancel kills the process.
5. `whisperRuntimeReady` reflects the effective backend; dialog shows which backend will run or why none can.
6. Silent return in `enqueue()` is logged and surfaced: button disabled with a reason tooltip, toast if enqueued anyway.
7. README, release notes (CHANGELOG `[Unreleased]`), in-app guide — **already written** in this branch (Task 0).

## Global Constraints

- Work on branch `feat/whisper-cli-backend` (from `upstream/beta`, 8.36.0-m1.6.4-beta.4).
- Fork rule (README-MINUTES "Klíčové pravidlo"): all logic in `ts/minutes/`; upstream Signal files only thin hooks; any upstream touch recorded in `docs/MINUTES-PATCHES.md`. `app/minutes_channel.main.ts` is already a registered Minutes file — editing it needs no new patch entry.
- No new npm dependencies. Use `node:child_process`, `node:fs/promises`, `node:os`.
- UI copy in Czech, exactly: backend labels **„Vestavěný (whisper.node)“**, **„Externí whisper-cli“**; section/row label **„Whisper backend“**; field label **„Cesta k whisper-cli“**; placeholder **„prázdné = whisper-cli z PATH“**.
- whisper.node unavailable reason shown in UI: the `error` from `checkWhisperRuntime()` (e.g. `Unsupported platform: linux-x64…`) prefixed with `whisper.node není k dispozici: `.
- whisper-cli not found reason: `whisper-cli nenalezen (<path or "PATH">)`.
- Segment timestamps passed downstream must stay in `HH:MM:SS,mmm` (parsed by `parseWhisperTimestampToMs` in `speakerActivityAlign.std.ts`).
- Dependencies: `node_modules` is from the old 8.23 tree. Before Task 1 the user must refresh dependencies; ask the user which command to use (their rules require `uu-safe-*` wrappers for npm; the project uses pnpm).

## Review Focus

1. **whisper-cli path with spaces / non-ASCII** (e.g. `~/Dokumenty/Minutes`, user names with diacritics) — spawn with an args array, never a shell string. Test in Task 3 with a temp dir containing a space and `č`.
2. **CLI exits 0 but writes no JSON** (wrong model, unsupported flag in older whisper.cpp) — must reject with stderr tail, not resolve with empty segments. Test in Task 3.
3. **Cancel while CLI runs** — process killed, temp dir removed, `TranscriptionCancelledError` thrown. Test in Task 3.
4. **Stored `whisperBackend: 'cli'` but `whisper-cli` missing, whisper.node available** — no silent switch to node; `whisperRuntimeReady=false` with the not-found reason. Test in Task 2.
5. **Old settings file without the new keys** — normalizes to `whisperBackend: 'node'`, `whisperCliPath: ''`; Linux then resolves to `cli`. Test in Task 1 and Task 2.

---

### Task 0: Documentation (done)

**Files (modified, uncommitted):** `README-MINUTES.md` (Linux prerequisites item 5, new `### Whisper backend` under `## AI & Whisper`), `images/minutes/prirucka.md` (backend paragraph in „Přepis (Whisper)“, troubleshooting in „Přepis hovoru nejde“), `CHANGELOG.md` (`[Unreleased]` Added/Fixed).

- [ ] **Step 1:** User reviews the wording.
- [ ] **Step 2: Commit**

```bash
git add README-MINUTES.md images/minutes/prirucka.md CHANGELOG.md docs/superpowers/plans/2026-11-26-whisper-cli-backend.md
git commit -m "docs(minutes): whisper-cli backend and Linux transcription prerequisites"
```

### Task 1: Settings fields

**Files:**
- Modify: `ts/minutes/whisperTranscribeSettings.std.ts` (type `WhisperTranscribeSettingsPublic`, `DEFAULT_WHISPER_TRANSCRIBE_SETTINGS`, `normalizeWhisperTranscribeSettings`)
- Modify: `app/minutes_channel.main.ts:417-428` (IPC param type — add the two keys)
- Test: `ts/test-node/minutes/whisperTranscribeSettings_test.std.ts`

**Interfaces:**
- Produces: `export type WhisperBackend = 'node' | 'cli';` and settings keys `whisperBackend: WhisperBackend`, `whisperCliPath: string` (defaults `'node'`, `''`).

- [ ] **Step 1: Failing tests**

```ts
it('defaults whisperBackend to node and whisperCliPath to empty', () => {
  const s = normalizeWhisperTranscribeSettings(null);
  assert.equal(s.whisperBackend, 'node');
  assert.equal(s.whisperCliPath, '');
});
it('keeps cli backend and trims cli path', () => {
  const s = normalizeWhisperTranscribeSettings({ whisperBackend: 'cli', whisperCliPath: '  /usr/bin/whisper-cli ' });
  assert.equal(s.whisperBackend, 'cli');
  assert.equal(s.whisperCliPath, '/usr/bin/whisper-cli');
});
it('rejects unknown backend values', () => {
  assert.equal(normalizeWhisperTranscribeSettings({ whisperBackend: 'python' as never }).whisperBackend, 'node');
});
```

- [ ] **Step 2:** Run `pnpm exec cross-env NODE_ENV=test NODE_OPTIONS='--import=tsx' LANG=en-us electron-mocha --timeout 10000 --extension ts --file ts/test-node/setup.preload.ts ts/test-node/minutes/whisperTranscribeSettings_test.std.ts` — expect FAIL.
- [ ] **Step 3:** Implement the type, defaults and normalization; add both keys to the IPC param type.
- [ ] **Step 4:** Same command — expect PASS (all existing tests too).
- [ ] **Step 5:** Commit `feat(minutes): whisper backend settings fields`.

### Task 2: Backend resolution and blocked reason (pure)

**Files:**
- Create: `ts/minutes/whisperBackend.std.ts`
- Modify: `ts/minutes/callSummaryExtension.std.ts` (add `whisperBackend: WhisperBackendPublic` to `CallSummaryExtensionPublic` and its default)
- Test: `ts/test-node/minutes/whisperBackend_test.std.ts`

**Interfaces:**
- Consumes: `WhisperBackend` (Task 1).
- Produces:

```ts
export type WhisperBackendStatus = Readonly<{ ready: boolean; error?: string }>;
export type WhisperBackendPublic = Readonly<{
  preferred: WhisperBackend;          // stored setting
  effective: WhisperBackend | null;   // what will run; null = nothing can
  node: WhisperBackendStatus;
  cli: WhisperBackendStatus & { executable: string }; // resolved path or 'whisper-cli'
  reason: string | null;              // why effective is null (UI + log)
}>;
export function resolveWhisperBackend(input: {
  preferred: WhisperBackend; node: WhisperBackendStatus; cli: WhisperBackendStatus & { executable: string };
}): WhisperBackendPublic;
export function describeTranscriptionBlockedReason(
  state: CallSummaryExtensionPublic, hasPcmSidecar: boolean
): string | null;
```

Reason precedence for `describeTranscriptionBlockedReason`: missing PCM sidecar (`Přepis vyžaduje PCM záznam z nahrávání v Minutes`) → `state.whisperBackend.reason` → model not ready (`Whisper model není stažený — Nastavení Přepisů (Minutes)`) → not activated (`Přepis není aktivovaný — Nastavení Přepisů (Minutes)`) → `null`.

- [ ] **Step 1: Failing tests** — one `it` per row:

| preferred | node.ready | cli.ready | effective | reason |
|---|---|---|---|---|
| node | true | false | node | null |
| node | false | true | cli | null |
| node | false | false | null | `whisper.node není k dispozici: <node.error>; whisper-cli nenalezen (PATH)` |
| cli | true | true | cli | null |
| cli | true | false | null | `whisper-cli nenalezen (PATH)` (Review Focus 4) |

Plus `describeTranscriptionBlockedReason` precedence: sidecar missing wins over everything; all ok → `null`.

- [ ] **Step 2:** Run the test file — expect FAIL.
- [ ] **Step 3:** Implement. When `cli.executable` is a configured path, the reason shows that path instead of `PATH`.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit `feat(minutes): resolve effective whisper backend`.

### Task 3: whisper-cli runner

**Files:**
- Create: `ts/minutes/whisperCli.std.ts` (pure: args, progress parse, JSON parse, WAV encode)
- Create: `ts/minutes/whisperCliProcess.main.ts` (runtime check + spawn)
- Test: `ts/test-node/minutes/whisperCli_test.std.ts`, `ts/test-node/minutes/whisperCliProcess_test.node.ts`

**Interfaces:**
- Consumes: `WhisperWorkerRequest`, `WhisperWorkerSegment` (`whisperWorker.node.ts`), `WhisperWorkerResult` (`whisperWorkerProcess.main.ts`), `onTranscriptionJobCancelled`, `TranscriptionCancelledError` (`transcriptionCancel.main.ts`).
- Produces:

```ts
// whisperCli.std.ts
export function buildWhisperCliArgs(
  request: Omit<WhisperWorkerRequest, 'type' | 'pcmf32'>, wavPath: string, outputBase: string
): Array<string>;
export function parseWhisperCliProgress(line: string): number | null;
export function parseWhisperCliJson(json: unknown): WhisperWorkerResult;
export function encodePcmF32ToWav16k(pcmf32: Float32Array): Uint8Array; // mono, 16 kHz, s16le, RIFF header
// whisperCliProcess.main.ts
export function checkWhisperCliRuntime(cliPath: string): Promise<WhisperBackendStatus & { executable: string }>;
export function resetWhisperCliRuntimeCheck(): void;
export function runWhisperCliTranscribe(options: {
  executable: string; jobId: string | undefined;
  request: Omit<WhisperWorkerRequest, 'type' | 'pcmf32'>; pcmf32: Float32Array;
  onProgress?: (percent: number) => void;
}): Promise<WhisperWorkerResult>;
```

- [x] **Step 0a: Flags verified** against installed `whisper-cli --help` (whisper.cpp 1.9.5-dev, 2026-11-26): `-m <modelPath> -f <wav> -l <language> -t <threadCount> -tp <temperature> -bs <beam_size> -bo <best_of> --prompt <prompt> -sow -oj -of <outputBase> -pp`; GPU off → `-ng -nfa` (CLI default is flash attention **on**; whisper.node uses `flash_attn: useGpu`, so CPU must pass `-nfa`); GPU on → `-dev <gpuDeviceIndex> -fa`; VAD on → `--vad -vm <vadModelPath> -vt 0.45 -vspd 120 -vsd 80 -vp 180`.
- [x] **Step 0b: Verified with a real run** (ggml-tiny, 20 s Czech sample, 2026-11-26): (1) progress on **stderr**, exact line `whisper_print_progress_callback: progress = 100%`; (2) `-np` does **not** suppress `-pp` progress — keep `-np`; (3) JSON top-level keys `systeminfo, model, params, result, transcription`; `result = { "language": "cs" }`; segment sample `{"timestamps": {"from": "00:00:00,000", "to": "00:00:04,000"}, "offsets": {"from": 0, "to": 4000}, "text": " jsme chkěry, tady ten konfigurovat autofnemory."}` — use these verbatim as test fixtures. Missing model → exit code `3`, stderr `error: model file not found '<path>'`, no JSON written. With `ggml-cuda` installed stderr contains `ggml_cuda_init: found 1 CUDA devices`.
- [ ] **Step 1: Failing pure tests** (`whisperCli_test.std.ts`):
  - `buildWhisperCliArgs` for GPU on + VAD on equals the exact array from Step 0; GPU off contains `-ng` and `-nfa` and no `-dev`/`-fa`; VAD off contains no `--vad`/`-vm`.
  - `parseWhisperCliProgress('whisper_print_progress_callback: progress =  42%')` → `42`; unrelated line → `null`.
  - `parseWhisperCliJson` maps `timestamps.from/to` to `start/end` unchanged, trims text, drops empty-text segments, returns `language`; throws `Error('whisper-cli: neplatný JSON výstup')` when `transcription` is not an array.
  - `encodePcmF32ToWav16k(new Float32Array([0, 1, -1, 2]))`: length `44 + 8`, bytes 0–3 `RIFF`, 8–11 `WAVE`, sample rate field `16000`, samples `0, 32767, -32768, 32767` (clamped).
- [ ] **Step 2:** Run — expect FAIL.
- [ ] **Step 3:** Implement `whisperCli.std.ts`.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5: Failing process tests** (`whisperCliProcess_test.node.ts`) using a fake executable written to a temp dir whose path contains a space and `č` (Review Focus 1): a Node script with `#!/usr/bin/env node` that reads `-of` from argv, prints `progress = 50%` to stderr, writes `<of>.json` with one segment, exits 0. Cases:
  - resolves with the segment; `onProgress` called with `50`; temp dir removed afterwards.
  - fake exits 0 without writing JSON → rejects with message containing `whisper-cli` and the stderr tail (Review Focus 2).
  - fake exits 3 → rejects with `whisper-cli skončil s kódem 3` + stderr tail.
  - fake sleeps; `cancelTranscriptionJob(jobId)` → rejects with `TranscriptionCancelledError`, child killed, temp dir removed (Review Focus 3).
  - `checkWhisperCliRuntime('/nonexistent/whisper-cli')` → `{ ready: false, error: 'whisper-cli nenalezen (/nonexistent/whisper-cli)', executable: '/nonexistent/whisper-cli' }`.
- [ ] **Step 6:** Run — expect FAIL.
- [ ] **Step 7:** Implement `whisperCliProcess.main.ts`: `mkdtemp(join(tmpdir(), 'minutes-whisper-'))`, write WAV, `spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] })` (no shell), keep last 4 KB of stderr, `rm(dir, { recursive: true, force: true })` in every exit path. Runtime check: `spawn(executable, ['--help'])` with 5 s timeout, ready when it exits 0 and stderr/stdout mentions `usage`; cache per executable until `resetWhisperCliRuntimeCheck()`. Empty `cliPath` → executable `'whisper-cli'`.
- [ ] **Step 8:** Run — expect PASS.
- [ ] **Step 9:** Commit `feat(minutes): whisper-cli transcription runner`.

### Task 4: Wire backend into transcription and extension state

**Files:**
- Modify: `ts/minutes/whisperTranscribe.main.ts` (`WhisperTranscribeRuntimeOptions`, `transcribeOnce`, runtime check in `transcribePcm`)
- Modify: `ts/minutes/callSummaryExtension.main.ts` (`buildWhisperRuntimeOptions` :172, `getCallSummaryExtensionPublic` :242, `saveCallSummaryTranscribeSettings` :284, `installCallSummaryExtension` :413)
- Test: `ts/test-node/minutes/whisperBackend_test.std.ts` (extend only if new pure logic appears)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `WhisperTranscribeRuntimeOptions.backend: { kind: 'node' } | { kind: 'cli'; executable: string }`; `CallSummaryExtensionPublic.whisperBackend` filled; `whisperRuntimeReady === (whisperBackend.effective !== null)`.

- [ ] **Step 1:** Add a private `getWhisperBackendPublic(settings)` in `callSummaryExtension.main.ts` = `resolveWhisperBackend({ preferred, node: await checkWhisperRuntime(), cli: await checkWhisperCliRuntime(settings.whisperCliPath) })`, with the node error prefixed per Global Constraints. Use it in `getCallSummaryExtensionPublic`, `installCallSummaryExtension` (replace the `checkWhisperRuntime` gate; error message = `reason`) and `buildWhisperRuntimeOptions` (sets `backend`).
- [ ] **Step 2:** `saveCallSummaryTranscribeSettings` calls `resetWhisperCliRuntimeCheck()` when `whisperCliPath` changed.
- [ ] **Step 3:** `transcribeOnce` dispatches: `kind === 'cli'` → `runWhisperCliTranscribe({ executable, ... })`, else `runWhisperTranscribeInProcess`. `transcribePcm` skips the whisper.node readiness gate for `cli`. Default when `runtime.backend` is undefined stays `node` (keeps `testCallPipeline.main.ts` unchanged).
- [ ] **Step 4:** `gpuAcceleration.statusLabel` for effective `cli`: `whisper-cli — GPU zapnuto (zařízení <n>)` / `whisper-cli — CPU`; `devices: []`.
- [ ] **Step 5:** Run `pnpm exec tsc --noEmit -p .` (or the repo's typecheck script) and the whole `ts/test-node/minutes` folder — expect PASS.
- [ ] **Step 6:** Commit `feat(minutes): select whisper backend for transcription`.

### Task 5: Settings dialog

**Files:**
- Modify: `ts/minutes/components/MinutesCallSummaryExtensionModal.dom.tsx` (status row :265, „Výkon přepisu“ section)
- Modify: `ts/minutes/callSummaryExtensionService.preload.ts` (`saveWhisperTranscribeSettings` :103 passes new keys)

- [ ] **Step 1:** Replace row „Whisper runtime“ with „Whisper backend“: value = label of `effective` (`Vestavěný (whisper.node)` / `Externí whisper-cli — <executable>`), or `reason` when `effective === null` (not ok-styled).
- [ ] **Step 2:** Add section „Whisper backend“: two radio options with the exact labels; `node` disabled with `node.error` as hint when `!node.ready`; selected = `effective ?? preferred`. Text input „Cesta k whisper-cli“ (placeholder per constraints) shown when `cli` selected, saved on blur, then `refreshCallSummaryExtension()`. Under it the cli status (`ready` → executable, else error).
- [ ] **Step 3:** Hide the GPU device dropdown when effective is `cli`; show a number input for `gpuDeviceIndex` instead.
- [ ] **Step 4:** Manual check (Task 7). Commit `feat(minutes): whisper backend choice in transcription settings`.

### Task 6: No more silent drop

**Files:**
- Modify: `ts/minutes/transcriptionQueueService.preload.ts:74-76`
- Modify: `ts/minutes/components/MinutesRecordingDetail.dom.tsx:645` (`canTranscribe`) and the button at :1056-1068

- [ ] **Step 1:** In `enqueue()`, before returning on inactive extension: `log.warn('enqueue: transcription blocked', describeTranscriptionBlockedReason(getCallSummaryExtensionState(), true))` and `showCallSummaryExtensionRequiredToast()`.
- [ ] **Step 2:** In the recording detail: `blockedReason = describeTranscriptionBlockedReason(extensionState, entry?.hasPcmSidecar ?? false)`; `canTranscribe = blockedReason === null`; button `title={blockedReason ?? undefined}`. Extension state comes from the existing `callSummaryExtensionEvents` subscription at :333 (seed with `getCallSummaryExtensionState()`).
- [ ] **Step 3:** Typecheck + `ts/test-node/minutes` — PASS. Commit `fix(minutes): explain why transcription cannot start`.

### Task 7: End-to-end verification (Linux)

- [ ] **Step 1:** `whisper-cli --help` works; build AppImage per README „Linux AppImage (x64)“ and start it.
- [ ] **Step 2:** Nastavení Přepisů: „Vestavěný (whisper.node)“ disabled with `Unsupported platform: linux-x64…`; „Externí whisper-cli“ selected; row „Whisper backend“ shows `/usr/bin/whisper-cli`. Download Large v3 Turbo + activate.
- [ ] **Step 3:** Recording `2026-11-25T08-26-26-098Z_Jakub_Eliáš_01a03de0_78d2742b` → „Spustit přepis“: progress moves, log contains `ggml_cuda_init` (GPU) or runs on CPU; transcript has speakers aligned (compare with `~/Dokumenty/Minutes-prepisy/…mluvci.txt`).
- [ ] **Step 4:** Cancel a running job → stops immediately, no leftover `/tmp/minutes-whisper-*`.
- [ ] **Step 5:** Set cli path to `/nonexistent` → button disabled with tooltip `whisper-cli nenalezen (/nonexistent)`; log line `enqueue: transcription blocked` when triggered via auto-transcribe.
- [ ] **Step 6:** `pnpm run lint` (oxlint/prettier per repo scripts) clean on changed files. Final commit if fixes were needed.

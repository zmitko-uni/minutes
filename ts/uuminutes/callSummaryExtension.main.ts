// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { get as httpsGet } from 'node:https';
import { join } from 'node:path';

import { app, type WebContents } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import {
  DEFAULT_CALL_SUMMARY_EXTENSION,
  getWhisperModelDownloadUrl,
  getWhisperModelDownloadLabel,
  getWhisperModelMinBytes,
  WHISPER_MODEL_CATALOG,
  type CallSummaryExtensionProgress,
  type CallSummaryExtensionPublic,
  type WhisperModelPublic,
} from './callSummaryExtension.std.ts';
import { DEFAULT_WHISPER_MODEL } from './whisperSettings.std.ts';
import {
  AI_SETTINGS_DIR_NAME,
} from './constants.std.ts';
import {
  checkWhisperRuntime,
  resetWhisperRuntimeCheck,
  transcribePcm,
  isVadModelReady,
  type TranscribePcmResult,
} from './whisperTranscribe.main.ts';
import { preparePcmForWhisper } from './whisperAudioPrep.std.ts';
import { isAiSummaryEnabled, getAiSettingsPublic, getAiApiKey, isTranscriptCorrectionEnabled } from './aiSettings.main.ts';
import { generateAiSummaryForProvider } from './aiSummaryService.main.ts';
import { correctTranscriptWithAi } from './transcriptCorrection.main.ts';
import { DEFAULT_WHISPER_LANGUAGE, RECORDING_PCM_SIDECAR_SUFFIX, WHISPER_VAD_MODEL_FILE, WHISPER_VAD_MODEL_MIN_BYTES, WHISPER_VAD_MODEL_URL } from './whisperSettings.std.ts';
import { SPEAKER_ACTIVITY_FILE_SUFFIX } from './constants.std.ts';
import type {
  AlignedTranscriptSegment,
  SpeakerActivityLog,
} from './speakerActivity.std.ts';
import {
  alignWhisperSegmentsWithSpeakerActivity,
  formatAlignedSegmentsForAi,
  formatAlignedSegmentsForDisplay,
} from './speakerActivityAlign.std.ts';
import { countDistinctSpeakersInLog } from './speakerWindowAlign.std.ts';
import { transcribePcmWithSpeakerWindows } from './transcribeBySpeakerWindows.main.ts';

const log = createLogger('uuminutes/callSummaryExtension');

const EXTENSION_FILE_NAME = 'call-summary-extension.json';
const MODELS_DIR_NAME = 'uuMinutes/models';

type StoredExtension = {
  activated: boolean;
  modelFileName: string;
  installedAt?: number;
};

type ProgressSender = (progress: CallSummaryExtensionProgress) => void;

function getModelsDir(): string {
  return join(app.getPath('userData'), MODELS_DIR_NAME);
}

function getExtensionSettingsPath(): string {
  return join(app.getPath('userData'), AI_SETTINGS_DIR_NAME, EXTENSION_FILE_NAME);
}

async function readStoredExtension(): Promise<StoredExtension | null> {
  try {
    const raw = await readFile(getExtensionSettingsPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredExtension>;
    if (!parsed.modelFileName) {
      return null;
    }
    return {
      activated: Boolean(parsed.activated),
      modelFileName: parsed.modelFileName,
      installedAt: parsed.installedAt,
    };
  } catch {
    return null;
  }
}

async function writeStoredExtension(stored: StoredExtension): Promise<void> {
  const path = getExtensionSettingsPath();
  await mkdir(join(app.getPath('userData'), AI_SETTINGS_DIR_NAME), {
    recursive: true,
  });
  await writeFile(path, JSON.stringify(stored, null, 2), 'utf8');
}

async function getModelPath(modelFileName: string): Promise<string> {
  return join(getModelsDir(), modelFileName);
}

async function isModelReady(modelFileName: string): Promise<{
  ready: boolean;
  sizeBytes: number | null;
}> {
  try {
    const modelPath = await getModelPath(modelFileName);
    const fileStat = await stat(modelPath);
    const minBytes = getWhisperModelMinBytes(modelFileName);
    return {
      ready: fileStat.size >= minBytes,
      sizeBytes: fileStat.size,
    };
  } catch {
    return { ready: false, sizeBytes: null };
  }
}

async function getAvailableModelsPublic(): Promise<
  ReadonlyArray<WhisperModelPublic>
> {
  const models: Array<WhisperModelPublic> = [];

  for (const definition of WHISPER_MODEL_CATALOG) {
    const status = await isModelReady(definition.fileName);
    models.push({
      fileName: definition.fileName,
      label: definition.label,
      description: definition.description,
      downloadLabel: definition.downloadLabel,
      recommended: Boolean(definition.recommended),
      installed: status.sizeBytes != null,
      installedSizeBytes: status.sizeBytes,
      ready: status.ready,
    });
  }

  return models;
}

export async function getCallSummaryExtensionPublic(): Promise<CallSummaryExtensionPublic> {
  const runtime = await checkWhisperRuntime();
  const availableModels = await getAvailableModelsPublic();
  const stored = await readStoredExtension();

  if (!stored) {
    return {
      ...DEFAULT_CALL_SUMMARY_EXTENSION,
      whisperRuntimeReady: runtime.ready,
      recommendedModelFileName: DEFAULT_WHISPER_MODEL.fileName,
      availableModels,
    };
  }

  const modelStatus = await isModelReady(stored.modelFileName);

  return {
    activated: stored.activated && modelStatus.ready && runtime.ready,
    modelReady: modelStatus.ready,
    whisperRuntimeReady: runtime.ready,
    modelFileName: stored.modelFileName,
    modelSizeBytes: modelStatus.sizeBytes,
    installedAt: stored.installedAt ?? null,
    recommendedModelFileName: DEFAULT_WHISPER_MODEL.fileName,
    availableModels,
  };
}

export type InstallCallSummaryExtensionOptions = Readonly<{
  modelFileName?: string;
  forceRedownload?: boolean;
}>;

async function ensureVadModel(
  sendProgress: ProgressSender = () => undefined
): Promise<void> {
  const vadPath = join(getModelsDir(), WHISPER_VAD_MODEL_FILE);
  try {
    const fileStat = await stat(vadPath);
    if (fileStat.size >= WHISPER_VAD_MODEL_MIN_BYTES) {
      return;
    }
  } catch {
    // download below
  }

  sendProgress({
    phase: 'downloading',
    message: 'Stahuji VAD model (Silero)…',
    percent: 0,
  });

  await downloadFile(WHISPER_VAD_MODEL_URL, vadPath, (loaded, total) => {
    const percent =
      total && total > 0
        ? Math.min(99, Math.round((loaded / total) * 100))
        : undefined;
    sendProgress({
      phase: 'downloading',
      message: 'Stahuji VAD model…',
      percent,
    });
  });
}

async function loadRecordingPcmSidecar(
  recordingPath: string,
  fallback: Float32Array,
  sampleRate = 48_000
): Promise<Float32Array> {
  const basePath = recordingPath.replace(/\.mp3$/i, '');
  const pcmPath = `${basePath}${RECORDING_PCM_SIDECAR_SUFFIX}`;
  try {
    const raw = await readFile(pcmPath);
    if (raw.byteLength < 4) {
      return preparePcmForWhisper(fallback, 16_000);
    }
    const pcm48 = new Float32Array(
      raw.buffer,
      raw.byteOffset,
      Math.floor(raw.byteLength / 4)
    );
    if (pcm48.length === 0) {
      return preparePcmForWhisper(fallback, 16_000);
    }
    return preparePcmForWhisper(pcm48, sampleRate);
  } catch {
    return preparePcmForWhisper(fallback, 16_000);
  }
}

function downloadFile(
  url: string,
  destination: string,
  onProgress: (loaded: number, total: number | null) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = httpsGet(url, response => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        downloadFile(response.headers.location, destination, onProgress)
          .then(resolve)
          .catch(reject);
        response.resume();
        return;
      }

      if (response.statusCode !== 200) {
        reject(
          new Error(
            `Stažení modelu selhalo (HTTP ${response.statusCode ?? 'unknown'})`
          )
        );
        response.resume();
        return;
      }

      const total = Number(response.headers['content-length'] ?? 0) || null;
      let loaded = 0;
      const fileStream = createWriteStream(destination);

      response.on('data', chunk => {
        loaded += chunk.length;
        onProgress(loaded, total);
      });

      response.pipe(fileStream);
      fileStream.on('finish', () => resolve());
      fileStream.on('error', reject);
      response.on('error', reject);
    });

    request.on('error', reject);
  });
}

export async function installCallSummaryExtension(
  sendProgress: ProgressSender,
  options: InstallCallSummaryExtensionOptions = {}
): Promise<CallSummaryExtensionPublic> {
  sendProgress({
    phase: 'checking',
    message: 'Kontroluji lokální Whisper…',
  });

  resetWhisperRuntimeCheck();
  const runtime = await checkWhisperRuntime();
  if (!runtime.ready) {
    const message =
      runtime.error ??
      'Nelze načíst whisper-cpp-node. Zkuste znovu spustit instalaci závislostí.';
    sendProgress({ phase: 'error', message });
    throw new Error(message);
  }

  const modelFileName =
    options.modelFileName ?? DEFAULT_WHISPER_MODEL.fileName;
  if (!WHISPER_MODEL_CATALOG.some(model => model.fileName === modelFileName)) {
    throw new Error(`Neznámý Whisper model: ${modelFileName}`);
  }

  const modelsDir = getModelsDir();
  await mkdir(modelsDir, { recursive: true });

  const modelPath = await getModelPath(modelFileName);
  let existing = await isModelReady(modelFileName);

  if (options.forceRedownload && existing.sizeBytes != null) {
    sendProgress({
      phase: 'checking',
      message: 'Odstraňuji starý model…',
    });
    try {
      await unlink(modelPath);
    } catch {
      // ignore missing file
    }
    existing = { ready: false, sizeBytes: null };
  }

  if (!existing.ready) {
    const downloadUrl = getWhisperModelDownloadUrl(modelFileName);
    const downloadLabel = getWhisperModelDownloadLabel(modelFileName);
    sendProgress({
      phase: 'downloading',
      message: `Stahuji ${modelFileName} (${downloadLabel})…`,
      percent: 0,
    });

    await downloadFile(downloadUrl, modelPath, (loaded, total) => {
      const percent =
        total && total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : undefined;
      sendProgress({
        phase: 'downloading',
        message: `Stahuji ${modelFileName}…`,
        percent,
      });
    });
  }

  sendProgress({
    phase: 'verifying',
    message: 'Ověřuji model…',
    percent: 100,
  });

  const verified = await isModelReady(modelFileName);
  if (!verified.ready) {
    const message = 'Stažený model je neúplný. Zkuste instalaci zopakovat.';
    sendProgress({ phase: 'error', message });
    throw new Error(message);
  }

  await ensureVadModel(sendProgress);

  const installedAt = Date.now();
  await writeStoredExtension({
    activated: true,
    modelFileName,
    installedAt,
  });

  sendProgress({
    phase: 'complete',
    message: 'Rozšíření Sumarizace hovoru je aktivní.',
    percent: 100,
  });

  log.info('call summary extension installed');
  return getCallSummaryExtensionPublic();
}

function formatTranscriptMarkdown(options: {
  conversationTitle: string;
  startedAt: number;
  endedAt: number;
  result: TranscribePcmResult;
  activityLog?: SpeakerActivityLog | null;
  alignedSegments?: ReadonlyArray<AlignedTranscriptSegment>;
}): string {
  const lines = [
    `# Přepis hovoru: ${options.conversationTitle}`,
    '',
    `- Začátek: ${new Date(options.startedAt).toLocaleString('cs-CZ')}`,
    `- Konec: ${new Date(options.endedAt).toLocaleString('cs-CZ')}`,
    `- Délka: ${Math.round((options.endedAt - options.startedAt) / 1000)} s`,
    '',
    '## Přepis',
    '',
  ];

  const alignedSegments =
    options.alignedSegments ??
    alignWhisperSegmentsWithSpeakerActivity(
      options.result.segments,
      options.activityLog
    );

  if (alignedSegments.length > 0) {
    lines.push(formatAlignedSegmentsForDisplay(alignedSegments));
    lines.push('');
  } else if (options.result.text) {
    lines.push(options.result.text);
    lines.push('');
  } else {
    lines.push('_Přepis je prázdný._');
    lines.push('');
  }

  return lines.join('\n');
}

async function loadSpeakerActivityLog(
  recordingPath: string
): Promise<SpeakerActivityLog | null> {
  const basePath = recordingPath.replace(/\.mp3$/i, '');
  const activityPath = `${basePath}${SPEAKER_ACTIVITY_FILE_SUFFIX}`;
  try {
    const raw = await readFile(activityPath, 'utf8');
    const parsed = JSON.parse(raw) as SpeakerActivityLog;
    if (parsed?.version !== 1 || !Array.isArray(parsed.samples)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function transcribeCallRecording(options: {
  pcmf32: Float32Array;
  conversationId: string;
  conversationTitle: string;
  startedAt: number;
  endedAt: number;
  recordingPath: string;
  onProgress?: (percent: number) => void;
}): Promise<{
  transcriptPath: string;
  transcriptText: string;
  summaryPath?: string;
}> {
  const extension = await getCallSummaryExtensionPublic();
  if (!extension.activated || !extension.modelFileName) {
    throw new Error('Rozšíření Sumarizace hovoru není aktivní.');
  }

  const modelPath = await getModelPath(extension.modelFileName);
  const activityLog = await loadSpeakerActivityLog(options.recordingPath);
  const pcmf32 = await loadRecordingPcmSidecar(
    options.recordingPath,
    options.pcmf32
  );

  if (!(await isVadModelReady())) {
    try {
      await ensureVadModel();
    } catch (error) {
      log.warn('VAD model download skipped', error);
    }
  }

  const useSpeakerWindows =
    activityLog != null &&
    activityLog.samples.length > 0 &&
    countDistinctSpeakersInLog(activityLog) >= 1;

  const transcription = useSpeakerWindows
    ? await transcribePcmWithSpeakerWindows({
        modelPath,
        pcmf32,
        activityLog,
        language: DEFAULT_WHISPER_LANGUAGE,
        onProgress: options.onProgress,
      })
    : {
        ...(await transcribePcm({
          modelPath,
          pcmf32,
          language: DEFAULT_WHISPER_LANGUAGE,
          onProgress: options.onProgress,
        })),
        alignedSegments: [] as Array<AlignedTranscriptSegment>,
      };

  const { alignedSegments: speakerAlignedSegments, ...result } = transcription;

  const basePath = options.recordingPath.replace(/\.mp3$/i, '');
  const transcriptPath = `${basePath}.transcript.md`;
  const alignedSegments: Array<AlignedTranscriptSegment> =
    speakerAlignedSegments.length > 0
      ? [...speakerAlignedSegments]
      : [...alignWhisperSegmentsWithSpeakerActivity(result.segments, activityLog)];
  const transcriptForAi =
    alignedSegments.length > 0
      ? formatAlignedSegmentsForAi(alignedSegments)
      : result.text;
  let transcriptForDisplay =
    alignedSegments.length > 0
      ? formatAlignedSegmentsForDisplay(alignedSegments)
      : result.text;

  const whisperMarkdown = formatTranscriptMarkdown({
    conversationTitle: options.conversationTitle,
    startedAt: options.startedAt,
    endedAt: options.endedAt,
    result,
    activityLog,
    alignedSegments: [...alignedSegments],
  });
  await writeFile(`${basePath}.transcript.whisper.md`, whisperMarkdown, 'utf8');

  if (await isTranscriptCorrectionEnabled()) {
    options.onProgress?.(95);
    const settings = await getAiSettingsPublic();
    const apiKey = await getAiApiKey(settings.provider);
    if (apiKey && transcriptForAi.length > 0) {
      try {
        const corrected = await correctTranscriptWithAi({
          provider: settings.provider,
          apiKey,
          model: settings.model,
          outputLanguage: settings.outputLanguage,
          conversationTitle: options.conversationTitle,
          rawTranscript: transcriptForDisplay,
          alignedSegments:
            alignedSegments.length > 0 ? alignedSegments : undefined,
        });
        if (corrected.alignedSegments.length > 0) {
          alignedSegments.splice(
            0,
            alignedSegments.length,
            ...corrected.alignedSegments
          );
          transcriptForDisplay = formatAlignedSegmentsForDisplay(
            corrected.alignedSegments
          );
        } else if (corrected.text.length > 0) {
          transcriptForDisplay = corrected.text;
        }
        await writeFile(
          `${basePath}.transcript.corrected.md`,
          formatTranscriptMarkdown({
            conversationTitle: options.conversationTitle,
            startedAt: options.startedAt,
            endedAt: options.endedAt,
            result,
            activityLog,
            alignedSegments,
          }),
          'utf8'
        );
      } catch (error) {
        log.warn('transcript AI correction failed', error);
      }
    }
  }

  const markdown = formatTranscriptMarkdown({
    conversationTitle: options.conversationTitle,
    startedAt: options.startedAt,
    endedAt: options.endedAt,
    result,
    activityLog,
    alignedSegments,
  });
  await writeFile(transcriptPath, markdown, 'utf8');

  const correctedTranscriptForAi =
    alignedSegments.length > 0
      ? formatAlignedSegmentsForAi(alignedSegments)
      : transcriptForDisplay;

  let summaryPath: string | undefined;
  if (await isAiSummaryEnabled()) {
    const settings = await getAiSettingsPublic();
    const apiKey = await getAiApiKey(settings.provider);
    if (apiKey && correctedTranscriptForAi.length > 0) {
      const summaryText = await generateAiSummaryForProvider({
        provider: settings.provider,
        apiKey,
        model: settings.model,
        outputLanguage: settings.outputLanguage,
        conversationTitle: options.conversationTitle,
        scopeLabel: 'Přepis hovoru',
        transcript: correctedTranscriptForAi,
      });
      summaryPath = `${basePath}.summary.md`;
      await writeFile(summaryPath, summaryText, 'utf8');
    }
  }

  return {
    transcriptPath,
    transcriptText: transcriptForDisplay,
    summaryPath,
  };
}

export function createExtensionProgressSender(
  webContents: WebContents | null | undefined
): ProgressSender {
  return progress => {
    if (!webContents || webContents.isDestroyed()) {
      return;
    }
    webContents.send('uuminutes:call-summary-extension-progress', progress);
  };
}

// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';
import { mkdir, open, stat, writeFile } from 'node:fs/promises';

import { app, desktopCapturer, ipcMain, shell } from 'electron';

import { createLogger } from '../ts/logging/log.std.ts';
import {
  RECORDINGS_DIR_NAME,
  SPEAKER_ACTIVITY_FILE_SUFFIX,
  SUMMARIES_DIR_NAME,
} from '../ts/uuminutes/constants.std.ts';
import { RECORDING_PCM_SIDECAR_SUFFIX } from '../ts/uuminutes/whisperSettings.std.ts';
import type { SpeakerActivityLog } from '../ts/uuminutes/speakerActivity.std.ts';
import {
  getAiSettingsPublic,
  getAiApiKey,
  isAiSummaryEnabled,
  saveAiSettings,
} from '../ts/uuminutes/aiSettings.main.ts';
import type { AiSettingsSaveInput, AiProvider } from '../ts/uuminutes/aiSettings.std.ts';
import {
  addBookmark,
  listBookmarks,
  removeBookmark,
} from '../ts/uuminutes/bookmarks.main.ts';
import type { AddBookmarkInput } from '../ts/uuminutes/bookmarks.std.ts';
import {
  createExtensionProgressSender,
  generateCallRecordingSummary,
  getCallSummaryExtensionPublic,
  installCallSummaryExtension,
  transcribeCallRecording,
} from '../ts/uuminutes/callSummaryExtension.main.ts';
import {
  cancelLocalLlmExtensionDownload,
  createLocalLlmProgressSender,
  getLocalLlmExtensionPublic,
  installLocalLlmExtension,
} from '../ts/uuminutes/localLlmExtension.main.ts';
import { listCallRecordings, loadCallRecordingOutput } from '../ts/uuminutes/recordingsCatalog.main.ts';
import { cancelTranscriptionJob } from '../ts/uuminutes/transcriptionCancel.main.ts';
import {
  testAiConnectionForProvider,
  generateAiSummaryForProvider,
  generateUnreadConversationSummaryForProvider,
} from '../ts/uuminutes/aiSummaryService.main.ts';
import { readUuMinutesReadmeContent } from './uuminutes_readme.main.ts';
import {
  checkForAppUpdate,
  createAppUpdateProgressSender,
  downloadAndInstallAppUpdate,
  downloadAppUpdate,
  getPendingAppUpdate,
  installPendingAppUpdate,
  resolveStartupAppUpdateState,
} from '../ts/uuminutes/appUpdate.main.ts';

const log = createLogger('uuminutes/main');

function sanitizeFilePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

function formatTimestampForFilename(epochMs: number): string {
  return new Date(epochMs).toISOString().replace(/[:.]/g, '-');
}

function getRecordingsDir(): string {
  return join(app.getPath('userData'), RECORDINGS_DIR_NAME);
}

function getSummariesDir(): string {
  return join(app.getPath('userData'), SUMMARIES_DIR_NAME);
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export function initializeUuMinutesChannel(): void {
  ipcMain.handle('uuminutes:get-loopback-audio-source', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 },
    });

    const primary =
      sources.find(source => /screen|display|entire/i.test(source.name)) ??
      sources[0];

    if (!primary) {
      log.warn('no desktop capturer sources for loopback audio');
      return '';
    }

    return primary.id;
  });

  ipcMain.handle(
    'uuminutes:save-recording',
    async (
      _event,
      options: {
        conversationId: string;
        conversationTitle: string;
        callMode?: string;
        eraId?: string;
        startedAt: number;
        endedAt: number;
        data: Uint8Array;
        pcm48?: Float32Array;
        speakerActivityLog?: SpeakerActivityLog | null;
      }
    ) => {
      const recordingsDir = getRecordingsDir();
      await ensureDir(recordingsDir);

      const baseName = [
        formatTimestampForFilename(options.startedAt),
        sanitizeFilePart(options.conversationTitle),
        sanitizeFilePart(options.conversationId.slice(0, 8)),
      ].join('_');

      const filePath = join(recordingsDir, `${baseName}.mp3`);
      await writeFile(filePath, Buffer.from(options.data));

      if (options.pcm48 && options.pcm48.length > 0) {
        const pcmPath = join(recordingsDir, `${baseName}${RECORDING_PCM_SIDECAR_SUFFIX}`);
        await writeFile(
          pcmPath,
          Buffer.from(
            options.pcm48.buffer,
            options.pcm48.byteOffset,
            options.pcm48.byteLength
          )
        );
      }

      const metadataPath = join(recordingsDir, `${baseName}.json`);
      await writeFile(
        metadataPath,
        JSON.stringify(
          {
            conversationId: options.conversationId,
            conversationTitle: options.conversationTitle,
            callMode: options.callMode,
            eraId: options.eraId,
            startedAt: options.startedAt,
            endedAt: options.endedAt,
            durationMs: options.endedAt - options.startedAt,
            audioFile: `${baseName}.mp3`,
            speakerActivityFile:
              options.speakerActivityLog != null
                ? `${baseName}${SPEAKER_ACTIVITY_FILE_SUFFIX}`
                : undefined,
          },
          null,
          2
        ),
        'utf8'
      );

      if (options.speakerActivityLog != null) {
        const speakerActivityPath = join(
          recordingsDir,
          `${baseName}${SPEAKER_ACTIVITY_FILE_SUFFIX}`
        );
        await writeFile(
          speakerActivityPath,
          JSON.stringify(options.speakerActivityLog, null, 2),
          'utf8'
        );
      }

      return filePath;
    }
  );

  ipcMain.handle(
    'uuminutes:save-chat-summary',
    async (
      _event,
      options: {
        conversationId: string;
        conversationTitle: string;
        generatedAt: number;
        messageCount: number;
        scope?: string;
        summaryText: string;
        aiModel?: string;
        aiProvider?: string;
      }
    ) => {
      const summariesDir = getSummariesDir();
      await ensureDir(summariesDir);

      const baseName = [
        formatTimestampForFilename(options.generatedAt),
        sanitizeFilePart(options.conversationTitle),
        'summary',
      ].join('_');

      const filePath = join(summariesDir, `${baseName}.md`);
      await writeFile(filePath, options.summaryText, 'utf8');

      const metadataPath = join(summariesDir, `${baseName}.json`);
      await writeFile(
        metadataPath,
        JSON.stringify(
          {
            conversationId: options.conversationId,
            conversationTitle: options.conversationTitle,
            generatedAt: options.generatedAt,
            messageCount: options.messageCount,
            scope: options.scope,
            summaryFile: `${baseName}.md`,
            aiProvider: options.aiProvider,
            aiModel: options.aiModel,
          },
          null,
          2
        ),
        'utf8'
      );

      return filePath;
    }
  );

  ipcMain.handle('uuminutes:get-readme-content', async () => {
    return readUuMinutesReadmeContent();
  });

  ipcMain.handle('uuminutes:open-recordings-folder', async () => {
    const recordingsDir = getRecordingsDir();
    await ensureDir(recordingsDir);
    await shell.openPath(recordingsDir);
  });

  ipcMain.handle('uuminutes:list-call-recordings', async () => {
    const recordingsDir = getRecordingsDir();
    await ensureDir(recordingsDir);
    return listCallRecordings(recordingsDir);
  });

  ipcMain.handle(
    'uuminutes:load-call-recording-output',
    async (
      _event,
      entry: {
        mp3Path: string;
        conversationId: string;
        conversationTitle: string;
        hasTranscript: boolean;
        hasSummary: boolean;
        transcriptPath?: string;
        summaryPath?: string;
      }
    ) => {
      return loadCallRecordingOutput(entry);
    }
  );

  ipcMain.handle('uuminutes:open-summaries-folder', async () => {
    const summariesDir = getSummariesDir();
    await ensureDir(summariesDir);
    await shell.openPath(summariesDir);
  });

  ipcMain.handle('uuminutes:read-recent-logs', async () => {
    const logPath = join(app.getPath('userData'), 'logs', 'app.log');
    try {
      const fileStat = await stat(logPath);
      const maxBytes = 120_000;
      const readSize = Math.min(fileStat.size, maxBytes);
      const start = Math.max(0, fileStat.size - readSize);
      const handle = await open(logPath, 'r');
      try {
        const buffer = Buffer.alloc(readSize);
        await handle.read(buffer, 0, readSize, start);
        return buffer.toString('utf8');
      } finally {
        await handle.close();
      }
    } catch (error) {
      log.warn(`read-recent-logs failed: ${String(error)}`);
      return '';
    }
  });

  ipcMain.handle('uuminutes:list-bookmarks', async () => {
    return listBookmarks();
  });

  ipcMain.handle(
    'uuminutes:add-bookmark',
    async (_event, input: AddBookmarkInput) => {
      return addBookmark(input);
    }
  );

  ipcMain.handle(
    'uuminutes:remove-bookmark',
    async (_event, bookmarkId: string) => {
      return removeBookmark(bookmarkId);
    }
  );

  ipcMain.handle('uuminutes:get-call-summary-extension', async () => {
    return getCallSummaryExtensionPublic();
  });

  ipcMain.handle(
    'uuminutes:install-call-summary-extension',
    async (
      event,
      options: { modelFileName?: string; forceRedownload?: boolean } = {}
    ) => {
      const sendProgress = createExtensionProgressSender(event.sender);
      return installCallSummaryExtension(sendProgress, options);
    }
  );

  ipcMain.handle('uuminutes:get-local-llm-extension', async () => {
    return getLocalLlmExtensionPublic();
  });

  ipcMain.handle(
    'uuminutes:install-local-llm-extension',
    async (
      event,
      options: { modelFileName?: string; forceRedownload?: boolean } = {}
    ) => {
      const sendProgress = createLocalLlmProgressSender(event.sender);
      return installLocalLlmExtension(sendProgress, options);
    }
  );

  ipcMain.handle('uuminutes:cancel-local-llm-download', async () => {
    cancelLocalLlmExtensionDownload();
  });

  ipcMain.handle(
    'uuminutes:transcribe-call-recording',
    async (
      event,
      options: {
        jobId?: string;
        recordingPath: string;
        conversationId: string;
        conversationTitle: string;
        startedAt: number;
        endedAt: number;
        localSpeakerDisplayName?: string;
        background?: boolean;
      }
    ) => {
      return transcribeCallRecording({
        ...options,
        onProgress: update => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('uuminutes:call-transcription-progress', {
              jobId: options.jobId,
              percent: update.percent,
              phase: update.phase,
              detail: update.detail,
            });
          }
        },
      });
    }
  );

  ipcMain.handle(
    'uuminutes:cancel-transcription-job',
    (_event, options: { jobId: string }) => {
      if (typeof options?.jobId === 'string' && options.jobId.length > 0) {
        cancelTranscriptionJob(options.jobId);
      }
    }
  );

  ipcMain.handle(
    'uuminutes:generate-call-recording-summary',
    async (
      event,
      options: {
        jobId?: string;
        recordingPath: string;
        conversationTitle: string;
        localSpeakerDisplayName?: string;
      }
    ) => {
      return generateCallRecordingSummary({
        ...options,
        onProgress: update => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('uuminutes:call-transcription-progress', {
              jobId: options.jobId,
              percent: update.percent,
              phase: update.phase,
              detail: update.detail,
            });
          }
        },
      });
    }
  );

  ipcMain.handle('uuminutes:get-ai-settings', async () => {
    return getAiSettingsPublic();
  });

  ipcMain.handle(
    'uuminutes:save-ai-settings',
    async (_event, input: AiSettingsSaveInput) => {
      return saveAiSettings(input);
    }
  );

  ipcMain.handle(
    'uuminutes:test-ai-settings',
    async (
      _event,
      options: { apiKey?: string; provider: AiProvider; model: string }
    ): Promise<{ ok: true; message: string }> => {
      const settings = await getAiSettingsPublic();
      const provider = options.provider ?? settings.provider;
      const model = options.model ?? settings.model;
      if (provider === 'local') {
        const message = await testAiConnectionForProvider({
          provider: 'local',
          apiKey: '',
          model,
        });
        return { ok: true, message };
      }
      const apiKey =
        options.apiKey?.trim() || (await getAiApiKey(provider)) || undefined;
      if (!apiKey) {
        throw new Error('API klíč není nastaven');
      }
      const message = await testAiConnectionForProvider({
        provider,
        apiKey,
        model,
      });
      return { ok: true, message };
    }
  );

  ipcMain.handle(
    'uuminutes:generate-ai-summary',
    async (
      _event,
      options: {
        conversationTitle: string;
        scopeLabel: string;
        transcript: string;
      }
    ): Promise<string> => {
      const enabled = await isAiSummaryEnabled();
      if (!enabled) {
        throw new Error(
          'AI sumarizace je vypnutá nebo chybí API klíč / lokální model'
        );
      }

      const settings = await getAiSettingsPublic();
      const apiKey =
        settings.provider === 'local'
          ? ''
          : (await getAiApiKey(settings.provider)) ?? undefined;
      if (settings.provider !== 'local' && !apiKey) {
        throw new Error('API klíč není nastaven');
      }

      return generateAiSummaryForProvider({
        provider: settings.provider,
        apiKey: apiKey ?? '',
        model: settings.model,
        outputLanguage: settings.outputLanguage,
        conversationTitle: options.conversationTitle,
        scopeLabel: options.scopeLabel,
        transcript: options.transcript,
      });
    }
  );

  ipcMain.handle(
    'uuminutes:generate-unread-conversation-summary',
    async (
      _event,
      options: {
        conversationTitle: string;
        unreadCount: number;
        transcript: string;
      }
    ): Promise<string> => {
      const enabled = await isAiSummaryEnabled();
      if (!enabled) {
        throw new Error(
          'AI sumarizace je vypnutá nebo chybí API klíč / lokální model'
        );
      }

      const settings = await getAiSettingsPublic();
      const apiKey =
        settings.provider === 'local'
          ? ''
          : (await getAiApiKey(settings.provider)) ?? undefined;
      if (settings.provider !== 'local' && !apiKey) {
        throw new Error('API klíč není nastaven');
      }

      return generateUnreadConversationSummaryForProvider({
        provider: settings.provider,
        apiKey: apiKey ?? '',
        model: settings.model,
        outputLanguage: settings.outputLanguage,
        conversationTitle: options.conversationTitle,
        unreadCount: options.unreadCount,
        transcript: options.transcript,
      });
    }
  );

  ipcMain.handle('uuminutes:check-for-app-update', async () => {
    return checkForAppUpdate();
  });

  ipcMain.handle('uuminutes:get-startup-app-update-state', async () => {
    return resolveStartupAppUpdateState();
  });

  ipcMain.handle('uuminutes:get-pending-app-update', async () => {
    return getPendingAppUpdate();
  });

  ipcMain.handle(
    'uuminutes:download-app-update',
    async (
      event,
      options: {
        downloadUrl: string;
        latestVersion: string;
        releaseUrl: string;
      }
    ) => {
      const sendProgress = createAppUpdateProgressSender(event.sender);
      return downloadAppUpdate({
        ...options,
        sendProgress,
      });
    }
  );

  ipcMain.handle(
    'uuminutes:install-pending-app-update',
    async (event, options: { version?: string } = {}) => {
      const sendProgress = createAppUpdateProgressSender(event.sender);
      return installPendingAppUpdate({
        ...options,
        sendProgress,
      });
    }
  );

  ipcMain.handle(
    'uuminutes:download-and-install-app-update',
    async (
      event,
      options: {
        downloadUrl: string;
        latestVersion: string;
        releaseUrl: string;
      }
    ) => {
      const sendProgress = createAppUpdateProgressSender(event.sender);
      return downloadAndInstallAppUpdate({
        ...options,
        sendProgress,
      });
    }
  );

  log.info('uuMinutes IPC channel initialized');
}

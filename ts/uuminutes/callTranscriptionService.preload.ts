// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import { mp3ToWhisperPcm } from './audioPcm.dom.ts';
import { preparePcmForWhisper } from './whisperAudioPrep.std.ts';
import type { CallRecordingMetadata } from './types.std.ts';
import { summaryUi } from './summaryUiEvents.std.ts';
import { isCallSummaryExtensionActive } from './callSummaryExtensionService.preload.ts';

const log = createLogger('uuminutes/callTranscription');

type TranscribeCallRecordingResult = Readonly<{
  transcriptPath?: string;
  transcriptText?: string;
  summaryPath?: string;
}>;

export async function transcribeSavedRecording(
  metadata: CallRecordingMetadata,
  mp3Data: Uint8Array,
  pcm48?: Float32Array
): Promise<void> {
  if (!isCallSummaryExtensionActive()) {
    return;
  }

  summaryUi.showWorking('Přepisuji nahrávku hovoru (lokální Whisper)…');

  try {
    const pcmf32 =
      pcm48 && pcm48.length > 0
        ? preparePcmForWhisper(pcm48, 48_000)
        : await mp3ToWhisperPcm(mp3Data);
    if (pcmf32.length === 0) {
      throw new Error('Nahrávka neobsahuje zvuk k přepisu.');
    }

    const result = (await ipcRenderer.invoke(
      'uuminutes:transcribe-call-recording',
      {
        pcmf32,
        conversationId: metadata.conversationId,
        conversationTitle: metadata.conversationTitle,
        startedAt: metadata.startedAt,
        endedAt: metadata.endedAt,
        recordingPath: metadata.filePath,
      }
    )) as TranscribeCallRecordingResult;

    const transcriptPath =
      typeof result?.transcriptPath === 'string' ? result.transcriptPath : null;
    const transcriptText =
      typeof result?.transcriptText === 'string' ? result.transcriptText.trim() : '';

    if (!transcriptPath) {
      throw new Error('Přepis se nepodařilo uložit.');
    }

    summaryUi.showSaved({
      conversationId: metadata.conversationId,
      conversationTitle: metadata.conversationTitle,
      messageCount: 0,
      generatedAt: Date.now(),
      summaryText: transcriptText,
      transcriptText,
      filePath: transcriptPath,
      scope: { kind: 'recent', limit: 0 },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Přepis hovoru selhal.';
    log.error('transcribeSavedRecording failed', error);
    summaryUi.showError(message);
  }
}

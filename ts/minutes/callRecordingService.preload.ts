// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ToastType } from '../types/Toast.dom.tsx';
import { createLogger } from '../logging/log.std.ts';
import type { SpeakerActivityLog } from './speakerActivity.std.ts';
import { clampSpeakerActivityLogToPcmDuration } from './speakerActivity.std.ts';
import { isRecordableCallMode } from './types.std.ts';
import { CallRecorder } from './callRecorder.dom.ts';
import {
  RECORDING_STATE_CHANGED,
  recordingStateEvents,
} from './recordingStateEvents.std.ts';
import { enqueueRecordingTranscription } from './callTranscriptionService.preload.ts';
import { speakerActivityLogger } from './speakerActivityLogger.preload.ts';
import { minutesCaptureCoordinator } from './captureCoordinator.std.ts';
import {
  CallRecordingServiceCore,
  type CallRecordingServiceDependencies,
} from './callRecordingServiceCore.std.ts';
import { RingRtcAudioTrack } from './ringRtcAudioTrack.preload.ts';
import { callRecordingFileService } from './callRecordingFileService.preload.ts';

const log = createLogger('minutes/callRecording');

const dependencies: CallRecordingServiceDependencies = {
  coordinator: minutesCaptureCoordinator,
  isRecordableCallMode,
  warmup: () => CallRecorder.warmup(),
  recorder: new CallRecorder(),
  getConversationTitle: conversationId => {
    const conversation =
      window.ConversationController.get(conversationId) ?? undefined;
    return conversation?.getTitle() ?? conversationId;
  },
  createAudioTrack: onFatalError => RingRtcAudioTrack.create({ onFatalError }),
  speakerActivity: speakerActivityLogger,
  writer: {
    create: options => callRecordingFileService.create(options),
    appendMp3: (sessionId, data) =>
      callRecordingFileService.appendMp3(sessionId, data),
    appendPcm: (sessionId, samples) =>
      callRecordingFileService.appendPcm(sessionId, samples),
    finalize: input => callRecordingFileService.finalize(input),
    abort: sessionId => callRecordingFileService.abort(sessionId),
  },
  showError: () => {
    window.reduxActions.toast.showToast({ toastType: ToastType.Error });
  },
  showFileSaved: filePath => {
    window.reduxActions.toast.showToast({
      toastType: ToastType.FileSaved,
      parameters: { fullPath: filePath },
    });
  },
  enqueueRecordingTranscription,
  emitState: state => recordingStateEvents.emitState(state),
  normalizeSpeakerActivityLog: (activityLog, recordedDurationMs) => {
    if (activityLog != null && recordedDurationMs > 0) {
      return clampSpeakerActivityLogToPcmDuration(
        activityLog as SpeakerActivityLog,
        recordedDurationMs
      );
    }
    return null;
  },
  now: () => Date.now(),
  log: {
    info: message => log.info(message),
    warn: message => log.warn(message),
    error: (message, error) => log.error(message, error),
  },
};

export const callRecordingService = new CallRecordingServiceCore(dependencies);
export { RECORDING_STATE_CHANGED };

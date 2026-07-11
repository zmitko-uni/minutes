// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { CallMode } from '../types/CallDisposition.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import { createLogger } from '../logging/log.std.ts';
import type { CallRecordingMetadata, MinutesRecordingState } from './types.std.ts';
import { isRecordableCallMode } from './types.std.ts';
import {
  CallRecorder,
  getLoopbackAudioStream,
  getMicrophoneStream,
} from './callRecorder.dom.ts';
import {
  getMacLoopbackAudioStream,
  stopMacLoopbackAudio,
} from './macLoopbackAudio.preload.ts';
import {
  RECORDING_STATE_CHANGED,
  recordingStateEvents,
} from './recordingStateEvents.std.ts';
import { enqueueRecordingTranscription } from './callTranscriptionService.preload.ts';
import { speakerActivityLogger } from './speakerActivityLogger.preload.ts';
import { clampSpeakerActivityLogToPcmDuration } from './speakerActivity.std.ts';

const log = createLogger('minutes/callRecording');

class CallRecordingService {
  #recorder = new CallRecorder();
  #state: MinutesRecordingState = { status: 'idle' };
  #finalizing = false;

  getState(): MinutesRecordingState {
    return this.#state;
  }

  #setState(state: MinutesRecordingState): void {
    this.#state = state;
    recordingStateEvents.emitState(state);
  }

  async prepare(): Promise<void> {
    await CallRecorder.warmup();
  }

  async startRecording(options: {
    conversationId: string;
    callMode: CallMode;
    eraId?: string;
  }): Promise<boolean> {
    if (!isRecordableCallMode(options.callMode)) {
      return false;
    }

    if (this.#finalizing) {
      log.warn('startRecording: previous recording is still being saved');
      return false;
    }

    if (this.#state.status !== 'idle') {
      log.warn('startRecording: already active');
      return false;
    }

    if (this.#recorder.isActive()) {
      log.warn('startRecording: recovering stale recorder');
      await this.#recorder.stop().catch(() => undefined);
      speakerActivityLogger.stop();
    }

    const conversation =
      window.ConversationController.get(options.conversationId) ?? undefined;
    const conversationTitle =
      conversation?.getTitle() ?? options.conversationId;

    try {
    const streams = new Array<MediaStream>();
    const loopback =
      window.platform === 'darwin'
        ? await getMacLoopbackAudioStream()
        : await getLoopbackAudioStream();
    if (loopback) {
      streams.push(loopback);
    }
    const microphone = await getMicrophoneStream();
    if (microphone) {
      streams.push(microphone);
    }

    if (streams.length === 0) {
      window.reduxActions.toast.showToast({ toastType: ToastType.Error });
      return false;
    }

    const started = await this.#recorder.start(streams, {
      onPcm: sampleCount => {
        speakerActivityLogger.onRecordingPcm(sampleCount);
      },
    });
    if (!started) {
      streams.forEach(stream =>
        stream.getTracks().forEach(track => track.stop())
      );
      stopMacLoopbackAudio();
      window.reduxActions.toast.showToast({ toastType: ToastType.Error });
      return false;
    }

    const recordingStartedAt = Date.now();

    this.#setState({
      status: 'recording',
      conversationId: options.conversationId,
      conversationTitle,
      callMode: options.callMode as CallMode.Direct | CallMode.Group,
      eraId: options.eraId,
      startedAt: recordingStartedAt,
    });

    speakerActivityLogger.start({
      conversationId: options.conversationId,
      callMode: options.callMode,
      remoteDisplayName: conversationTitle,
      recordingStartedAt,
    });

    log.info(`recording started: ${conversationTitle}`);
    return true;
  } catch (error) {
    log.error('startRecording failed', error);
    if (this.#recorder.isActive()) {
      await this.#recorder.stop().catch(() => undefined);
    }
    stopMacLoopbackAudio();
    speakerActivityLogger.stop();
    this.#setState({ status: 'idle' });
    window.reduxActions.toast.showToast({ toastType: ToastType.Error });
    return false;
    }
  }

  pauseRecording(): boolean {
    if (this.#state.status !== 'recording') {
      return false;
    }
    if (!this.#recorder.pause()) {
      return false;
    }
    speakerActivityLogger.pause();
    this.#setState({
      ...this.#state,
      status: 'paused',
      pausedAt: Date.now(),
    });
    return true;
  }

  resumeRecording(): boolean {
    if (this.#state.status !== 'paused') {
      return false;
    }
    if (!this.#recorder.resume()) {
      return false;
    }
    speakerActivityLogger.resume();
    const { pausedAt: _pausedAt, ...rest } = this.#state;
    this.#setState({
      ...rest,
      status: 'recording',
    });
    return true;
  }

  async stopRecording(): Promise<CallRecordingMetadata | null> {
    if (
      this.#state.status !== 'recording' &&
      this.#state.status !== 'paused'
    ) {
      return null;
    }
    if (this.#finalizing) {
      return null;
    }
    return this.#finalizeRecording(this.#state);
  }

  async onCallEnded(options: {
    conversationId: string;
    callMode: CallMode;
  }): Promise<CallRecordingMetadata | null> {
    if (
      this.#state.status === 'idle' ||
      this.#state.conversationId !== options.conversationId ||
      !isRecordableCallMode(options.callMode)
    ) {
      return null;
    }
    return this.stopRecording();
  }

  /** @deprecated Use onCallEnded */
  async onGroupCallEnded(options: {
    conversationId: string;
    callMode: CallMode;
  }): Promise<CallRecordingMetadata | null> {
    return this.onCallEnded(options);
  }

  async #finalizeRecording(
    active: Exclude<MinutesRecordingState, { status: 'idle' }>
  ): Promise<CallRecordingMetadata | null> {
    if (this.#finalizing) {
      return null;
    }

    this.#finalizing = true;

    try {
      const { conversationId, conversationTitle, callMode, eraId, startedAt } =
        active;
      const endedAt = Date.now();

      const recording = await this.#recorder.stop();
      stopMacLoopbackAudio();
      let speakerActivityLog = speakerActivityLogger.stop();

      if (!recording || recording.mp3.byteLength === 0) {
        log.warn('finalizeRecording: empty recording');
        return null;
      }

      const { mp3: mp3Data, pcm48 } = recording;

      if (speakerActivityLog != null && pcm48 != null && pcm48.length > 0) {
        const pcmDurationMs = (pcm48.length / 48_000) * 1000;
        speakerActivityLog = clampSpeakerActivityLogToPcmDuration(
          speakerActivityLog,
          pcmDurationMs
        );
      }

      const filePath = await ipcRenderer.invoke('minutes:save-recording', {
        conversationId,
        conversationTitle,
        callMode,
        eraId,
        startedAt,
        endedAt,
        data: mp3Data,
        pcm48,
        speakerActivityLog,
      });

      if (typeof filePath !== 'string') {
        return null;
      }

      const metadata: CallRecordingMetadata = {
        conversationId,
        conversationTitle,
        eraId,
        startedAt,
        endedAt,
        filePath,
        durationMs: endedAt - startedAt,
      };

      window.reduxActions.toast.showToast({
        toastType: ToastType.FileSaved,
        parameters: { fullPath: filePath },
      });

      enqueueRecordingTranscription(metadata);

      return metadata;
    } finally {
      this.#finalizing = false;
      this.#setState({ status: 'idle' });
    }
  }
}

export const callRecordingService = new CallRecordingService();
export { RECORDING_STATE_CHANGED };

// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { CallMode } from '../types/CallDisposition.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import { createLogger } from '../logging/log.std.ts';
import type { CallRecordingMetadata, UuMinutesRecordingState } from './types.std.ts';
import { isRecordableCallMode } from './types.std.ts';
import {
  CallRecorder,
  getLoopbackAudioStream,
  getMicrophoneStream,
} from './callRecorder.dom.ts';
import {
  RECORDING_STATE_CHANGED,
  recordingStateEvents,
} from './recordingStateEvents.std.ts';
import { drop } from '../util/drop.std.ts';
import { transcribeSavedRecording } from './callTranscriptionService.preload.ts';
import { speakerActivityLogger } from './speakerActivityLogger.preload.ts';

const log = createLogger('uuminutes/callRecording');

class CallRecordingService {
  #recorder = new CallRecorder();
  #state: UuMinutesRecordingState = { status: 'idle' };

  getState(): UuMinutesRecordingState {
    return this.#state;
  }

  #setState(state: UuMinutesRecordingState): void {
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

    if (this.#recorder.isActive()) {
      if (this.#state.status === 'idle') {
        log.warn('startRecording: recovering stale recorder');
        await this.#recorder.stop().catch(() => undefined);
        speakerActivityLogger.stop();
      } else {
        log.warn('startRecording: already active');
        return false;
      }
    }

    const conversation =
      window.ConversationController.get(options.conversationId) ?? undefined;
    const conversationTitle =
      conversation?.getTitle() ?? options.conversationId;

    try {
    const streams = new Array<MediaStream>();
    const loopback = await getLoopbackAudioStream();
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

    const started = await this.#recorder.start(streams);
    if (!started) {
      streams.forEach(stream =>
        stream.getTracks().forEach(track => track.stop())
      );
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
    active: Exclude<UuMinutesRecordingState, { status: 'idle' }>
  ): Promise<CallRecordingMetadata | null> {
    const { conversationId, conversationTitle, callMode, eraId, startedAt } =
      active;
    const endedAt = Date.now();

    const speakerActivityLog = speakerActivityLogger.stop();
    const recording = await this.#recorder.stop();
    this.#setState({ status: 'idle' });

    if (!recording || recording.mp3.byteLength === 0) {
      log.warn('finalizeRecording: empty recording');
      return null;
    }

    const { mp3: mp3Data, pcm48 } = recording;

    const filePath = await ipcRenderer.invoke('uuminutes:save-recording', {
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

    drop(transcribeSavedRecording(metadata, mp3Data, pcm48));

    return metadata;
  }
}

export const callRecordingService = new CallRecordingService();
export { RECORDING_STATE_CHANGED };

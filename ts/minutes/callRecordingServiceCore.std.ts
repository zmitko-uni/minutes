// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallMode } from '../types/CallDisposition.std.ts';
import type {
  CallRecordingMetadata,
  MinutesRecordingState,
} from './types.std.ts';
import type {
  MinutesCaptureCoordinator,
  MinutesCaptureLease,
} from './captureCoordinator.std.ts';
import type { CallRecordingStopResult } from './callRecorder.dom.ts';
import type { FinalizedCallRecordingFile } from './callRecordingFile.std.ts';
import type { SpeakerActivityLog } from './speakerActivity.std.ts';

export type { CallRecordingStopResult };

export type CallRecordingRecorder = Readonly<{
  isActive(): boolean;
  getSessionId(): string | undefined;
  start(
    streams: ReadonlyArray<MediaStream>,
    options: Readonly<{
      sessionId: string;
      sink: Readonly<{
        appendMp3(data: Uint8Array<ArrayBuffer>): Promise<void>;
        appendPcm(samples: Float32Array<ArrayBuffer>): Promise<void>;
      }>;
      onPcm: (sampleCount: number) => void;
      onFatalError?: (error: Error) => void;
    }>
  ): Promise<boolean>;
  pause(): boolean;
  resume(): boolean;
  stop(): Promise<CallRecordingStopResult | undefined>;
}>;

export type CallRecordingAudioTrack = Readonly<{
  stream: MediaStream;
  pause(): void;
  resume(): void;
  stop(): Promise<void>;
}>;

export type CallRecordingWriter = Readonly<{
  create(options: Readonly<{
    conversationId: string;
    conversationTitle: string;
    callMode: string;
    eraId?: string;
    startedAt: number;
  }>): Promise<{ sessionId: string; partialPath: string }>;
  appendMp3(
    sessionId: string,
    data: Uint8Array<ArrayBuffer>
  ): Promise<void>;
  appendPcm(
    sessionId: string,
    samples: Float32Array<ArrayBuffer>
  ): Promise<void>;
  finalize(input: Readonly<{
    sessionId: string;
    endedAt: number;
    recordedDurationMs: number;
    lametagFrame: Uint8Array<ArrayBuffer>;
    finalFrame: Uint8Array<ArrayBuffer>;
    speakerActivityLog: SpeakerActivityLog | null;
  }>): Promise<FinalizedCallRecordingFile>;
  abort(sessionId: string): Promise<unknown>;
}>;

type SpeakerActivity = Readonly<{
  onRecordingPcm(sampleCount: number): void;
  start(options: {
    conversationId: string;
    callMode: CallMode;
    remoteDisplayName: string;
    recordingStartedAt: number;
  }): void;
  pause(): void;
  resume(): void;
  stop(): unknown;
}>;

type ServiceLog = Readonly<{
  info(message: string): void;
  warn(message: string): void;
  error(message: string, error: unknown): void;
}>;

export type CallRecordingServiceDependencies = Readonly<{
  coordinator: MinutesCaptureCoordinator;
  isRecordableCallMode(callMode: CallMode): boolean;
  warmup(): Promise<void>;
  recorder: CallRecordingRecorder;
  getConversationTitle(conversationId: string): string;
  createAudioTrack(
    onFatalError: (error: Error) => void
  ): Promise<CallRecordingAudioTrack>;
  speakerActivity: SpeakerActivity;
  writer: CallRecordingWriter;
  showError(): void;
  showFileSaved(filePath: string): void;
  enqueueRecordingTranscription(metadata: CallRecordingMetadata): void;
  emitState(state: MinutesRecordingState): void;
  normalizeSpeakerActivityLog(
    activityLog: unknown,
    recordedDurationMs: number
  ): SpeakerActivityLog | null;
  now(): number;
  log: ServiceLog;
}>;

export class CallRecordingServiceCore {
  readonly #dependencies: CallRecordingServiceDependencies;
  #state: MinutesRecordingState = { status: 'idle' };
  #captureLease: MinutesCaptureLease | undefined;
  #audioTrack: CallRecordingAudioTrack | undefined;
  #finalizationPromise: Promise<CallRecordingMetadata | null> | undefined;
  #pendingAudioError: Error | undefined;
  #writerSessionId: string | undefined;

  constructor(dependencies: CallRecordingServiceDependencies) {
    this.#dependencies = dependencies;
  }

  getState(): MinutesRecordingState {
    return this.#state;
  }

  async prepare(): Promise<void> {
    await this.#dependencies.warmup();
  }

  async startRecording(options: {
    conversationId: string;
    callMode: CallMode;
    eraId?: string;
  }): Promise<boolean> {
    const { coordinator, log, recorder } = this.#dependencies;

    if (!this.#dependencies.isRecordableCallMode(options.callMode)) {
      return false;
    }
    if (this.#state.status !== 'idle') {
      log.warn('startRecording: already active');
      return false;
    }

    let captureLease: MinutesCaptureLease;
    try {
      captureLease = coordinator.acquire('audio', async () => {
        await this.#finalizeFromCoordinator();
      });
    } catch (error) {
      log.warn(`startRecording: capture unavailable (${String(error)})`);
      return false;
    }

    this.#captureLease = captureLease;
    this.#finalizationPromise = undefined;
    this.#pendingAudioError = undefined;
    let startupSucceeded = false;

    try {
      if (recorder.isActive()) {
        log.warn('startRecording: recovering stale recorder');
        try {
          await recorder.stop();
        } catch {
          // Best-effort cleanup matches the previous recorder recovery path.
        }
        await this.#stopAudioTrack();
        this.#dependencies.speakerActivity.stop();
      }

      const conversationTitle = this.#dependencies.getConversationTitle(
        options.conversationId
      );
      const audioTrack = await this.#dependencies.createAudioTrack(error => {
        this.#handleAudioError(error);
      });
      this.#audioTrack = audioTrack;
      if (this.#pendingAudioError) {
        throw new Error('RingRTC audio tap failed during startup', {
          cause: this.#pendingAudioError,
        });
      }

      const recordingStartedAt = this.#dependencies.now();
      const writerSession = await this.#dependencies.writer.create({
        conversationId: options.conversationId,
        conversationTitle,
        callMode: options.callMode,
        eraId: options.eraId,
        startedAt: recordingStartedAt,
      });
      this.#writerSessionId = writerSession.sessionId;

      const started = await recorder.start([audioTrack.stream], {
        sessionId: writerSession.sessionId,
        sink: {
          appendMp3: data =>
            this.#dependencies.writer.appendMp3(writerSession.sessionId, data),
          appendPcm: samples =>
            this.#dependencies.writer.appendPcm(writerSession.sessionId, samples),
        },
        onPcm: sampleCount => {
          this.#dependencies.speakerActivity.onRecordingPcm(sampleCount);
        },
        onFatalError: error => {
          this.#handleAudioError(error);
        },
      });
      if (!started) {
        await this.#dependencies.writer.abort(writerSession.sessionId);
        this.#writerSessionId = undefined;
        await this.#stopAudioTrack();
        this.#dependencies.showError();
        return false;
      }
      if (this.#pendingAudioError) {
        throw new Error('RingRTC audio tap failed during startup', {
          cause: this.#pendingAudioError,
        });
      }

      this.#setState({
        status: 'recording',
        conversationId: options.conversationId,
        conversationTitle,
        callMode: options.callMode as CallMode.Direct | CallMode.Group,
        eraId: options.eraId,
        startedAt: recordingStartedAt,
      });
      this.#dependencies.speakerActivity.start({
        conversationId: options.conversationId,
        callMode: options.callMode,
        remoteDisplayName: conversationTitle,
        recordingStartedAt,
      });

      startupSucceeded = true;
      log.info(`recording started: ${conversationTitle}`);
      return true;
    } catch (error) {
      log.error('startRecording failed', error);
      if (recorder.isActive()) {
        try {
          await recorder.stop();
        } catch {
          // Cleanup remains best effort after a failed start.
        }
      }
      await this.#stopAudioTrack();
      this.#dependencies.speakerActivity.stop();
      if (this.#writerSessionId) {
        await this.#dependencies.writer.abort(this.#writerSessionId);
        this.#writerSessionId = undefined;
      }
      this.#setState({ status: 'idle' });
      this.#dependencies.showError();
      return false;
    } finally {
      if (!startupSucceeded) {
        captureLease.release();
        if (this.#captureLease === captureLease) {
          this.#captureLease = undefined;
        }
      }
    }
  }

  pauseRecording(): boolean {
    if (this.#state.status !== 'recording') {
      return false;
    }

    const captureLease = this.#captureLease;
    if (!captureLease?.pause()) {
      return false;
    }
    if (!this.#dependencies.recorder.pause()) {
      captureLease.resume();
      return false;
    }

    this.#audioTrack?.pause();
    this.#dependencies.speakerActivity.pause();
    this.#setState({
      ...this.#state,
      status: 'paused',
      pausedAt: this.#dependencies.now(),
    });
    return true;
  }

  resumeRecording(): boolean {
    if (this.#state.status !== 'paused') {
      return false;
    }

    const captureLease = this.#captureLease;
    if (!captureLease?.resume()) {
      return false;
    }
    this.#audioTrack?.resume();
    if (!this.#dependencies.recorder.resume()) {
      this.#audioTrack?.pause();
      captureLease.pause();
      return false;
    }

    this.#dependencies.speakerActivity.resume();
    this.#setState({
      status: 'recording',
      conversationId: this.#state.conversationId,
      conversationTitle: this.#state.conversationTitle,
      callMode: this.#state.callMode,
      eraId: this.#state.eraId,
      startedAt: this.#state.startedAt,
    });
    return true;
  }

  async stopRecording(): Promise<CallRecordingMetadata | null> {
    if (this.#state.status !== 'recording' && this.#state.status !== 'paused') {
      return null;
    }
    if (this.#finalizationPromise) {
      return this.#finalizationPromise;
    }

    const captureLease = this.#captureLease;
    if (!captureLease) {
      return null;
    }

    const coordinatorFinalization = captureLease.finalize();
    const resultPromise = this.#getCurrentFinalization();
    await coordinatorFinalization;
    return resultPromise ?? null;
  }

  async onCallEnded(options: {
    conversationId: string;
    callMode: CallMode;
  }): Promise<CallRecordingMetadata | null> {
    if (
      this.#state.status === 'idle' ||
      this.#state.conversationId !== options.conversationId ||
      !this.#dependencies.isRecordableCallMode(options.callMode)
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

  async #finalizeFromCoordinator(): Promise<void> {
    const finalizationPromise = this.#getOrStartFinalization();
    if (!finalizationPromise) {
      return;
    }

    try {
      await finalizationPromise;
    } finally {
      this.#captureLease = undefined;
    }
  }

  #getOrStartFinalization(): Promise<CallRecordingMetadata | null> | undefined {
    if (this.#finalizationPromise) {
      return this.#finalizationPromise;
    }
    if (this.#state.status !== 'recording' && this.#state.status !== 'paused') {
      return undefined;
    }

    this.#finalizationPromise = this.#finalizeRecording(this.#state);
    return this.#finalizationPromise;
  }

  #getCurrentFinalization(): Promise<CallRecordingMetadata | null> | undefined {
    return this.#finalizationPromise;
  }

  async #finalizeRecording(
    active: Exclude<MinutesRecordingState, { status: 'idle' }>
  ): Promise<CallRecordingMetadata | null> {
    try {
      const { conversationId, conversationTitle, callMode, eraId, startedAt } =
        active;
      const endedAt = this.#dependencies.now();
      let recording: CallRecordingStopResult | undefined;
      try {
        recording = await this.#dependencies.recorder.stop();
      } finally {
        await this.#stopAudioTrack();
      }
      const rawSpeakerActivityLog = this.#dependencies.speakerActivity.stop();

      const sessionId = this.#writerSessionId;
      this.#writerSessionId = undefined;

      if (!recording) {
        this.#dependencies.log.warn('finalizeRecording: empty recording');
        if (sessionId) {
          await this.#dependencies.writer.abort(sessionId);
        }
        return null;
      }
      if (!sessionId) {
        this.#dependencies.log.warn('finalizeRecording: missing writer session');
        return null;
      }

      if (recording.recordedDurationMs <= 0) {
        this.#dependencies.log.warn('finalizeRecording: empty recording');
        await this.#dependencies.writer.abort(sessionId);
        return null;
      }

      const speakerActivityLog = this.#dependencies.normalizeSpeakerActivityLog(
        rawSpeakerActivityLog,
        recording.recordedDurationMs
      );

      let finalized: FinalizedCallRecordingFile;
      try {
        finalized = await this.#dependencies.writer.finalize({
          sessionId,
          endedAt,
          recordedDurationMs: recording.recordedDurationMs,
          lametagFrame: recording.lametagFrame,
          finalFrame: recording.finalFrame,
          speakerActivityLog,
        });
      } catch (error) {
        this.#dependencies.log.error('finalizeRecording failed', error);
        await this.#dependencies.writer.abort(sessionId);
        return null;
      }

      const metadata: CallRecordingMetadata = {
        conversationId,
        conversationTitle,
        eraId,
        startedAt,
        endedAt,
        filePath: finalized.filePath,
        durationMs: recording.recordedDurationMs,
      };
      this.#dependencies.showFileSaved(finalized.filePath);
      this.#dependencies.enqueueRecordingTranscription(metadata);
      return metadata;
    } finally {
      this.#setState({ status: 'idle' });
    }
  }

  #setState(state: MinutesRecordingState): void {
    this.#state = state;
    this.#dependencies.emitState(state);
  }

  async #stopAudioTrack(): Promise<void> {
    const audioTrack = this.#audioTrack;
    this.#audioTrack = undefined;
    if (audioTrack) {
      await audioTrack.stop();
    }
  }

  #handleAudioError(error: Error): void {
    if (this.#state.status !== 'recording' && this.#state.status !== 'paused') {
      this.#pendingAudioError = error;
      return;
    }
    this.#dependencies.log.error('RingRTC audio tap failed', error);
    this.#dependencies.showError();
    void this.stopRecording();
  }
}

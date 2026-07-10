// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { CallMode } from '../types/CallDisposition.std.ts';
import { createLogger } from '../logging/log.std.ts';
import {
  getActiveCallState,
  getCallSelector,
} from '../state/selectors/calling.std.ts';
import { isGroupOrAdhocCallState } from '../util/isGroupOrAdhocCall.std.ts';
import {
  LOCAL_SPEAKER_ID,
  REMOTE_SPEAKER_ID,
  RECORDING_PCM_SAMPLE_RATE,
  SPEAKER_ACTIVITY_LOG_VERSION,
  SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS,
  type SpeakerActivityLevel,
  type SpeakerActivityLog,
  type SpeakerActivitySample,
  type SpeakerParticipantInfo,
} from './speakerActivity.std.ts';
import { getLocalSpeakerDisplayName } from './localSpeakerName.preload.ts';

const log = createLogger('minutes/speakerActivity');

const PCM_SAMPLES_PER_ACTIVITY_SAMPLE = Math.round(
  (RECORDING_PCM_SAMPLE_RATE * SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS) / 1000
);

/** Matches Signal CallingAudioIndicator (GroupCallRemoteParticipant.dom.tsx). */
function isSignalSpeaking(level: number): boolean {
  return level > 0;
}

class SpeakerActivityLogger {
  #conversationId: string | null = null;
  #callMode: CallMode.Direct | CallMode.Group | null = null;
  #recordingStartedAt = 0;
  #isPaused = false;
  #recordedPcmSamples = 0;
  #nextSampleAtPcmSample = 0;
  #participants: Record<string, SpeakerParticipantInfo> = {};
  #samples: Array<SpeakerActivitySample> = [];

  start(options: {
    conversationId: string;
    callMode: CallMode;
    remoteDisplayName: string;
    recordingStartedAt: number;
  }): void {
    this.stop();

    if (
      options.callMode !== CallMode.Direct &&
      options.callMode !== CallMode.Group
    ) {
      return;
    }

    this.#conversationId = options.conversationId;
    this.#callMode = options.callMode;
    this.#recordingStartedAt = options.recordingStartedAt;
    this.#isPaused = false;
    this.#recordedPcmSamples = 0;
    this.#nextSampleAtPcmSample = 0;
    this.#participants = {};
    this.#samples = [];

    this.#registerParticipant(LOCAL_SPEAKER_ID, {
      displayName: getLocalSpeakerDisplayName(),
      isLocal: true,
    });

    if (options.callMode === CallMode.Direct) {
      this.#registerParticipant(REMOTE_SPEAKER_ID, {
        displayName: options.remoteDisplayName,
        isLocal: false,
      });
    }

    log.info(
      `speaker activity logging started (${options.callMode}, ${options.conversationId})`
    );
  }

  /**
   * Called from CallRecorder on each PCM chunk from the audio worklet.
   * Keeps speaker timeline aligned with recorded audio (immune to setInterval throttling).
   */
  onRecordingPcm(sampleCount: number): void {
    if (
      this.#conversationId == null ||
      this.#isPaused ||
      sampleCount <= 0
    ) {
      return;
    }

    this.#recordedPcmSamples += sampleCount;

    while (
      this.#recordedPcmSamples >=
      this.#nextSampleAtPcmSample + PCM_SAMPLES_PER_ACTIVITY_SAMPLE
    ) {
      this.#nextSampleAtPcmSample += PCM_SAMPLES_PER_ACTIVITY_SAMPLE;
      this.#appendSample(
        (this.#nextSampleAtPcmSample / RECORDING_PCM_SAMPLE_RATE) * 1000
      );
    }
  }

  pause(): void {
    if (this.#conversationId == null || this.#isPaused) {
      return;
    }
    this.#isPaused = true;
    log.info('speaker activity logging paused');
  }

  resume(): void {
    if (this.#conversationId == null || !this.#isPaused) {
      return;
    }
    this.#isPaused = false;
    log.info('speaker activity logging resumed');
  }

  stop(): SpeakerActivityLog | null {
    if (this.#conversationId == null || this.#callMode == null) {
      return null;
    }

    const recordingDurationMs = this.#getRecordingDurationMs();
    const lastSampleMs = this.#samples.at(-1)?.tMs ?? -1;
    if (
      recordingDurationMs > 0 &&
      recordingDurationMs - lastSampleMs >=
        SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS / 2
    ) {
      this.#appendSample(recordingDurationMs);
    }

    const activityLog: SpeakerActivityLog = {
      version: SPEAKER_ACTIVITY_LOG_VERSION,
      conversationId: this.#conversationId,
      callMode: this.#callMode,
      recordingStartedAt: this.#recordingStartedAt,
      recordingDurationMs,
      sampleIntervalMs: SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS,
      participants: { ...this.#participants },
      samples: [...this.#samples],
    };

    log.info(
      `speaker activity logging stopped (${activityLog.samples.length} samples, ${Math.round(recordingDurationMs / 1000)}s)`
    );

    this.#conversationId = null;
    this.#callMode = null;
    this.#recordingStartedAt = 0;
    this.#isPaused = false;
    this.#recordedPcmSamples = 0;
    this.#nextSampleAtPcmSample = 0;
    this.#participants = {};
    this.#samples = [];

    return activityLog;
  }

  isActive(): boolean {
    return this.#conversationId != null;
  }

  #getRecordingDurationMs(): number {
    return (this.#recordedPcmSamples / RECORDING_PCM_SAMPLE_RATE) * 1000;
  }

  #registerParticipant(id: string, info: SpeakerParticipantInfo): void {
    if (!this.#participants[id]) {
      this.#participants[id] = info;
    }
  }

  #appendSample(tMs: number): void {
    this.#samples.push({
      tMs,
      levels: this.#captureLevels(),
    });
  }

  #captureLevels(): Array<SpeakerActivityLevel> {
    if (this.#conversationId == null || this.#callMode == null) {
      return [];
    }

    const state = window.reduxStore.getState();
    const call = getCallSelector(state)(this.#conversationId);
    if (!call) {
      return [];
    }

    const activeCallState = getActiveCallState(state);
    const localLevel =
      activeCallState?.conversationId === this.#conversationId
        ? (activeCallState.localAudioLevel ?? 0)
        : 0;

    const levels: Array<SpeakerActivityLevel> = [];
    levels.push({
      id: LOCAL_SPEAKER_ID,
      level: localLevel,
      speaking: isSignalSpeaking(localLevel),
    });

    if (this.#callMode === CallMode.Direct && call.callMode === CallMode.Direct) {
      const remoteLevel = call.remoteAudioLevel ?? 0;
      levels.push({
        id: REMOTE_SPEAKER_ID,
        level: remoteLevel,
        speaking: isSignalSpeaking(remoteLevel),
      });
      return levels;
    }

    if (
      this.#callMode === CallMode.Group &&
      isGroupOrAdhocCallState(call)
    ) {
      for (const participant of call.remoteParticipants) {
        const id = participant.aci;
        const displayName = this.#resolveParticipantName(participant.aci);
        this.#registerParticipant(id, {
          displayName,
          aci: participant.aci,
          demuxId: participant.demuxId,
          isLocal: false,
        });
        const level = call.remoteAudioLevels?.get(participant.demuxId) ?? 0;
        levels.push({
          id,
          level,
          speaking: isSignalSpeaking(level),
          speakerTime: participant.speakerTime,
        });
      }
    }

    return levels;
  }

  #resolveParticipantName(aci: string): string {
    const conversation = window.ConversationController.get(aci);
    const title = conversation?.getTitle()?.trim();
    if (title && title.length > 0) {
      return title;
    }
    return `Účastník ${aci.slice(0, 8)}`;
  }
}

export const speakerActivityLogger = new SpeakerActivityLogger();

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
  SPEAKER_ACTIVITY_LOG_VERSION,
  SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS,
  type SpeakerActivityLevel,
  type SpeakerActivityLog,
  type SpeakerActivitySample,
  type SpeakerParticipantInfo,
} from './speakerActivity.std.ts';
import { getLocalSpeakerDisplayName } from './localSpeakerName.preload.ts';

const log = createLogger('uuminutes/speakerActivity');

/** Matches Signal CallingAudioIndicator (GroupCallRemoteParticipant.dom.tsx). */
function isSignalSpeaking(level: number): boolean {
  return level > 0;
}

class SpeakerActivityLogger {
  #conversationId: string | null = null;
  #callMode: CallMode.Direct | CallMode.Group | null = null;
  #recordingStartedAt = 0;
  #recordingElapsedMs = 0;
  #intervalId: ReturnType<typeof setInterval> | null = null;
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
    this.#recordingElapsedMs = 0;
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

    this.#intervalId = setInterval(() => {
      this.#tick();
    }, SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS);

    log.info(
      `speaker activity logging started (${options.callMode}, ${options.conversationId})`
    );
  }

  pause(): void {
    if (this.#intervalId == null) {
      return;
    }
    clearInterval(this.#intervalId);
    this.#intervalId = null;
    log.info('speaker activity logging paused');
  }

  resume(): void {
    if (this.#conversationId == null || this.#intervalId != null) {
      return;
    }
    this.#intervalId = setInterval(() => {
      this.#tick();
    }, SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS);
    log.info('speaker activity logging resumed');
  }

  stop(): SpeakerActivityLog | null {
    if (this.#intervalId != null) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }

    if (this.#conversationId == null || this.#callMode == null) {
      return null;
    }

    const activityLog: SpeakerActivityLog = {
      version: SPEAKER_ACTIVITY_LOG_VERSION,
      conversationId: this.#conversationId,
      callMode: this.#callMode,
      recordingStartedAt: this.#recordingStartedAt,
      recordingDurationMs: this.#recordingElapsedMs,
      sampleIntervalMs: SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS,
      participants: { ...this.#participants },
      samples: [...this.#samples],
    };

    log.info(
      `speaker activity logging stopped (${activityLog.samples.length} samples)`
    );

    this.#conversationId = null;
    this.#callMode = null;
    this.#recordingStartedAt = 0;
    this.#recordingElapsedMs = 0;
    this.#participants = {};
    this.#samples = [];

    return activityLog;
  }

  isActive(): boolean {
    return this.#conversationId != null;
  }

  #registerParticipant(id: string, info: SpeakerParticipantInfo): void {
    if (!this.#participants[id]) {
      this.#participants[id] = info;
    }
  }

  #tick(): void {
    const levels = this.#captureLevels();
    if (levels.length === 0) {
      this.#recordingElapsedMs += SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS;
      return;
    }

    this.#samples.push({
      tMs: this.#recordingElapsedMs,
      levels,
    });
    this.#recordingElapsedMs += SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS;
  }

  #captureLevels(): Array<SpeakerActivityLevel> {
    if (this.#conversationId == null || this.#callMode == null) {
      return [];
    }

    const state = window.reduxStore.getState();
    const activeCallState = getActiveCallState(state);
    if (
      !activeCallState ||
      activeCallState.conversationId !== this.#conversationId
    ) {
      return [];
    }

    const call = getCallSelector(state)(this.#conversationId);
    if (!call) {
      return [];
    }

    const levels: Array<SpeakerActivityLevel> = [];
    const localLevel = activeCallState.localAudioLevel ?? 0;
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

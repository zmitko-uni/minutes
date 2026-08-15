// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type RecordingChatNoticePhase = 'started' | 'stopped';

/** Chat notice when call recording starts (visible to the whole conversation). */
export const RECORDING_STARTED_CHAT_NOTICE =
  '🔴 This meeting is being recorded.';

/** Chat notice when call recording stops (visible to the whole conversation). */
export const RECORDING_STOPPED_CHAT_NOTICE = '⏹️ The recording has stopped.';

export function getRecordingChatNotice(
  phase: RecordingChatNoticePhase
): string {
  return phase === 'started'
    ? RECORDING_STARTED_CHAT_NOTICE
    : RECORDING_STOPPED_CHAT_NOTICE;
}

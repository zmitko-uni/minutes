// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import EventEmitter from 'node:events';

import type { UuMinutesRecordingState } from './types.std.ts';

export const RECORDING_STATE_CHANGED = 'recording-state-changed';

class RecordingStateEvents extends EventEmitter {
  emitState(state: UuMinutesRecordingState): void {
    this.emit(RECORDING_STATE_CHANGED, state);
  }
}

export const recordingStateEvents = new RecordingStateEvents();

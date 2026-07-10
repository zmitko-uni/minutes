// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import EventEmitter from 'node:events';

import type { MinutesRecordingState } from './types.std.ts';

export const RECORDING_STATE_CHANGED = 'recording-state-changed';

class RecordingStateEvents extends EventEmitter {
  emitState(state: MinutesRecordingState): void {
    this.emit(RECORDING_STATE_CHANGED, state);
  }
}

export const recordingStateEvents = new RecordingStateEvents();

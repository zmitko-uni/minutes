// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  getRecordingChatNotice,
  RECORDING_STARTED_CHAT_NOTICE,
  RECORDING_STOPPED_CHAT_NOTICE,
} from '../../minutes/recordingChatNotice.std.ts';

describe('minutes/recordingChatNotice', () => {
  it('announces recording start and stop in chat', () => {
    assert.strictEqual(
      getRecordingChatNotice('started'),
      '🔴 This meeting is being recorded.'
    );
    assert.strictEqual(
      getRecordingChatNotice('stopped'),
      '⏹️ The recording has stopped.'
    );
    assert.strictEqual(
      RECORDING_STARTED_CHAT_NOTICE,
      getRecordingChatNotice('started')
    );
    assert.strictEqual(
      RECORDING_STOPPED_CHAT_NOTICE,
      getRecordingChatNotice('stopped')
    );
  });
});

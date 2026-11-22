// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  cancelTranscriptionJob,
  isTranscriptionJobCancelled,
  onTranscriptionJobCancelled,
} from '../../minutes/transcriptionCancel.main.ts';

describe('minutes/transcriptionCancel', () => {
  it('runs registered handlers immediately when the job is cancelled', () => {
    const jobId = 'job-handler-1';
    let calls = 0;
    onTranscriptionJobCancelled(jobId, () => {
      calls += 1;
    });

    assert.equal(calls, 0);
    cancelTranscriptionJob(jobId);
    assert.equal(calls, 1);
    assert.isTrue(isTranscriptionJobCancelled(jobId));
  });

  it('does not run a handler after unsubscribe', () => {
    const jobId = 'job-handler-2';
    let calls = 0;
    const unsubscribe = onTranscriptionJobCancelled(jobId, () => {
      calls += 1;
    });

    unsubscribe();
    cancelTranscriptionJob(jobId);
    assert.equal(calls, 0);
  });

  it('ignores handlers for jobs without an id', () => {
    const unsubscribe = onTranscriptionJobCancelled(undefined, () => {
      throw new Error('must not run');
    });
    unsubscribe();
  });
});

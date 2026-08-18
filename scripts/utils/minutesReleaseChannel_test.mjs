// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { strict as assert } from 'node:assert';

import { resolveMinutesReleaseChannel } from './minutesReleaseChannel.mjs';

describe('resolveMinutesReleaseChannel', () => {
  it('maps main to production', () => {
    assert.equal(resolveMinutesReleaseChannel('main'), 'prod');
  });

  it('maps beta to beta', () => {
    assert.equal(resolveMinutesReleaseChannel('beta'), 'beta');
  });

  it('rejects every other branch', () => {
    assert.throws(
      () => resolveMinutesReleaseChannel('feature/not-a-release'),
      /only run from main or beta/
    );
  });
});

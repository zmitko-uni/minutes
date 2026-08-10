// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { minutesIgnoresGroupCallRingSizeLimit } from '../../minutes/groupCallRing.std.ts';

describe('minutes/groupCallRing', () => {
  it('ignores Signal group call ring size limit', () => {
    assert.isTrue(minutesIgnoresGroupCallRingSizeLimit());
  });
});

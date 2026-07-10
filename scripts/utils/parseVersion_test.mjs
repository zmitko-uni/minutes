// @ts-check
import { assert } from 'chai';

import { parseVersion } from './parseVersion.mjs';

describe('parseVersion', () => {
  it('parses Minutes Signal-mMeetup versions as prod', () => {
    assert.deepEqual(parseVersion('8.21.0-m1.0.1'), {
      channel: 'prod',
      major: 8,
      minor: 21,
      patch: 0,
      prepatch: null,
      build: [],
      isUpdatable: true,
      isNightly: false,
    });
  });
});

// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import lodash from 'lodash';
import { updateRemoteConfig } from '../../test-helpers/RemoteConfigStub.dom.ts';

import { isConversationTooBigToRing } from '../../conversations/isConversationTooBigToRing.dom.ts';
import { minutesIgnoresGroupCallRingSizeLimit } from '../../minutes/groupCallRing.std.ts';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';

const { times } = lodash;

const CONFIG_KEY = 'global.calling.maxGroupCallRingSize';

describe('isConversationTooBigToRing', () => {
  const fakeMemberships = (count: number) =>
    times(count, () => ({
      aci: generateAci(),
      isAdmin: false,
      labelEmoji: undefined,
      labelString: undefined,
    }));

  it('returns false if there are no memberships (i.e., for a direct conversation)', async () => {
    await updateRemoteConfig([]);
    assert.isFalse(isConversationTooBigToRing({}));
    assert.isFalse(isConversationTooBigToRing({ memberships: [] }));
  });

  it('minutes: never treats a group as too big to ring (ignores Signal maxGroupCallRingSize)', async () => {
    assert.isTrue(minutesIgnoresGroupCallRingSizeLimit());

    await updateRemoteConfig([]);
    assert.isFalse(isConversationTooBigToRing({ memberships: fakeMemberships(16) }));
    assert.isFalse(isConversationTooBigToRing({ memberships: fakeMemberships(50) }));

    await updateRemoteConfig([{ name: CONFIG_KEY, value: '9' }]);
    assert.isFalse(isConversationTooBigToRing({ memberships: fakeMemberships(20) }));
  });
});

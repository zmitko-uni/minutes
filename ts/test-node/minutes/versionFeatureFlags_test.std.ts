// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { minutesVersionForSignalFeatureFlags } from '../../minutes/version.std.ts';
import { _isFeatureEnabledInner } from '../../util/isFeatureEnabled.dom.ts';

const isTestEnvironment = () => false;

describe('minutesVersionForSignalFeatureFlags', () => {
  it('maps Minutes prod and beta versions to the Signal base', () => {
    assert.equal(
      minutesVersionForSignalFeatureFlags('8.26.0-m1.6.4'),
      '8.26.0'
    );
    assert.equal(
      minutesVersionForSignalFeatureFlags('v8.26.0-m1.6.3-beta.7'),
      '8.26.0'
    );
  });

  it('leaves Signal versions unchanged', () => {
    assert.equal(
      minutesVersionForSignalFeatureFlags('8.26.0'),
      '8.26.0'
    );
    assert.equal(
      minutesVersionForSignalFeatureFlags('8.26.0-beta.2'),
      '8.26.0-beta.2'
    );
    assert.equal(
      minutesVersionForSignalFeatureFlags('8.26.0-alpha.1'),
      '8.26.0-alpha.1'
    );
  });
});

describe('isFeatureEnabled with Minutes versions', () => {
  it('enables a prod flag for a Minutes version cut from that Signal release', () => {
    assert.isTrue(
      _isFeatureEnabledInner({
        betaValue: '8.20.0-beta.1',
        currentVersion: '8.26.0-m1.6.4',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: '8.26.0',
      })
    );
  });

  it('keeps a flag off when the Signal base is older than the prod rollout', () => {
    assert.isFalse(
      _isFeatureEnabledInner({
        betaValue: '8.27.0-beta.1',
        currentVersion: '8.26.0-m1.6.3-beta.7',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: '8.27.0',
      })
    );
  });
});

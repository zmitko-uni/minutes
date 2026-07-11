// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  bumpMinutesBetaVersion,
  bumpMinutesVersion,
  compareMinutesVersions,
  formatMinutesProductVersion,
  isMinutesBetaVersion,
  isMinutesVersionNewer,
  parseMinutesProductVersion,
  parseMinutesVersion,
  stripMinutesBetaVersion,
} from './parseMinutesVersion.mjs';

describe('parseMinutesVersion', () => {
  it('parses Signal-mMeetup format', () => {
    assert.deepEqual(parseMinutesProductVersion('8.21.0-m1.0.1'), {
      signalBase: '8.21.0',
      meetup: '1.0.1',
      beta: null,
    });
    assert.deepEqual(parseMinutesVersion('v8.21.0-m1.0.1'), {
      signalBase: '8.21.0',
      major: 1,
      minor: 0,
      patch: 1,
      beta: null,
    });
  });

  it('parses beta suffix', () => {
    assert.deepEqual(parseMinutesProductVersion('8.21.0-m1.0.4-beta.2'), {
      signalBase: '8.21.0',
      meetup: '1.0.4',
      beta: 2,
    });
    assert.isTrue(isMinutesBetaVersion('8.21.0-m1.0.4-beta.1'));
  });

  it('bumps Meetup part only for prod', () => {
    assert.equal(
      bumpMinutesVersion('8.21.0-m1.0.1', 'patch'),
      '8.21.0-m1.0.2'
    );
  });

  it('bumps beta counter', () => {
    assert.equal(
      bumpMinutesBetaVersion('8.21.0-m1.0.4'),
      '8.21.0-m1.0.4-beta.1'
    );
    assert.equal(
      bumpMinutesBetaVersion('8.21.0-m1.0.4-beta.1'),
      '8.21.0-m1.0.4-beta.2'
    );
  });

  it('strips beta for prod promotion', () => {
    assert.equal(
      stripMinutesBetaVersion('8.21.0-m1.0.4-beta.3'),
      '8.21.0-m1.0.4'
    );
  });
});

describe('compareMinutesVersions', () => {
  it('orders beta releases on same meetup line', () => {
    assert.equal(
      compareMinutesVersions('8.21.0-m1.0.4-beta.2', '8.21.0-m1.0.4-beta.1'),
      1
    );
    assert.isTrue(
      isMinutesVersionNewer('8.21.0-m1.0.4', '8.21.0-m1.0.4-beta.3')
    );
  });

  it('prefers Meetup format over legacy alpha on same Signal base', () => {
    assert.isTrue(
      isMinutesVersionNewer('8.21.0-m1.0.1', '8.21.0-alpha.9')
    );
  });

  it('formats product version', () => {
    assert.equal(
      formatMinutesProductVersion('8.21.0', '1.0.1', 1),
      '8.21.0-m1.0.1-beta.1'
    );
  });
});

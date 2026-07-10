// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  bumpMinutesVersion,
  compareMinutesVersions,
  formatMinutesProductVersion,
  isMinutesVersionNewer,
  parseMinutesProductVersion,
  parseMinutesVersion,
} from './parseMinutesVersion.mjs';

describe('parseMinutesVersion', () => {
  it('parses Signal-mMeetup format', () => {
    assert.deepEqual(parseMinutesProductVersion('8.21.0-m1.0.1'), {
      signalBase: '8.21.0',
      meetup: '1.0.1',
    });
    assert.deepEqual(parseMinutesVersion('v8.21.0-m1.0.1'), {
      signalBase: '8.21.0',
      major: 1,
      minor: 0,
      patch: 1,
    });
  });

  it('bumps Meetup part only', () => {
    assert.equal(
      bumpMinutesVersion('8.21.0-m1.0.1', 'patch'),
      '8.21.0-m1.0.2'
    );
    assert.equal(
      bumpMinutesVersion('8.21.0-m1.0.1', 'minor'),
      '8.21.0-m1.1.0'
    );
    assert.equal(
      bumpMinutesVersion('8.21.0-m1.0.1', 'major'),
      '8.21.0-m2.0.0'
    );
  });

  it('migrates legacy plain Meetup semver for bump', () => {
    assert.equal(bumpMinutesVersion('1.0.1', 'patch'), '8.21.0-m1.0.2');
  });
});

describe('compareMinutesVersions', () => {
  it('orders Meetup patch releases', () => {
    assert.equal(
      compareMinutesVersions('8.21.0-m1.0.2', '8.21.0-m1.0.1'),
      1
    );
  });

  it('prefers Meetup format over legacy alpha on same Signal base', () => {
    assert.isTrue(
      isMinutesVersionNewer('8.21.0-m1.0.1', '8.21.0-alpha.9')
    );
  });

  it('prefers Meetup format over legacy plain Meetup semver', () => {
    assert.isTrue(isMinutesVersionNewer('8.21.0-m1.0.2', '1.0.1'));
    assert.equal(
      compareMinutesVersions('1.0.1', '8.21.0-m1.0.1'),
      0
    );
  });

  it('compares Signal base before Meetup part', () => {
    assert.isTrue(
      isMinutesVersionNewer('8.22.0-m1.0.0', '8.21.0-m9.9.9')
    );
  });

  it('formats product version', () => {
    assert.equal(formatMinutesProductVersion('8.21.0', '1.0.1'), '8.21.0-m1.0.1');
  });
});

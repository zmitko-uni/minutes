// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  mergePackageJson,
  minutesVersionForSignal,
} from './mergePackageJson.mjs';

describe('mergePackageJson', () => {
  it('keeps Minutes identity and moves its version to the new Signal base', () => {
    const base = {
      name: 'signal-desktop',
      version: '8.21.0-alpha.1',
      dependencies: { upstream: '1' },
    };
    const ours = {
      name: 'minutes-desktop',
      version: '8.21.0-m1.2.1',
      dependencies: { upstream: '1', minutes: '1' },
    };
    const theirs = {
      name: 'signal-desktop',
      version: '8.23.0',
      dependencies: { upstream: '2' },
    };

    assert.deepEqual(mergePackageJson(base, ours, theirs), {
      name: 'minutes-desktop',
      version: '8.23.0-m1.2.1',
      dependencies: { upstream: '2', minutes: '1' },
    });
  });

  it('combines independent array additions and honors removals', () => {
    const base = {
      version: '8.21.0-alpha.1',
      build: { files: ['shared', 'removed-by-minutes'] },
    };
    const ours = {
      version: '8.21.0-m1.2.1',
      build: { files: ['shared', 'minutes'] },
    };
    const theirs = {
      version: '8.23.0',
      build: { files: ['shared', 'removed-by-minutes', 'signal'] },
    };

    assert.deepEqual(mergePackageJson(base, ours, theirs).build.files, [
      'shared',
      'signal',
      'minutes',
    ]);
  });

  it('rejects an unknown scalar conflict', () => {
    assert.throws(
      () =>
        mergePackageJson(
          { custom: 'base', version: '8.21.0' },
          { custom: 'minutes', version: '8.21.0-m1.0.0' },
          { custom: 'signal', version: '8.23.0' }
        ),
      'Unsupported package.json conflict at custom'
    );
  });
});

describe('minutesVersionForSignal', () => {
  it('supports prerelease Signal package versions', () => {
    assert.equal(
      minutesVersionForSignal('8.24.0-alpha.2', '8.23.0-m1.2.1'),
      '8.24.0-m1.2.1'
    );
  });
});

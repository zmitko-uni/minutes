// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  MINUTES_CONFIG_ENV,
  resolveMinutesConfigEnv,
} from '../../minutes/configEnv.std.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

describe('minutes/configEnv', () => {
  it('always uses the minutes profile in packaged builds', () => {
    assert.equal(
      resolveMinutesConfigEnv({ isPackaged: true, currentValue: undefined }),
      MINUTES_CONFIG_ENV
    );
    assert.equal(
      resolveMinutesConfigEnv({ isPackaged: true, currentValue: 'production' }),
      MINUTES_CONFIG_ENV
    );
  });

  it('keeps an explicit profile in development', () => {
    assert.equal(
      resolveMinutesConfigEnv({
        isPackaged: false,
        currentValue: 'minutes-beta',
      }),
      'minutes-beta'
    );
  });

  it('defaults to the minutes profile when nothing is set', () => {
    assert.equal(
      resolveMinutesConfigEnv({ isPackaged: false, currentValue: undefined }),
      MINUTES_CONFIG_ENV
    );
    assert.equal(
      resolveMinutesConfigEnv({ isPackaged: false, currentValue: '  ' }),
      MINUTES_CONFIG_ENV
    );
  });

  // Regression: Signal 8.36 clears NODE_CONFIG_ENV for packaged builds, which
  // silently dropped our profile (Signal auto-updater on, wrong data dir).
  it('restores the minutes profile after the upstream env hardening', () => {
    const source = readFileSync(join(repoRoot, 'app', 'config.main.ts'), 'utf8');

    const clearedAt = source.indexOf("process.env.NODE_CONFIG_ENV = '';");
    const restoredAt = source.indexOf('applyMinutesConfigEnv();');
    const loadedAt = source.indexOf("require('config')");

    if (clearedAt !== -1) {
      assert.ok(restoredAt > clearedAt, 'restore must run after clearing');
    }
    assert.ok(restoredAt !== -1, 'applyMinutesConfigEnv() call is missing');
    assert.ok(restoredAt < loadedAt, 'restore must run before config loads');
  });

  it('minutes profile disables Signal updates and selects the Minutes data dir', () => {
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        "const c = require('config'); console.log(JSON.stringify({ updatesEnabled: c.get('updatesEnabled'), storageProfile: c.has('storageProfile') }));",
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          NODE_CONFIG_ENV: MINUTES_CONFIG_ENV,
          NODE_CONFIG_DIR: join(repoRoot, 'config'),
        },
      }
    );

    assert.deepEqual(JSON.parse(output.trim().split('\n').at(-1) ?? '{}'), {
      updatesEnabled: false,
      storageProfile: true,
    });
  });
});

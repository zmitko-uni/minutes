// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  getMinutesReleaseChannel,
  isMinutesBetaExecutablePath,
  MINUTES_BETA_INSTALLER_ASSET_MACOS,
  MINUTES_PROD_INSTALLER_ASSET_MACOS,
} from '../../minutes/releaseChannel.std.ts';
import { getMinutesInstallerAssetNameForPlatform } from '../../minutes/appUpdate.std.ts';

describe('minutes/releaseChannel', () => {
  it('prefers explicit packaged channel metadata over product name', () => {
    assert.equal(getMinutesReleaseChannel('Minutes', 'beta'), 'beta');
    assert.equal(getMinutesReleaseChannel('Minutes Beta', 'prod'), 'prod');
  });

  it('keeps product-name fallback for older packages', () => {
    assert.equal(getMinutesReleaseChannel('Minutes Beta', undefined), 'beta');
    assert.equal(getMinutesReleaseChannel('Minutes', undefined), 'prod');
  });

  it('detects packaged beta executables on every supported platform', () => {
    assert.isTrue(
      isMinutesBetaExecutablePath(
        '/Applications/Minutes Beta.app/Contents/MacOS/Minutes Beta'
      )
    );
    assert.isTrue(
      isMinutesBetaExecutablePath(
        'C:\\Program Files\\Minutes Beta\\Minutes Beta.exe'
      )
    );
    assert.isTrue(
      isMinutesBetaExecutablePath('/opt/Minutes Beta/minutes-beta')
    );
    assert.isFalse(
      isMinutesBetaExecutablePath(
        '/Applications/Minutes.app/Contents/MacOS/Minutes'
      )
    );
  });

  it('prefers the packaged beta executable over stale bundled metadata', () => {
    assert.equal(
      getMinutesReleaseChannel(
        'Minutes',
        'prod',
        '/Applications/Minutes Beta.app/Contents/MacOS/Minutes Beta'
      ),
      'beta'
    );
  });

  it('uses distinct macOS assets for prod and beta', () => {
    assert.equal(
      getMinutesInstallerAssetNameForPlatform('darwin', 'beta'),
      MINUTES_BETA_INSTALLER_ASSET_MACOS
    );
    assert.equal(
      getMinutesInstallerAssetNameForPlatform('darwin', 'prod'),
      MINUTES_PROD_INSTALLER_ASSET_MACOS
    );
  });
});

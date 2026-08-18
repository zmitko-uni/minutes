// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  getMinutesReleaseChannel,
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

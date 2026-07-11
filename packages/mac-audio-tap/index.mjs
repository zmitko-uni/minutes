// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import bindings from 'bindings';

let addon;

function getAddon() {
  if (addon === undefined) {
    try {
      addon = bindings('mac-audio-tap');
    } catch {
      // Windows, Linux, or a build without the addon
      addon = null;
    }
  }

  return addon;
}

export function isSupported() {
  const loaded = getAddon();
  return loaded != null && loaded.isSupported === true;
}

export function start(options) {
  const loaded = getAddon();
  if (loaded == null || loaded.isSupported !== true) {
    throw new Error('mac-audio-tap is not supported on this system');
  }
  loaded.start(options);
}

export function stop() {
  const loaded = getAddon();
  if (loaded != null && loaded.isSupported === true) {
    loaded.stop();
  }
}

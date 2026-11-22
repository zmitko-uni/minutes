// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { CallLinkRootKey } from '@signalapp/ringrtc';

/**
 * Signal calls `CallLinkRootKey.toUnredactedString()`. RingRTC 2.74 (the
 * Minutes fork baseline since Signal 8.36) provides it natively, so this shim
 * is a no-op there. It only matters when pinned to an older RingRTC (<= 2.71),
 * where the formatted key is still `toString()`
 * (`CallLinkRootKey_toFormattedString`).
 */
declare module '@signalapp/ringrtc' {
  interface CallLinkRootKey {
    toUnredactedString(): string;
  }
}

export function installMinutesRingrtcCompat(): void {
  const proto = CallLinkRootKey.prototype as CallLinkRootKey & {
    toUnredactedString?: () => string;
  };
  if (typeof proto.toUnredactedString === 'function') {
    return;
  }
  proto.toUnredactedString = function toUnredactedString(
    this: CallLinkRootKey
  ): string {
    return this.toString();
  };
}

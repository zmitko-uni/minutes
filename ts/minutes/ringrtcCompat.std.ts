// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { CallLinkRootKey } from '@signalapp/ringrtc';

/**
 * Signal 8.32 calls `CallLinkRootKey.toUnredactedString()`. Minutes stays on
 * RingRTC 2.71.0-minutes.1, where the formatted key is still `toString()`
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

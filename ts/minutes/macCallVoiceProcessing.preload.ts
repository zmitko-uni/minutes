// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { RingRTC } from '@signalapp/ringrtc';

import { createLogger } from '../logging/log.std.ts';

const log = createLogger('minutes/macCallVoiceProcessing');

/**
 * On macOS RingRTC records through a plain HAL audio unit unless voice
 * processing is turned on. HAL capture does not expose Control Center Mic
 * Modes (Standard / Voice Isolation / Wide Spectrum), so users cannot change
 * them during a call.
 *
 * Enabling voice processing switches the input stream to VoiceProcessingIO,
 * which is what FaceTime and other VoIP apps use — Mic Modes become selectable
 * for the rest of the process lifetime. Idempotent; no-op on Windows/Linux.
 */
export function enableMacCallVoiceProcessing(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  try {
    RingRTC.setVoiceProcessingEnabled(true);
    log.info('enabled RingRTC voice processing (macOS Mic Modes)');
  } catch (error) {
    log.warn('failed to enable RingRTC voice processing', error);
  }
}

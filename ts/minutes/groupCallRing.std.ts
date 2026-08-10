// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Signal disables group-call ringing when memberships >= maxGroupCallRingSize
 * (remote config, default 16). Minutes lifts that client gate so large groups
 * can ring — useful when all participants run Minutes.
 *
 * Incoming/outgoing UI and ringAll() all go through isConversationTooBigToRing;
 * this flag is the single Minutes override.
 */
export function minutesIgnoresGroupCallRingSizeLimit(): boolean {
  return true;
}

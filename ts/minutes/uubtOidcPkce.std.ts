// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createHash, randomBytes } from 'node:crypto';

export function randomUrlSafeString(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function pkceChallengeFromVerifier(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UubtToken } from './uubt.std.ts';

type TokenCacheEntry = UubtToken & { cacheKey: string };

let cachedToken: TokenCacheEntry | null = null;

export function getCachedUubtToken(cacheKey: string): UubtToken | null {
  if (cachedToken && cachedToken.cacheKey === cacheKey) {
    return cachedToken;
  }
  return null;
}

export function setCachedUubtToken(
  cacheKey: string,
  token: UubtToken
): void {
  cachedToken = { ...token, cacheKey };
}

export function clearUubtTokenCache(): void {
  cachedToken = null;
}

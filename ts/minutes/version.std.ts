// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import semver from 'semver';

export const MINUTES_MEETUP_VERSION_PREFIX = 'Meetup';

/** Upstream Signal Desktop release (sync when merging upstream). */
export const MINUTES_SIGNAL_BASE_VERSION = '8.21.0';

export function normalizeVersionTag(tag: string): string {
  return tag.trim().replace(/^v/i, '');
}

/** Legacy alpha builds tied to Signal base (8.21.0-alpha.N). */
export function isLegacyMinutesAlphaVersion(version: string): boolean {
  return /^8\.\d+\.\d+-alpha\.\d+$/i.test(normalizeVersionTag(version));
}

export function parseMinutesSemverVersion(
  version: string
): semver.SemVer | null {
  const normalized = normalizeVersionTag(version);
  return semver.parse(normalized) ?? semver.parse(normalized, { loose: true });
}

/**
 * Compare Minutes product versions. Legacy alpha builds are always older than Meetup 1.x+.
 */
export function compareMinutesVersions(left: string, right: string): number {
  const a = normalizeVersionTag(left);
  const b = normalizeVersionTag(right);

  const aLegacy = isLegacyMinutesAlphaVersion(a);
  const bLegacy = isLegacyMinutesAlphaVersion(b);

  if (aLegacy && !bLegacy) {
    const bParsed = semver.parse(b);
    if (bParsed && bParsed.major >= 1) {
      return -1;
    }
  }
  if (!aLegacy && bLegacy) {
    const aParsed = semver.parse(a);
    if (aParsed && aParsed.major >= 1) {
      return 1;
    }
  }

  return semver.compare(a, b);
}

export function isMinutesVersionNewer(
  latest: string,
  current: string
): boolean {
  return compareMinutesVersions(latest, current) === 1;
}

export function formatMinutesVersionLabel(appVersion: string): string {
  return `${MINUTES_MEETUP_VERSION_PREFIX} ${appVersion} (Signal Desktop ${MINUTES_SIGNAL_BASE_VERSION})`;
}

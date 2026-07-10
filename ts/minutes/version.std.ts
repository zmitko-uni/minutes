// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import semver from 'semver';

/** Upstream Signal Desktop release (sync when merging upstream). */
export const MINUTES_SIGNAL_BASE_VERSION = '8.21.0';

/** `{signalBase}-m{meetupSemver}` e.g. `8.21.0-m1.0.1` */
export const MINUTES_PRODUCT_VERSION_PATTERN =
  /^(\d+\.\d+\.\d+)-m(\d+\.\d+\.\d+)$/i;

export type MinutesProductVersion = Readonly<{
  signalBase: string;
  meetup: string;
}>;

export function normalizeVersionTag(tag: string): string {
  return tag.trim().replace(/^v/i, '');
}

export function parseMinutesProductVersion(
  version: string
): MinutesProductVersion | null {
  const normalized = normalizeVersionTag(version);
  const match = MINUTES_PRODUCT_VERSION_PATTERN.exec(normalized);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    signalBase: match[1],
    meetup: match[2],
  };
}

export function formatMinutesProductVersion(
  signalBase: string,
  meetup: string
): string {
  return `${signalBase}-m${meetup}`;
}

/** Legacy alpha builds tied to Signal base (8.21.0-alpha.N). */
export function isLegacyMinutesAlphaVersion(version: string): boolean {
  return /^(\d+\.\d+\.\d+)-alpha\.\d+$/i.test(normalizeVersionTag(version));
}

/** Legacy Meetup-only semver before `-m` format (e.g. 1.0.1). */
export function isLegacyPlainMeetupVersion(version: string): boolean {
  const normalized = normalizeVersionTag(version);
  return /^\d+\.\d+\.\d+$/.test(normalized);
}

export function normalizeMinutesVersionForCompare(version: string): string {
  const normalized = normalizeVersionTag(version);
  const product = parseMinutesProductVersion(normalized);

  if (product) {
    return formatMinutesProductVersion(product.signalBase, product.meetup);
  }

  if (isLegacyMinutesAlphaVersion(normalized)) {
    return normalized;
  }

  if (isLegacyPlainMeetupVersion(normalized)) {
    return formatMinutesProductVersion(
      MINUTES_SIGNAL_BASE_VERSION,
      normalized
    );
  }

  return normalized;
}

export function parseMinutesSemverVersion(
  version: string
): semver.SemVer | null {
  const normalized = normalizeMinutesVersionForCompare(version);
  return semver.parse(normalized) ?? semver.parse(normalized, { loose: true });
}

export function compareMinutesVersions(left: string, right: string): number {
  return semver.compare(
    normalizeMinutesVersionForCompare(left),
    normalizeMinutesVersionForCompare(right)
  );
}

export function isMinutesVersionNewer(
  latest: string,
  current: string
): boolean {
  return compareMinutesVersions(latest, current) === 1;
}

export function formatMinutesVersionLabel(appVersion: string): string {
  const normalized = normalizeVersionTag(appVersion);

  if (parseMinutesProductVersion(normalized)) {
    return normalized;
  }

  if (isLegacyPlainMeetupVersion(normalized)) {
    return formatMinutesProductVersion(
      MINUTES_SIGNAL_BASE_VERSION,
      normalized
    );
  }

  return normalized;
}

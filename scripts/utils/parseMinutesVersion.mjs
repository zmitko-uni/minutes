// Minutes product versioning (independent of Signal Desktop base).
// Semver: major.minor.patch — patch = hotfix, minor = features, major = breaking.
import semver from 'semver';

/** @typedef {'major' | 'minor' | 'patch'} MinutesBumpLevel */

/**
 * @param {string} version
 * @returns {{ major: number; minor: number; patch: number }}
 */
export function parseMinutesVersion(version) {
  const normalized = version.trim().replace(/^v/i, '');
  const parsed = semver.parse(normalized) ?? semver.parse(normalized, { loose: true });
  if (!parsed) {
    throw new TypeError(`Invalid Minutes version: ${version}`);
  }
  return {
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch,
  };
}

/**
 * @param {string} version
 * @param {MinutesBumpLevel} [level='patch']
 * @returns {string}
 */
export function bumpMinutesVersion(version, level = 'patch') {
  const normalized = version.trim().replace(/^v/i, '');
  const parsed = semver.parse(normalized) ?? semver.parse(normalized, { loose: true });
  if (!parsed) {
    throw new TypeError(`Invalid Minutes version: ${version}`);
  }

  if (level === 'major') {
    return `${parsed.major + 1}.0.0`;
  }
  if (level === 'minor') {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

/** Legacy alpha builds tied to Signal base (8.21.0-alpha.N). */
export function isLegacyMinutesAlphaVersion(version) {
  return /^8\.\d+\.\d+-alpha\.\d+$/i.test(version.trim().replace(/^v/i, ''));
}

/**
 * Compare Minutes product versions. Legacy alpha builds are always older than Meetup 1.x+.
 * @returns {1 | 0 | -1}
 */
export function compareMinutesVersions(left, right) {
  const a = left.trim().replace(/^v/i, '');
  const b = right.trim().replace(/^v/i, '');

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

/**
 * @param {string} latest
 * @param {string} current
 * @returns {boolean}
 */
export function isMinutesVersionNewer(latest, current) {
  return compareMinutesVersions(latest, current) === 1;
}

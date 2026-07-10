// Minutes product versioning: {SignalBase}-m{MeetupSemver} e.g. 8.21.0-m1.0.1
import semver from 'semver';

export const MINUTES_SIGNAL_BASE_VERSION = '8.21.0';

const MINUTES_PRODUCT_VERSION_PATTERN =
  /^(\d+\.\d+\.\d+)-m(\d+\.\d+\.\d+)$/i;

/** @typedef {'major' | 'minor' | 'patch'} MinutesBumpLevel */

/**
 * @param {string} version
 * @returns {string}
 */
function normalizeVersionTag(version) {
  return version.trim().replace(/^v/i, '');
}

/**
 * @param {string} version
 * @returns {{ signalBase: string; meetup: string } | null}
 */
export function parseMinutesProductVersion(version) {
  const normalized = normalizeVersionTag(version);
  const match = MINUTES_PRODUCT_VERSION_PATTERN.exec(normalized);
  if (!match) {
    return null;
  }

  return {
    signalBase: match[1],
    meetup: match[2],
  };
}

/**
 * @param {string} signalBase
 * @param {string} meetup
 * @returns {string}
 */
export function formatMinutesProductVersion(signalBase, meetup) {
  return `${signalBase}-m${meetup}`;
}

/**
 * @param {string} version
 * @returns {boolean}
 */
export function isLegacyMinutesAlphaVersion(version) {
  return /^(\d+\.\d+\.\d+)-alpha\.\d+$/i.test(normalizeVersionTag(version));
}

/**
 * @param {string} version
 * @returns {boolean}
 */
export function isLegacyPlainMeetupVersion(version) {
  const normalized = normalizeVersionTag(version);
  return /^\d+\.\d+\.\d+$/.test(normalized);
}

/**
 * @param {string} version
 * @returns {string}
 */
export function normalizeMinutesVersionForCompare(version) {
  const normalized = normalizeVersionTag(version);
  const product = parseMinutesProductVersion(normalized);

  if (product) {
    return formatMinutesProductVersion(product.signalBase, product.meetup);
  }

  if (isLegacyMinutesAlphaVersion(normalized)) {
    return normalized;
  }

  if (isLegacyPlainMeetupVersion(normalized)) {
    return formatMinutesProductVersion(MINUTES_SIGNAL_BASE_VERSION, normalized);
  }

  return normalized;
}

/**
 * @param {string} version
 * @returns {{ signalBase: string; major: number; minor: number; patch: number }}
 */
export function parseMinutesVersion(version) {
  const product = parseMinutesProductVersion(version);
  if (product) {
    const meetup = semver.parse(product.meetup);
    if (!meetup) {
      throw new TypeError(`Invalid Meetup semver in version: ${version}`);
    }

    return {
      signalBase: product.signalBase,
      major: meetup.major,
      minor: meetup.minor,
      patch: meetup.patch,
    };
  }

  const normalized = normalizeVersionTag(version);
  const plain = semver.parse(normalized) ?? semver.parse(normalized, { loose: true });
  if (plain && isLegacyPlainMeetupVersion(normalized)) {
    return {
      signalBase: MINUTES_SIGNAL_BASE_VERSION,
      major: plain.major,
      minor: plain.minor,
      patch: plain.patch,
    };
  }

  throw new TypeError(
    `Invalid Minutes version (expected ${MINUTES_SIGNAL_BASE_VERSION}-mX.Y.Z): ${version}`
  );
}

/**
 * @param {string} version
 * @param {MinutesBumpLevel} [level='patch']
 * @returns {string}
 */
export function bumpMinutesVersion(version, level = 'patch') {
  const parsed = parseMinutesVersion(version);
  let { major, minor, patch } = parsed;

  if (level === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (level === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return formatMinutesProductVersion(
    parsed.signalBase,
    `${major}.${minor}.${patch}`
  );
}

/**
 * Compare Minutes product versions (legacy alpha / plain Meetup included).
 * @returns {1 | 0 | -1}
 */
export function compareMinutesVersions(left, right) {
  return semver.compare(
    normalizeMinutesVersionForCompare(left),
    normalizeMinutesVersionForCompare(right)
  );
}

/**
 * @param {string} latest
 * @param {string} current
 * @returns {boolean}
 */
export function isMinutesVersionNewer(latest, current) {
  return compareMinutesVersions(latest, current) === 1;
}

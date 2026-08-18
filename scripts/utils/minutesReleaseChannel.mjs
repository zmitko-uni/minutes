// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Derive the release channel from the branch selected for workflow_dispatch.
 * Keeping one source of truth prevents a beta build from modifying main (or a
 * production build from modifying beta).
 *
 * @param {string} refName
 * @returns {'prod' | 'beta'}
 */
export function resolveMinutesReleaseChannel(refName) {
  if (refName === 'main') {
    return 'prod';
  }

  if (refName === 'beta') {
    return 'beta';
  }

  throw new Error(
    `Minutes releases may only run from main or beta (received: ${refName || '<empty>'})`
  );
}

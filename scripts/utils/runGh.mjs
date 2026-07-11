// SPDX-License-Identifier: AGPL-3.0-only

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const WINDOWS_GH_PATHS = [
  join(process.env['ProgramFiles'] ?? '', 'GitHub CLI', 'gh.exe'),
  join(
    process.env['LOCALAPPDATA'] ?? '',
    'Programs',
    'GitHub CLI',
    'gh.exe'
  ),
];

/**
 * Resolve gh executable (Windows install path may be missing from Node PATH).
 * @returns {string}
 */
export function resolveGhExecutable() {
  const fromEnv = process.env.MINUTES_GH_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv;
  }

  if (process.platform === 'win32') {
    for (const candidate of WINDOWS_GH_PATHS) {
      if (candidate && existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return 'gh';
}

/**
 * @param {string} args
 * @returns {string}
 */
export function runGh(args) {
  const executable = resolveGhExecutable();
  const command =
    executable === 'gh' ? `gh ${args}` : `"${executable}" ${args}`;

  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function ensureGhAuth() {
  try {
    runGh('auth status');
  } catch {
    console.error('GitHub CLI není přihlášené. Spusť: gh auth login');
    process.exit(1);
  }
}

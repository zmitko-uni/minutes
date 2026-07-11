#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// Bump package.json and promote CHANGELOG [Unreleased] before GitHub Release.
// Usage:
//   pnpm run release:minutes:metadata          (prod / main)
//   pnpm run release:minutes:beta:metadata   (beta branch)

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {'prod' | 'beta'} */
const releaseChannel =
  process.env.MINUTES_RELEASE_CHANNEL === 'beta' ? 'beta' : 'prod';
const targetBranch = releaseChannel === 'beta' ? 'beta' : 'main';

function run(label, command, env = {}) {
  console.log(`\n=== ${label} ===\n`);
  execSync(command, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
}

run('Bump version', 'node scripts/bump-minutes-release-version.mjs', {
  MINUTES_RELEASE_CHANNEL: releaseChannel,
});

const version = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf8')
).version;

run('Prepare CHANGELOG', `node scripts/prepare-changelog-release.mjs ${version}`);

const commitPrefix =
  releaseChannel === 'beta'
    ? `chore(release): [beta] Minutes ${version}`
    : `chore(release): Minutes ${version}`;

console.log(`
=== Ready for ${releaseChannel} release ===

  Version: ${version}
  Branch:  ${targetBranch}
  Commit:  git add package.json CHANGELOG.md
           git commit -m "${commitPrefix}"
  Push:    git push origin ${targetBranch}
           → spustí GitHub Actions Release Minutes (${releaseChannel})
`);

#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// Bump package.json and promote CHANGELOG [Unreleased] before push to main.
// Usage: pnpm run release:minutes:metadata

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(label, command) {
  console.log(`\n=== ${label} ===\n`);
  execSync(command, { cwd: root, stdio: 'inherit', shell: true });
}

run('Bump version', 'node scripts/bump-minutes-release-version.mjs');

const version = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf8')
).version;

run('Prepare CHANGELOG', `node scripts/prepare-changelog-release.mjs ${version}`);

console.log(`
=== Ready for release ===

  Version: ${version}
  Commit:  git add package.json CHANGELOG.md
           git commit -m "chore(release): Minutes ${version}"
  Push:    git push origin main  → triggers GitHub Actions release automatically
`);

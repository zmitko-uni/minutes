#!/usr/bin/env node
// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Merge Signal Desktop into Minutes without adding a persistent upstream remote.
// Used from GitHub Actions (.github/workflows/minutes-merge-upstream.yml).
// Local use: run from a clone whose origin is https://github.com/zmitko-uni/minutes

import { spawnSync } from 'node:child_process';

const SIGNAL_REPO_URL = 'https://github.com/signalapp/Signal-Desktop.git';
const SIGNAL_REF = process.argv[2] ?? 'main';

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function getOriginUrl() {
  const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

const originUrl = getOriginUrl();
if (originUrl && !originUrl.includes('zmitko-uni/minutes')) {
  console.warn(
    `Warning: origin is "${originUrl}" — expected https://github.com/zmitko-uni/minutes.git`
  );
  console.warn(
    'Reconfigure: git remote set-url origin https://github.com/zmitko-uni/minutes.git'
  );
}

console.log(`Fetching Signal Desktop (${SIGNAL_REF}) from ${SIGNAL_REPO_URL}...`);
run('git', ['fetch', SIGNAL_REPO_URL, SIGNAL_REF]);

console.log(`Merging FETCH_HEAD (${SIGNAL_REF}) into current branch...`);
run('git', ['merge', 'FETCH_HEAD', '--no-edit']);

console.log('');
console.log('Upstream merge complete.');
console.log('Review conflicts in hook files listed in docs/MINUTES-PATCHES.md if any.');
console.log('Update MINUTES_SIGNAL_BASE_VERSION in ts/minutes/welcomeContent.std.ts if needed.');

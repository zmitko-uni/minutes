#!/usr/bin/env node
// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { spawnSync } from 'node:child_process';

const UPSTREAM_REMOTE = 'upstream';
const UPSTREAM_URL = 'https://github.com/signalapp/Signal-Desktop.git';
const UPSTREAM_BRANCH = process.argv[2] ?? 'main';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function remoteExists() {
  const result = spawnSync('git', ['remote'], { encoding: 'utf8' });
  return result.stdout.split(/\r?\n/).includes(UPSTREAM_REMOTE);
}

if (!remoteExists()) {
  console.log(`Adding remote ${UPSTREAM_REMOTE} -> ${UPSTREAM_URL}`);
  run('git', ['remote', 'add', UPSTREAM_REMOTE, UPSTREAM_URL]);
}

console.log(`Fetching ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}...`);
run('git', ['fetch', UPSTREAM_REMOTE, UPSTREAM_BRANCH]);

console.log(`Merging ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}...`);
run('git', ['merge', `${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}`, '--no-edit']);

console.log('Upstream merge complete. Review conflicts in ts/services/calling.preload.ts and ts/uuminutes/ if any.');

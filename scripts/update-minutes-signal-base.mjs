#!/usr/bin/env node
// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

import { minutesVersionForSignal } from './utils/mergePackageJson.mjs';

const upstreamRef = process.argv[2] ?? 'FETCH_HEAD';
const upstreamPackage = JSON.parse(
  execFileSync('git', ['show', `${upstreamRef}:package.json`], {
    encoding: 'utf8',
  })
);
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
packageJson.version = minutesVersionForSignal(
  upstreamPackage.version,
  packageJson.version
);
writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

const signalBase = /^(\d+\.\d+\.\d+)/.exec(upstreamPackage.version)?.[1];
if (!signalBase) {
  throw new Error(`Unsupported Signal version: ${upstreamPackage.version}`);
}

for (const file of [
  'scripts/utils/parseMinutesVersion.mjs',
  'ts/minutes/version.std.ts',
]) {
  const source = readFileSync(file, 'utf8');
  const pattern = /export const MINUTES_SIGNAL_BASE_VERSION = '[^']+';/g;
  const matches = source.match(pattern);
  if (matches?.length !== 1) {
    throw new Error(`Expected one MINUTES_SIGNAL_BASE_VERSION in ${file}`);
  }
  writeFileSync(
    file,
    source.replace(
      pattern,
      `export const MINUTES_SIGNAL_BASE_VERSION = '${signalBase}';`
    )
  );
}

console.log(`Minutes Signal base updated to ${signalBase}`);

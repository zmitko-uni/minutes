#!/usr/bin/env node
// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Compare Minutes' Signal base version to the latest stable Signal Desktop tag.
// Writes GitHub Actions outputs: should_sync, signal_ref, current_base, latest_stable.
// Usage (CI): node scripts/check-signal-upstream.mjs
// Requires: gh CLI + GH_TOKEN (or GITHUB_TOKEN) with public read + repo PR list.

import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runGh } from './utils/runGh.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_FILE = join(ROOT, 'ts/minutes/version.std.ts');
const SIGNAL_REPO = 'signalapp/Signal-Desktop';
const STABLE_TAG_RE = /^v?(\d+\.\d+\.\d+)$/;

/**
 * @param {string} version
 * @returns {[number, number, number] | null}
 */
function parseStableSemver(version) {
  const match = version.trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * @param {[number, number, number]} a
 * @param {[number, number, number]} b
 * @returns {number} 1 if a>b, -1 if a<b, 0 if equal
 */
function compareSemver(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) {
      return 1;
    }
    if (a[i] < b[i]) {
      return -1;
    }
  }
  return 0;
}

function readMinutesSignalBaseVersion() {
  const source = readFileSync(VERSION_FILE, 'utf8');
  const match = source.match(
    /MINUTES_SIGNAL_BASE_VERSION\s*=\s*['"]([^'"]+)['"]/
  );
  if (!match) {
    throw new Error(
      `Could not parse MINUTES_SIGNAL_BASE_VERSION from ${VERSION_FILE}`
    );
  }
  return match[1];
}

/**
 * Newest stable tag on signalapp/Signal-Desktop (e.g. v8.22.0).
 * Tags are returned newest-first by the GitHub API.
 * @returns {{ tag: string, version: string }}
 */
function fetchLatestStableSignalTag() {
  const raw = runGh(
    `api "repos/${SIGNAL_REPO}/tags?per_page=100" --jq ".[].name"`
  );
  const tags = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  for (const tag of tags) {
    const match = tag.match(STABLE_TAG_RE);
    if (!match) {
      continue;
    }
    return { tag: tag.startsWith('v') ? tag : `v${match[1]}`, version: match[1] };
  }

  throw new Error(
    `No stable X.Y.Z tag found in the first ${tags.length} tags of ${SIGNAL_REPO}`
  );
}

/**
 * @param {string} signalRef e.g. v8.22.0
 * @returns {boolean}
 */
function hasOpenSyncPullRequest(signalRef) {
  const repo =
    process.env.MINUTES_GITHUB_REPO ??
    process.env.GITHUB_REPOSITORY ??
    'zmitko-uni/minutes';

  const raw = runGh(
    `pr list --repo "${repo}" --state open --limit 50 --json title,headRefName`
  );
  /** @type {Array<{ title?: string, headRefName?: string }>} */
  const prs = JSON.parse(raw || '[]');
  const needle = signalRef.toLowerCase();

  return prs.some(pr => {
    const title = (pr.title ?? '').toLowerCase();
    const head = (pr.headRefName ?? '').toLowerCase();
    return (
      title.includes('sync signal') &&
      (title.includes(needle) || head.includes(needle.replace(/^v/, '')))
    );
  });
}

/**
 * @param {string} key
 * @param {string} value
 */
function setOutput(key, value) {
  const line = `${key}=${value}`;
  console.log(line);
  const outFile = process.env.GITHUB_OUTPUT;
  if (outFile) {
    appendFileSync(outFile, `${line}\n`);
  }
}

const currentBase = readMinutesSignalBaseVersion();
const currentParsed = parseStableSemver(currentBase);
if (!currentParsed) {
  throw new Error(
    `MINUTES_SIGNAL_BASE_VERSION "${currentBase}" is not a stable X.Y.Z semver`
  );
}

const latest = fetchLatestStableSignalTag();
const latestParsed = parseStableSemver(latest.version);
if (!latestParsed) {
  throw new Error(`Latest stable tag "${latest.tag}" failed to parse`);
}

const isNewer = compareSemver(latestParsed, currentParsed) === 1;
let shouldSync = isNewer;
let reason = isNewer
  ? `Signal ${latest.tag} is newer than Minutes base ${currentBase}`
  : `Minutes base ${currentBase} is up to date (latest stable ${latest.tag})`;

if (shouldSync && hasOpenSyncPullRequest(latest.tag)) {
  shouldSync = false;
  reason = `Open sync PR already exists for ${latest.tag}`;
}

console.log(`current_base=${currentBase}`);
console.log(`latest_stable=${latest.tag}`);
console.log(`reason=${reason}`);

setOutput('should_sync', shouldSync ? 'true' : 'false');
setOutput('signal_ref', latest.tag);
setOutput('current_base', currentBase);
setOutput('latest_stable', latest.tag);

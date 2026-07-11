#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// Close issues verified in beta and released to prod.
// Usage:
//   pnpm run issues:close-retest           (všechna s to-retest)
//   pnpm run issues:close-retest -- 7 8
// Requires: gh CLI authenticated (gh auth login)

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { MINUTES_RETEST_LABEL } from './utils/parseMinutesVersion.mjs';
import { ensureGhAuth, runGh } from './utils/runGh.mjs';

const repo = process.env.MINUTES_GITHUB_REPO ?? 'zmitko-uni/minutes';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readProdVersion() {
  if (process.env.MINUTES_RELEASE_VERSION?.trim()) {
    return process.env.MINUTES_RELEASE_VERSION.trim();
  }

  try {
    const packageJson = JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8')
    );
    if (packageJson.version) {
      return packageJson.version;
    }
  } catch {
    // fall through
  }

  try {
    const tag = runGh(
      `release list --repo ${repo} --limit 1 --json tagName --jq '.[0].tagName // empty'`
    );
    if (tag) {
      return tag.replace(/^v/i, '');
    }
  } catch {
    // fall through
  }

  return 'unknown';
}

function parseIssueNumbers(argv) {
  const numbers = [];
  for (const arg of argv) {
    for (const part of arg.split(',')) {
      const trimmed = part.trim().replace(/^#/, '');
      const num = Number.parseInt(trimmed, 10);
      if (Number.isFinite(num) && num > 0) {
        numbers.push(num);
      }
    }
  }
  return [...new Set(numbers)];
}

function listOpenRetestIssueNumbers() {
  const json = runGh(
    `issue list --repo ${repo} --label "${MINUTES_RETEST_LABEL}" --state open --json number --limit 50`
  );
  /** @type {Array<{ number: number }>} */
  const issues = JSON.parse(json || '[]');
  return issues.map(issue => issue.number);
}

function addCloseComment(number, body) {
  const bodyPath = join(tmpdir(), `minutes-close-issue-${number}.md`);
  writeFileSync(bodyPath, body, 'utf8');
  try {
    runGh(
      `issue comment ${number} --repo ${repo} --body-file "${bodyPath}"`
    );
  } finally {
    try {
      unlinkSync(bodyPath);
    } catch {
      // ignore
    }
  }
}

function issueHasRetestLabel(number) {
  const json = runGh(
    `issue view ${number} --repo ${repo} --json labels --jq '.labels[].name'`
  );
  return json.split('\n').some(name => name.trim() === MINUTES_RETEST_LABEL);
}

ensureGhAuth();

const version = readProdVersion();
const closeComment =
  process.env.MINUTES_CLOSE_COMMENT?.trim() ??
  `Ověřeno v beta buildu. Oprava vydána v prod release Minutes ${version}.`;

let issueNumbers = parseIssueNumbers(process.argv.slice(2));
if (issueNumbers.length === 0) {
  issueNumbers = listOpenRetestIssueNumbers();
}

if (issueNumbers.length === 0) {
  console.log(`Žádná otevřená issue s labelem "${MINUTES_RETEST_LABEL}".`);
  process.exit(0);
}

let closedCount = 0;

for (const number of issueNumbers) {
  if (!issueHasRetestLabel(number)) {
    console.warn(
      `#${number} přeskočeno — nemá label "${MINUTES_RETEST_LABEL}".`
    );
    continue;
  }

  addCloseComment(number, closeComment);
  runGh(
    `issue edit ${number} --repo ${repo} --remove-label "${MINUTES_RETEST_LABEL}"`
  );
  runGh(`issue close ${number} --repo ${repo}`);
  console.log(`#${number} uzavřeno (prod ${version})`);
  closedCount += 1;
}

console.log(`\nHotovo (${closedCount} issues).`);

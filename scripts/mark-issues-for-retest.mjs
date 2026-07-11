#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// After beta release: remove potvrzeno-k-oprave, add to-retest on fixed issues.
// Usage:
//   pnpm run issues:retest -- 7 8
//   pnpm run issues:retest -- 7,8
// Requires: gh CLI authenticated (gh auth login)

import { execSync } from 'node:child_process';

import {
  MINUTES_CONFIRMED_FIX_LABEL,
  MINUTES_RETEST_LABEL,
} from './utils/parseMinutesVersion.mjs';

const repo = process.env.MINUTES_GITHUB_REPO ?? 'zmitko-uni/minutes';

function runGh(args) {
  return execSync(`gh ${args}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function ensureGhAuth() {
  try {
    runGh('auth status');
  } catch {
    console.error('GitHub CLI není přihlášené. Spusť: gh auth login');
    process.exit(1);
  }
}

function ensureLabel(name, color, description) {
  try {
    runGh(
      `label list --repo ${repo} --json name --jq '.[].name'`
    );
  } catch {
    // list failed — try create below
  }

  try {
    runGh(`label create "${name}" --repo ${repo} --color ${color} --description "${description}" --force`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('already exists')) {
      throw error;
    }
  }
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

ensureGhAuth();

const issueNumbers = parseIssueNumbers(process.argv.slice(2));
if (issueNumbers.length === 0) {
  console.error('Zadej čísla issues: pnpm run issues:retest -- 7 8');
  process.exit(1);
}

ensureLabel(
  MINUTES_RETEST_LABEL,
  'FBCA04',
  'Opraveno v beta buildu — čeká retest'
);

for (const number of issueNumbers) {
  runGh(
    `issue edit ${number} --repo ${repo} --remove-label "${MINUTES_CONFIRMED_FIX_LABEL}" --add-label "${MINUTES_RETEST_LABEL}"`
  );
  console.log(`#${number} → label "${MINUTES_RETEST_LABEL}" (odebrán "${MINUTES_CONFIRMED_FIX_LABEL}")`);
}

console.log(`\nHotovo (${issueNumbers.length} issues).`);

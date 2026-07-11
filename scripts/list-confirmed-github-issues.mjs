#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// List open GitHub issues labeled for confirmed fixes.
// Usage: pnpm run issues:confirmed
// Requires: gh CLI authenticated (gh auth login)

import { execSync } from 'node:child_process';

import { MINUTES_CONFIRMED_FIX_LABEL } from './utils/parseMinutesVersion.mjs';

const repo = process.env.MINUTES_GITHUB_REPO ?? 'zmitko-uni/minutes';

function runGh(args) {
  return execSync(`gh ${args}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

try {
  runGh('auth status');
} catch {
  console.error('GitHub CLI není přihlášené. Spusť: gh auth login');
  process.exit(1);
}

const label = encodeURIComponent(MINUTES_CONFIRMED_FIX_LABEL);
let json;

try {
  json = runGh(
    `issue list --repo ${repo} --label "${MINUTES_CONFIRMED_FIX_LABEL}" --state open --json number,title,url,labels,createdAt --limit 50`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Could not find label')) {
    console.error(
      `Label "${MINUTES_CONFIRMED_FIX_LABEL}" na ${repo} neexistuje.`
    );
    console.error('Vytvoř ho:');
    console.error(
      `  gh label create "${MINUTES_CONFIRMED_FIX_LABEL}" --repo ${repo} --color 0E8A16 --description "Schváleno k opravě (beta flow)"`
    );
    process.exit(1);
  }
  throw error;
}

/** @type {Array<{ number: number; title: string; url: string; createdAt: string }>} */
const issues = JSON.parse(json || '[]');

if (issues.length === 0) {
  console.log(`Žádné otevřené issues s labelem "${MINUTES_CONFIRMED_FIX_LABEL}".`);
  process.exit(0);
}

console.log(
  `Otevřené issues s labelem "${MINUTES_CONFIRMED_FIX_LABEL}" (${issues.length}):\n`
);

for (const issue of issues) {
  console.log(`#${issue.number}  ${issue.title}`);
  console.log(`    ${issue.url}`);
  console.log(`    vytvořeno: ${issue.createdAt}`);
  console.log('');
}

console.log('Nejstarší k opravě: #' + issues[issues.length - 1].number);

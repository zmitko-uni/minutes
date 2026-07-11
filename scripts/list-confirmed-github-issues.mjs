#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// List open GitHub issues labeled for confirmed fixes.
// Usage: pnpm run issues:confirmed
// Requires: gh CLI authenticated (gh auth login)

import { MINUTES_CONFIRMED_FIX_LABEL } from './utils/parseMinutesVersion.mjs';
import { ensureGhAuth, runGh } from './utils/runGh.mjs';

const repo = process.env.MINUTES_GITHUB_REPO ?? 'zmitko-uni/minutes';

ensureGhAuth();

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
const issues = JSON.parse(json || '[]').sort(
  (left, right) =>
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
);

if (issues.length === 0) {
  console.log(`Žádné otevřené issues s labelem "${MINUTES_CONFIRMED_FIX_LABEL}".`);
  process.exit(0);
}

console.log(
  `Otevřené issues s labelem "${MINUTES_CONFIRMED_FIX_LABEL}" (${issues.length}) — opravit všechna:\n`
);

for (const issue of issues) {
  console.log(`#${issue.number}  ${issue.title}`);
  console.log(`    ${issue.url}`);
  console.log(`    vytvořeno: ${issue.createdAt}`);
  console.log('');
}

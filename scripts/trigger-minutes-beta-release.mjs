#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// Spustí GitHub Actions "Release Minutes" pro beta kanál.
// Usage: pnpm run release:minutes:beta:trigger
// Requires: gh CLI authenticated (gh auth login)

import { execSync } from 'node:child_process';

const repo = process.env.MINUTES_GITHUB_REPO ?? 'zmitko-uni/minutes';
const workflowFile = 'minutes-release.yml';
const ref = process.env.MINUTES_BETA_BRANCH ?? 'beta';

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

runGh(
  `workflow run ${workflowFile} --repo ${repo} --ref ${ref} -f release_channel=beta`
);

console.log(
  `Spuštěn workflow Release Minutes (beta) na branchi ${ref} v ${repo}.`
);
console.log(`Sleduj: https://github.com/${repo}/actions/workflows/${workflowFile}`);

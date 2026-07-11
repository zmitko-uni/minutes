#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// Spustí GitHub Actions "Release Minutes" pro prod kanál.
// Usage: pnpm run release:minutes:prod:trigger
// Requires: gh CLI authenticated (gh auth login)

import { ensureGhAuth, runGh } from './utils/runGh.mjs';

const repo = process.env.MINUTES_GITHUB_REPO ?? 'zmitko-uni/minutes';
const workflowFile = 'minutes-release.yml';
const ref = process.env.MINUTES_PROD_BRANCH ?? 'main';

ensureGhAuth();

runGh(
  `workflow run ${workflowFile} --repo ${repo} --ref ${ref} -f release_channel=prod`
);

console.log(
  `Spuštěn workflow Release Minutes (prod) na branchi ${ref} v ${repo}.`
);
console.log(`Sleduj: https://github.com/${repo}/actions/workflows/${workflowFile}`);

#!/usr/bin/env node
// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { mergePackageJson } from './utils/mergePackageJson.mjs';

const PACKAGE_JSON = 'package.json';
const LOCKFILE = 'pnpm-lock.yaml';
const CHATS_TAB = 'ts/components/ChatsTab.dom.tsx';
const ALLOWED_CONFLICTS = new Set([PACKAGE_JSON, LOCKFILE, CHATS_TAB]);

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function readStage(stage, file) {
  return git('show', `:${stage}:${file}`);
}

function resolvePackageJson() {
  const base = JSON.parse(readStage(1, PACKAGE_JSON));
  const ours = JSON.parse(readStage(2, PACKAGE_JSON));
  const theirs = JSON.parse(readStage(3, PACKAGE_JSON));
  const merged = mergePackageJson(base, ours, theirs);
  writeFileSync(PACKAGE_JSON, `${JSON.stringify(merged, null, 2)}\n`);
}

function resolveLockfile() {
  // The workflow regenerates the lockfile after package.json is resolved.
  writeFileSync(LOCKFILE, readStage(3, LOCKFILE));
}

function resolveChatsTab() {
  const ours = readStage(2, CHATS_TAB);
  if (!ours.includes('MinutesWelcomeSplash')) {
    throw new Error(
      `${CHATS_TAB} no longer contains MinutesWelcomeSplash; refusing automatic resolution`
    );
  }
  writeFileSync(CHATS_TAB, ours);
}

export function resolveUpstreamConflicts() {
  const conflicts = git('diff', '--name-only', '--diff-filter=U')
    .trim()
    .split('\n')
    .filter(Boolean);
  const unexpected = conflicts.filter(file => !ALLOWED_CONFLICTS.has(file));

  if (unexpected.length > 0) {
    throw new Error(
      `Refusing to auto-resolve unexpected conflicts:\n${unexpected.map(file => `- ${file}`).join('\n')}`
    );
  }
  if (conflicts.length === 0) {
    throw new Error('Merge failed without any unresolved files');
  }

  if (conflicts.includes(PACKAGE_JSON)) {
    resolvePackageJson();
  }
  if (conflicts.includes(LOCKFILE)) {
    resolveLockfile();
  }
  if (conflicts.includes(CHATS_TAB)) {
    resolveChatsTab();
  }

  git('add', '--', ...conflicts);
  const remaining = git('diff', '--name-only', '--diff-filter=U').trim();
  if (remaining) {
    throw new Error(`Unresolved conflicts remain:\n${remaining}`);
  }

  console.log(
    `Automatically resolved known conflicts: ${conflicts.join(', ')}`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  resolveUpstreamConflicts();
}

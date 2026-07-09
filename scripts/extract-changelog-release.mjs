#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// Extract release notes for GitHub Release from CHANGELOG.md.
// Usage: node scripts/extract-changelog-release.mjs [version]
// Writes markdown to stdout.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf8')
);
const version = process.argv[2] ?? packageJson.version;
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');

function extractSection(headerText) {
  const idx = changelog.indexOf(headerText);
  if (idx === -1) {
    return null;
  }

  const start = idx + headerText.length;
  const rest = changelog.slice(start);
  const nextMatch = rest.match(/\n## \[/);
  const end = nextMatch ? nextMatch.index : rest.length;

  return rest.slice(0, end).trim();
}

const versionHeader = `## [${version}]`;
let section =
  extractSection(versionHeader) ?? extractSection('## [Unreleased]');

if (!section) {
  section =
    'Viz [CHANGELOG.md](https://github.com/zmitko-uni/minutes/blob/main/CHANGELOG.md) v repozitáři.';
}

const downloadBlock = `
---

### Stažení

- **Instalátor:** [Minutes-setup-windows-x64.exe](https://github.com/zmitko-uni/minutes/releases/download/v${version}/Minutes-setup-windows-x64.exe)
- Verzovaný soubor: \`Minutes-setup-${version}.exe\`

### Instalace

1. Stáhněte \`.exe\`
2. Windows SmartScreen může varovat (unsigned) → *Více informací* → *Přesto spustit*
3. Data uživatele: \`%APPDATA%\\uuMinutes-uuminutes\` (při odinstalaci se nemazou)

### Aktualizace

Auto-update je vypnuto. Novou verzi stáhněte z [Releases](https://github.com/zmitko-uni/minutes/releases/latest) a nainstalujte přes stávající instalaci.

Viz [CHANGELOG.md](https://github.com/zmitko-uni/minutes/blob/main/CHANGELOG.md) a [README-UUMINUTES.md](https://github.com/zmitko-uni/minutes/blob/main/README-UUMINUTES.md).
`.trim();

process.stdout.write(`## Minutes ${version}\n\n${section}\n\n${downloadBlock}\n`);

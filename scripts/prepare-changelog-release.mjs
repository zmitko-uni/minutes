#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// Promote CHANGELOG [Unreleased] → [version] before GitHub Release.
// Usage: node scripts/prepare-changelog-release.mjs <version>
// If [Unreleased] is empty/placeholder, fills notes from git commits since last tag.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const changelogPath = join(root, 'CHANGELOG.md');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/prepare-changelog-release.mjs <version>');
  process.exit(1);
}

const UNRELEASED_HEADER = '## [Unreleased]';
const EMPTY_UNRELEASED = `${UNRELEASED_HEADER}

### Added
- (doplňte před příštím release)
`;

function isPlaceholderLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.length === 0 ||
    trimmed === '### Added' ||
    trimmed === '### Changed' ||
    trimmed === '### Fixed' ||
    trimmed === '### Removed' ||
    trimmed === '### Known limitations' ||
    /^- \(doplňte/i.test(trimmed) ||
    /^- \(dopln/i.test(trimmed)
  );
}

function isPlaceholderOnly(content) {
  const lines = content.replace(/\r/g, '').split('\n');
  const meaningful = lines.filter(line => !isPlaceholderLine(line));
  return meaningful.length === 0;
}

function getPreviousTag() {
  try {
    return execSync('git describe --tags --abbrev=0', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function getCommitSubjectsSinceTag(previousTag) {
  const range = previousTag ? `${previousTag}..HEAD` : 'HEAD';
  const raw = execSync(`git log ${range} --pretty=format:%s --no-merges`, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

  if (!raw) {
    return [];
  }

  return [...new Set(raw.split('\n').map(line => line.trim()).filter(Boolean))];
}

function categorizeCommit(subject) {
  const lower = subject.toLowerCase();
  if (/^(feat|add|new)(\(|:| )/.test(lower)) {
    return 'added';
  }
  if (/^fix(\(|:| )/.test(lower)) {
    return 'fixed';
  }
  if (/^(chore\(release\)|release:|bump version)/.test(lower)) {
    return 'skip';
  }
  return 'changed';
}

function formatCommitBullet(subject) {
  return `- ${subject.replace(/^\w+(\([^)]+\))?:\s*/, '') || subject}`;
}

function generateNotesFromGit(previousTag) {
  const subjects = getCommitSubjectsSinceTag(previousTag);
  const sections = {
    added: [],
    changed: [],
    fixed: [],
  };

  for (const subject of subjects) {
    const bucket = categorizeCommit(subject);
    if (bucket === 'skip') {
      continue;
    }
    sections[bucket].push(formatCommitBullet(subject));
  }

  const parts = [];
  if (sections.added.length > 0) {
    parts.push('### Added', ...sections.added, '');
  }
  if (sections.changed.length > 0) {
    parts.push('### Changed', ...sections.changed, '');
  }
  if (sections.fixed.length > 0) {
    parts.push('### Fixed', ...sections.fixed, '');
  }

  if (parts.length === 0) {
    const since = previousTag ?? 'počátku historie';
    return `### Changed
- Release ${version} (viz git historie od ${since}).
`;
  }

  return `${parts.join('\n').trim()}\n`;
}

function splitUnreleasedSection(changelog) {
  const unreleasedIdx = changelog.indexOf(UNRELEASED_HEADER);
  if (unreleasedIdx === -1) {
    throw new Error('CHANGELOG.md must contain ## [Unreleased]');
  }

  const headerEnd = unreleasedIdx + UNRELEASED_HEADER.length;
  const tail = changelog.slice(headerEnd);
  const nextSection = tail.match(/\n## \[/);
  const unreleasedEnd = nextSection
    ? headerEnd + nextSection.index
    : changelog.length;

  return {
    before: changelog.slice(0, unreleasedIdx),
    unreleasedContent: changelog.slice(headerEnd, unreleasedEnd).trim(),
    after: changelog.slice(unreleasedEnd),
  };
}

let changelog = readFileSync(changelogPath, 'utf8');

if (changelog.includes(`## [${version}]`)) {
  console.log(`CHANGELOG.md already contains section for ${version} — skipping.`);
  process.exit(0);
}

const { before, unreleasedContent, after } = splitUnreleasedSection(changelog);
const previousTag = getPreviousTag();

let releaseBody = unreleasedContent;
if (isPlaceholderOnly(releaseBody)) {
  console.log(
    previousTag
      ? `[Unreleased] is empty — generating notes from git log ${previousTag}..HEAD`
      : '[Unreleased] is empty — generating notes from recent git history'
  );
  releaseBody = generateNotesFromGit(previousTag);
} else {
  console.log(`Promoting CHANGELOG [Unreleased] → [${version}]`);
}

const date = new Date().toISOString().slice(0, 10);
const versionSection = `## [${version}] - ${date}\n\n${releaseBody.trim()}\n`;
const afterNormalized = after.startsWith('\n') ? after : `\n${after}`;

const nextChangelog = `${before}${EMPTY_UNRELEASED}\n${versionSection}${afterNormalized}`.replace(
  /\n{3,}/g,
  '\n\n'
);

writeFileSync(changelogPath, nextChangelog.endsWith('\n') ? nextChangelog : `${nextChangelog}\n`, 'utf8');

console.log(`Updated CHANGELOG.md for Minutes ${version}`);

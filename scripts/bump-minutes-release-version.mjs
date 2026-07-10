// Bump package.json version before each minutes release installer build.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseVersion } from './utils/parseVersion.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = join(root, 'package.json');

function bumpReleaseVersion(version) {
  const info = parseVersion(version);

  if (info.prepatch != null) {
    return `${info.major}.${info.minor}.${info.patch}-${info.channel}.${info.prepatch + 1}`;
  }

  return `${info.major}.${info.minor}.${info.patch + 1}`;
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const previousVersion = packageJson.version;
const nextVersion = bumpReleaseVersion(previousVersion);

packageJson.version = nextVersion;

writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

console.log('minutes release version bump');
console.log(`  Previous: ${previousVersion}`);
console.log(`  New:      ${nextVersion}`);

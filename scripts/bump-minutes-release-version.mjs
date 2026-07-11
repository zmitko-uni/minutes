// Bump package.json version before each Minutes release installer build.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bumpMinutesBetaVersion,
  bumpMinutesVersion,
} from './utils/parseMinutesVersion.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = join(root, 'package.json');

/** @type {'prod' | 'beta'} */
const releaseChannel = process.env.MINUTES_RELEASE_CHANNEL === 'beta' ? 'beta' : 'prod';

/** @type {'major' | 'minor' | 'patch'} */
const bumpLevel = process.env.MINUTES_BUMP_LEVEL ?? 'patch';
if (!['major', 'minor', 'patch'].includes(bumpLevel)) {
  console.error('MINUTES_BUMP_LEVEL must be major, minor, or patch');
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const previousVersion = packageJson.version;
const nextVersion =
  releaseChannel === 'beta'
    ? bumpMinutesBetaVersion(previousVersion)
    : bumpMinutesVersion(previousVersion, bumpLevel);

packageJson.version = nextVersion;

writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

console.log('Minutes release version bump');
console.log(`  Channel:  ${releaseChannel}`);
console.log(`  Level:    ${releaseChannel === 'beta' ? 'beta increment' : bumpLevel}`);
console.log(`  Previous: ${previousVersion}`);
console.log(`  New:      ${nextVersion}`);

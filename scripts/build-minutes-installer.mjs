// Build a Windows NSIS installer for minutes (unsigned, for ad-hoc distribution).
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(label, command, env = {}) {
  console.log(`\n=== ${label} ===\n`);
  execSync(command, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: true,
  });
}

console.log('minutes Windows installer build');
console.log('This can take 15–30 minutes on first run.\n');

if (process.env.MINUTES_SKIP_VERSION_BUMP !== '1') {
  run('Release version bump', 'pnpm run bump:minutes:release');
} else {
  console.log('Skipping version bump (MINUTES_SKIP_VERSION_BUMP=1)\n');
}

run('Icons', 'pnpm run build:minutes-icons');
if (process.env.MINUTES_SKIP_GENERATE !== '1') {
  run('Generate assets (locales, emoji, schema, …)', 'pnpm run generate');
} else {
  console.log('Skipping generate (MINUTES_SKIP_GENERATE=1)\n');
}
run('JavaScript bundles', 'pnpm run build:rolldown:prod');
run('Styles', 'pnpm run build:styles:prod');

const mainBundle = join(root, 'bundles', 'main.js');
if (!existsSync(mainBundle)) {
  console.error(`\nMissing ${mainBundle} — run build:rolldown:prod first.\n`);
  process.exit(1);
}

run(
  'NSIS installer (unsigned)',
  [
    'npx electron-builder',
    '--win nsis',
    '--x64',
    '--publish never',
    '--config electron-builder.minutes.mjs',
  ].join(' '),
  {
    NODE_OPTIONS: '--import=tsx',
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    SIGNAL_ENV: 'production',
    NODE_CONFIG_ENV: 'minutes',
  }
);

const outputDir = join(root, 'release', 'minutes');
const installers = readdirSync(outputDir).filter(name =>
  name.endsWith('.exe')
);

console.log('\n=== Done ===\n');
if (installers.length > 0) {
  for (const name of installers) {
    console.log(`  ${join(outputDir, name)}`);
  }
} else {
  console.log(`  Check output in: ${outputDir}`);
}

console.log(`
Notes:
  • Installer is NOT code-signed — Windows SmartScreen may warn on first run.
  • Recipient can click "More info" → "Run anyway".
  • User data stays in %APPDATA%\\Minutes (not removed on uninstall).
`);

// Patch electron.exe icon for minutes dev runs (`electron .` on Windows).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Data, NtExecutable, NtExecutableResource, Resource } from 'resedit';

const require = createRequire(import.meta.url);
const rootDir = join(import.meta.dirname, '..');
const iconPath = join(rootDir, 'build', 'icons', 'minutes', 'win', 'icon.ico');

if (process.platform !== 'win32') {
  process.exit(0);
}

if (!existsSync(iconPath)) {
  console.warn(`[minutes] skip electron icon patch — missing ${iconPath}`);
  process.exit(0);
}

let electronPath;
try {
  electronPath = require('electron');
} catch {
  console.warn('[minutes] skip electron icon patch — electron not installed');
  process.exit(0);
}

if (typeof electronPath !== 'string' || !existsSync(electronPath)) {
  console.warn('[minutes] skip electron icon patch — invalid electron path');
  process.exit(0);
}

try {
  const exeData = readFileSync(electronPath);
  const exe = NtExecutable.from(exeData, { ignoreCert: true });
  const res = NtExecutableResource.from(exe);

  const existingIconGroups = Resource.IconGroupEntry.fromEntries(res.entries);
  if (existingIconGroups.length === 0) {
    throw new Error('no icon group in electron.exe');
  }

  const iconFile = Data.IconFile.from(readFileSync(iconPath));
  Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    existingIconGroups[0].id,
    existingIconGroups[0].lang,
    iconFile.icons.map(item => item.data)
  );

  const versionInfoList = Resource.VersionInfo.fromEntries(res.entries);
  if (versionInfoList.length > 0) {
    const versionInfo = versionInfoList[0];
    versionInfo.setStringValues(
      { lang: versionInfoList[0].lang, codepage: versionInfoList[0].codepage },
      {
        ProductName: 'Minutes',
        FileDescription: 'Minutes',
      }
    );
    versionInfo.outputToResourceEntries(res.entries);
  }

  res.outputResource(exe);
  writeFileSync(electronPath, Buffer.from(exe.generate()));
  console.log(`[minutes] patched Windows icon on ${electronPath}`);
} catch (error) {
  console.warn(
    `[minutes] electron icon patch failed — taskbar may show Electron logo in dev: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
}

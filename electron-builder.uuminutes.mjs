// uuMinutes electron-builder profile — merges with package.json#build (keeps files/bundles).
import pkg from './package.json' with { type: 'json' };

/** @type {import('electron-builder').Configuration} */
export default {
  ...pkg.build,
  appId: 'org.minutes.desktop',
  directories: {
    ...pkg.build.directories,
    output: 'release/uuminutes',
  },
  win: {
    ...pkg.build.win,
    icon: 'build/icons/uuminutes/win/icon.ico',
    artifactName: 'Minutes-setup-${version}.${ext}',
    publish: null,
    signtoolOptions: {},
    asarUnpack: ['build/icons/uuminutes/win/icon.ico'],
  },
  nsis: {
    ...pkg.build.nsis,
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'build/icons/uuminutes/win/icon.ico',
    uninstallerIcon: 'build/icons/uuminutes/win/icon.ico',
    shortcutName: 'Minutes',
    deleteAppDataOnUninstall: false,
  },
  extraMetadata: {
    environment: 'production',
  },
};

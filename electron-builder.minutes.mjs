// minutes electron-builder profile — merges with package.json#build (keeps files/bundles).
import pkg from './package.json' with { type: 'json' };

const isBeta = process.env.MINUTES_RELEASE_CHANNEL === 'beta';

/** @type {import('electron-builder').Configuration} */
export default {
  ...pkg.build,
  productName: isBeta ? 'Minutes Beta' : 'Minutes',
  appId: isBeta ? 'org.minutes.desktop.beta' : 'org.minutes.desktop',
  directories: {
    ...pkg.build.directories,
    output: 'release/minutes',
  },
  win: {
    ...pkg.build.win,
    icon: 'build/icons/minutes/win/icon.ico',
    artifactName: isBeta
      ? 'Minutes-Beta-setup-${version}.${ext}'
      : 'Minutes-setup-${version}.${ext}',
    publish: null,
    signtoolOptions: {},
    asarUnpack: ['build/icons/minutes/win/icon.ico'],
  },
  nsis: {
    ...pkg.build.nsis,
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'build/icons/minutes/win/icon.ico',
    uninstallerIcon: 'build/icons/minutes/win/icon.ico',
    shortcutName: isBeta ? 'Minutes Beta' : 'Minutes',
    deleteAppDataOnUninstall: false,
  },
  extraMetadata: {
    environment: 'production',
    minutesChannel: isBeta ? 'beta' : 'prod',
  },
};

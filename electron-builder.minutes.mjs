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
  mac: {
    ...pkg.build.mac,
    target: [{ target: 'dmg', arch: ['arm64'] }],
    icon: 'build/icons/minutes/mac/icon.icns',
    artifactName: 'Minutes-${version}-mac-${arch}.${ext}',
    publish: null,
    // Minutes has no Apple Developer ID — build unsigned (ad-hoc), like the Windows build.
    identity: null,
    // Drop Signal's release-only signing hooks and update feed metadata.
    sign: undefined,
    signInstaller: undefined,
    releaseInfo: undefined,
    // Universal-build knobs; Minutes ships arm64-only.
    mergeASARs: undefined,
    singleArchFiles: undefined,
    extendInfo: {
      ...pkg.build.mac.extendInfo,
      NSMicrophoneUsageDescription:
        'Minutes potřebuje mikrofon pro nahrávání hovorů.',
      // macOS 14.4+ audio-capture TCC; system audio uses Screen Recording TCC (no key needed).
      NSAudioCaptureUsageDescription:
        'Minutes potřebuje zachytávat zvuk systému pro nahrávání hovorů.',
    },
  },
  dmg: {
    ...pkg.build.dmg,
    title: 'Minutes ${version}',
    // Drop Signal-branded artwork; use electron-builder defaults.
    background: null,
    icon: null,
    sign: false,
  },
  extraMetadata: {
    environment: 'production',
    minutesChannel: isBeta ? 'beta' : 'prod',
  },
};

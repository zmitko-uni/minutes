// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';

import { getAppRootDir } from '../ts/util/appRootDir.main.ts';
import { APP_DISPLAY_NAME } from '../ts/uuminutes/branding.std.ts';
import { isUuMinutesBrandingEnabled } from './uuminutes_icon.main.ts';

const TRAY_PREFIX = 'uuminutes-tray-icon';

export function getUuMinutesTrayToolTip(): string {
  return APP_DISPLAY_NAME;
}

export function resolveTrayIconImagePath(
  config: Readonly<{ has: (key: string) => boolean; get: (key: string) => unknown }>,
  size: number,
  unreadCount: number
): string {
  const prefix = isUuMinutesBrandingEnabled(config) ? TRAY_PREFIX : 'signal-tray-icon';
  const rootDir = getAppRootDir();

  let dirName: string;
  let fileName: string;

  if (unreadCount === 0) {
    dirName = 'base';
    fileName = `${prefix}-${size}x${size}-base.png`;
  } else if (unreadCount < 10) {
    dirName = 'alert';
    fileName = `${prefix}-${size}x${size}-alert-${unreadCount}.png`;
  } else {
    dirName = 'alert';
    fileName = `${prefix}-${size}x${size}-alert-9+.png`;
  }

  return join(rootDir, 'images', 'tray-icons', dirName, fileName);
}

export function resolveTrayToolTip(
  config: Readonly<{ has: (key: string) => boolean; get: (key: string) => unknown }>,
  signalDesktopLabel: string
): string {
  return isUuMinutesBrandingEnabled(config)
    ? getUuMinutesTrayToolTip()
    : signalDesktopLabel;
}

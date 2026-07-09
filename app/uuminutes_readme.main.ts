// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { getAppRootDir } from '../ts/util/appRootDir.main.ts';

export function getUuMinutesReadmePath(): string {
  return join(getAppRootDir(), 'images', 'uuminutes', 'prirucka.md');
}

export async function readUuMinutesReadmeContent(): Promise<string> {
  return readFile(getUuMinutesReadmePath(), 'utf8');
}

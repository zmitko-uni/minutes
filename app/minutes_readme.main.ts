// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { getAppRootDir } from '../ts/util/appRootDir.main.ts';

export function getMinutesReadmePath(): string {
  return join(getAppRootDir(), 'images', 'minutes', 'prirucka.md');
}

export async function readMinutesReadmeContent(): Promise<string> {
  return readFile(getMinutesReadmePath(), 'utf8');
}

// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { setOnLogCallback } from '../logging/log.std.ts';

const MAX_BUFFER_LINES = 500;

const buffer: Array<string> = [];

function levelToName(level: number): string {
  if (level >= 60) {
    return 'fatal';
  }
  if (level >= 50) {
    return 'error';
  }
  if (level >= 40) {
    return 'warn';
  }
  if (level >= 30) {
    return 'info';
  }
  if (level >= 20) {
    return 'debug';
  }
  return 'trace';
}

function appendLine(
  level: number,
  msgPrefix: string | undefined,
  logLine: string
): void {
  const prefix = msgPrefix ?? '';
  if (!/uuminutes/i.test(prefix) && !/uuminutes/i.test(logLine)) {
    return;
  }

  const line = `${new Date().toISOString()} ${levelToName(level)} ${prefix}${logLine}`;
  buffer.push(line);
  while (buffer.length > MAX_BUFFER_LINES) {
    buffer.shift();
  }
}

export function initializeUuMinutesLogBuffer(): void {
  setOnLogCallback((level, logLine, msgPrefix) => {
    appendLine(level, msgPrefix, logLine);
  });
}

export function getUuMinutesLogBufferText(): string {
  return buffer.join('\n');
}

export function clearUuMinutesLogBuffer(): void {
  buffer.length = 0;
}

export async function getUuMinutesLogText(): Promise<string> {
  const fileTail = await ipcRenderer.invoke('uuminutes:read-recent-logs');
  const buffered = getUuMinutesLogBufferText();

  const sections: Array<string> = [];
  if (typeof fileTail === 'string' && fileTail.trim().length > 0) {
    sections.push('=== app.log (tail) ===', fileTail.trim());
  }
  if (buffered.trim().length > 0) {
    sections.push('=== uuMinutes session buffer ===', buffered.trim());
  }

  if (sections.length === 0) {
    return 'No uuMinutes logs captured yet. Try Summarize again, then refresh.';
  }

  return sections.join('\n\n');
}

// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export const SNIPPET_CONTEXT_CHARS = 70;

/** Nález fulltextu v uloženém přepisu nebo shrnutí. */
export type RecordingTextMatch = Readonly<{
  /** Cesta nahrávky bez přípony — páruje se přes `getRecordingBasePath`. */
  basePath: string;
  snippet: string;
  source: 'transcript' | 'summary';
}>;

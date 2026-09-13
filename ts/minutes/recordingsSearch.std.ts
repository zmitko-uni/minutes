// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export const SNIPPET_CONTEXT_CHARS = 70;

/** Kratší dotaz by označil skoro celý text — nehledá se ani nezvýrazňuje. */
export const MIN_SEARCH_QUERY_LENGTH = 2;

/** Delší seznam nálezů už se v seznamu neprolistuje — zbytek zahodíme. */
export const MAX_HITS_PER_RECORDING = 50;

/** Jeden výskyt hledaného textu v přepisu nebo ve shrnutí. */
export type RecordingTextHit = Readonly<{
  source: 'transcript' | 'summary';
  /**
   * Pořadí výskytu v daném textu (0 = první). Detail podle něj zvýrazní
   * a doskroluje právě ten nález, na který uživatel v seznamu klikl.
   */
  index: number;
  snippet: string;
}>;

/** Nálezy fulltextu u jedné nahrávky — nejdřív ze shrnutí, pak z přepisu. */
export type RecordingTextMatch = Readonly<{
  /** Cesta nahrávky bez přípony — páruje se přes `getRecordingBasePath`. */
  basePath: string;
  hits: ReadonlyArray<RecordingTextHit>;
}>;

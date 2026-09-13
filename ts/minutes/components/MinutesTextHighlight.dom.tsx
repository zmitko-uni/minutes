// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, type ReactNode, type RefObject } from 'react';

/** Co zvýraznit a který výskyt je ten, na který uživatel klikl v seznamu. */
export type MinutesTextHighlight = Readonly<{
  query: string;
  /** Pořadí aktivního výskytu; `-1` = zvýraznit vše, nic nezvýraznit navíc. */
  activeIndex: number;
}>;

const HIGHLIGHT_CLASS = 'MinutesHighlight';
const ACTIVE_HIGHLIGHT_CLASS = 'MinutesHighlight--active';

export type MinutesTextRenderer = (
  text: string,
  keyPrefix: string
) => ReactNode;

const renderPlainText: MinutesTextRenderer = text => text;

/**
 * Vrátí funkci, která v textu obalí nalezené výskyty do `<mark>`. Počítadlo
 * běží v pořadí vykreslování, takže n-tý výskyt v panelu odpovídá n-tému
 * nálezu fulltextu — obojí čte stejný text ve stejném pořadí.
 *
 * Volá se v těle komponenty a spotřebuje se během jednoho renderu: text se
 * proto skládá voláním funkce, ne vnořenou komponentou, která by se
 * vykreslila až po rodiči a rozhodila pořadí.
 */
export function createMinutesTextRenderer(
  highlight: MinutesTextHighlight | null
): MinutesTextRenderer {
  const needle = highlight?.query.trim().toLowerCase() ?? '';
  if (needle.length === 0) {
    return renderPlainText;
  }

  let seen = 0;

  return (text, keyPrefix) => {
    const lower = text.toLowerCase();
    let found = lower.indexOf(needle);
    if (found < 0) {
      return text;
    }

    const parts: Array<ReactNode> = [];
    let cursor = 0;

    while (found >= 0) {
      if (found > cursor) {
        parts.push(text.slice(cursor, found));
      }
      parts.push(
        <mark
          key={`${keyPrefix}-mark-${seen}`}
          className={
            seen === highlight?.activeIndex
              ? `${HIGHLIGHT_CLASS} ${ACTIVE_HIGHLIGHT_CLASS}`
              : HIGHLIGHT_CLASS
          }
        >
          {text.slice(found, found + needle.length)}
        </mark>
      );
      seen += 1;
      cursor = found + needle.length;
      found = lower.indexOf(needle, cursor);
    }

    if (cursor < text.length) {
      parts.push(text.slice(cursor));
    }

    return parts;
  };
}

/** Doskroluje na aktivní nález po každé změně hledaného výskytu. */
export function useScrollToActiveHighlight(
  containerRef: RefObject<HTMLElement | null>,
  highlight: MinutesTextHighlight | null,
  contentLength: number
): void {
  const { query, activeIndex } = highlight ?? { query: '', activeIndex: -1 };

  useEffect(() => {
    if (query.trim().length === 0 || activeIndex < 0) {
      return;
    }
    containerRef.current
      ?.querySelector(`.${ACTIVE_HIGHLIGHT_CLASS}`)
      ?.scrollIntoView({ block: 'center' });
  }, [containerRef, query, activeIndex, contentLength]);
}

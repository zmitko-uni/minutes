// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

/**
 * Malá sada ikon pro Minutes UI. Kreslí se inline, aby fungovala stejně
 * na Windows i na macOS a nezáležela na upstream asset pipeline.
 */
export type MinutesIconName =
  | 'options'
  | 'pencil'
  | 'trash'
  | 'open'
  | 'bold'
  | 'italic'
  | 'bullets'
  | 'numbers'
  | 'link'
  | 'calendar'
  | 'refresh'
  | 'chat'
  | 'check'
  | 'tasks'
  | 'send'
  | 'plus'
  | 'share'
  | 'folder'
  | 'ai';

const PATHS: Readonly<Record<MinutesIconName, JSX.Element>> = {
  options: (
    <>
      <path d="M3 6h11" />
      <path d="M18 6h3" />
      <path d="M3 12h4" />
      <path d="M11 12h10" />
      <path d="M3 18h9" />
      <path d="M16 18h5" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="14" cy="18" r="2" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4 16.5V20z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
  open: (
    <>
      <path d="M13 4h7v7" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  share: (
    <>
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z" />
    </>
  ),
  ai: (
    <>
      <path d="M10 3l1.8 4.7L16.5 9.5 11.8 11.3 10 16l-1.8-4.7L3.5 9.5l4.7-1.8L10 3z" />
      <path d="M17 14l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9L17 14z" />
    </>
  ),
  bold: (
    <>
      <path d="M7 4h6a4 4 0 0 1 0 8H7z" />
      <path d="M7 12h7a4 4 0 0 1 0 8H7z" />
    </>
  ),
  italic: (
    <>
      <path d="M10 4h8" />
      <path d="M6 20h8" />
      <path d="M14 4 10 20" />
    </>
  ),
  bullets: (
    <>
      <circle cx="5" cy="7" r="1.5" />
      <circle cx="5" cy="17" r="1.5" />
      <path d="M10 7h10" />
      <path d="M10 17h10" />
    </>
  ),
  numbers: (
    <>
      <path d="M4 5h2v5" />
      <path d="M4 15h3l-3 4h3" />
      <path d="M10 7h10" />
      <path d="M10 17h10" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a3 3 0 0 0 4.2 0l3-3a3 3 0 0 0-4.2-4.2L11.5 7" />
      <path d="M14 11a3 3 0 0 0-4.2 0l-3 3a3 3 0 0 0 4.2 4.2L12.5 17" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.5-5.8" />
      <path d="M20 4v4h-4" />
    </>
  ),
  chat: (
    <>
      <path d="M20 12a8 8 0 0 1-8 8H8l-4 3v-5.4A8 8 0 0 1 12 4a8 8 0 0 1 8 8z" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </>
  ),
  check: (
    <>
      <path d="M5 13l4 4L19 7" />
    </>
  ),
  tasks: (
    <>
      <path d="M4 7l2 2 3-3" />
      <path d="M4 17l2 2 3-3" />
      <path d="M13 8h7" />
      <path d="M13 18h7" />
    </>
  ),
  send: (
    <>
      <path d="M4 12 20 4l-7 16-2-7z" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
};

export function MinutesIcon({
  name,
}: Readonly<{ name: MinutesIconName }>): JSX.Element {
  return (
    <svg
      className="MinutesIcon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

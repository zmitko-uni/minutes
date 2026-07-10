// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export const TRANSCRIPTION_CANCELLED_MESSAGE =
  'Přepis byl zrušen uživatelem.';

export function isTranscriptionCancelledError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message === TRANSCRIPTION_CANCELLED_MESSAGE
  );
}

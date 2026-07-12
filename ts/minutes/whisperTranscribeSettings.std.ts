// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type WhisperDecodeMode = 'smart' | 'quality' | 'balanced' | 'fast';

export type WhisperDecodeParams = Readonly<{
  temperature: number;
  beam_size: number;
  best_of: number;
}>;

export type WhisperTranscribeSettingsPublic = Readonly<{
  /** 0 = auto (počet jader − 1). */
  threadCount: number;
  useGpu: boolean;
  decodeMode: WhisperDecodeMode;
}>;

export const DEFAULT_WHISPER_TRANSCRIBE_SETTINGS: WhisperTranscribeSettingsPublic =
  {
    threadCount: 0,
    useGpu: true,
    decodeMode: 'smart',
  };

/** Profily pro ruční režim „Kvalitní“. */
export const WHISPER_DECODE_PROFILES_QUALITY: ReadonlyArray<WhisperDecodeParams> =
  [
    { temperature: 0, beam_size: 8, best_of: 5 },
    { temperature: 0.2, beam_size: 8, best_of: 3 },
    { temperature: 0.4, beam_size: 5, best_of: 2 },
  ];

export const WHISPER_DECODE_PROFILES_BALANCED: ReadonlyArray<WhisperDecodeParams> =
  [{ temperature: 0, beam_size: 5, best_of: 2 }];

export const WHISPER_DECODE_PROFILES_FAST: ReadonlyArray<WhisperDecodeParams> =
  [{ temperature: 0, beam_size: 3, best_of: 1 }];

export const WHISPER_LONG_RECORDING_MS = 25 * 60 * 1000;

export const WHISPER_MEDIUM_RECORDING_MS = 10 * 60 * 1000;

export const WHISPER_DECODE_MODE_OPTIONS: ReadonlyArray<
  Readonly<{ id: WhisperDecodeMode; label: string; description: string }>
> = [
  {
    id: 'smart',
    label: 'Smart (doporučeno)',
    description:
      'Podle délky nahrávky: do 25 min vyvážený profil, delší hovory rychlý (1 profil).',
  },
  {
    id: 'quality',
    label: 'Kvalitní',
    description: 'Až 3 decode profily (beam 8) — nejpomalejší, nejvyšší přesnost.',
  },
  {
    id: 'balanced',
    label: 'Vyvážený',
    description: 'Jeden střední profil (beam 5) — rozumný kompromis.',
  },
  {
    id: 'fast',
    label: 'Rychlý',
    description: 'Jeden lehký profil (beam 3) — nejrychlejší, mírně horší přesnost.',
  },
];

export function normalizeWhisperTranscribeSettings(
  input: Partial<WhisperTranscribeSettingsPublic> | null | undefined
): WhisperTranscribeSettingsPublic {
  const threadCount =
    typeof input?.threadCount === 'number' && Number.isFinite(input.threadCount)
      ? Math.max(0, Math.round(input.threadCount))
      : DEFAULT_WHISPER_TRANSCRIBE_SETTINGS.threadCount;

  const decodeMode =
    input?.decodeMode === 'quality' ||
    input?.decodeMode === 'balanced' ||
    input?.decodeMode === 'fast' ||
    input?.decodeMode === 'smart'
      ? input.decodeMode
      : DEFAULT_WHISPER_TRANSCRIBE_SETTINGS.decodeMode;

  return {
    threadCount,
    useGpu: input?.useGpu ?? DEFAULT_WHISPER_TRANSCRIBE_SETTINGS.useGpu,
    decodeMode,
  };
}

export function resolveWhisperThreadCount(
  configured: number,
  cpuCount: number
): number {
  const cores = Math.max(1, cpuCount);
  if (configured > 0) {
    return Math.max(1, Math.min(configured, cores));
  }
  return Math.max(1, cores - 1);
}

export function resolveWhisperDecodeProfiles(options: {
  decodeMode: WhisperDecodeMode;
  pcmDurationMs: number;
}): ReadonlyArray<WhisperDecodeParams> {
  const { decodeMode, pcmDurationMs } = options;

  if (decodeMode === 'quality') {
    return WHISPER_DECODE_PROFILES_QUALITY;
  }
  if (decodeMode === 'balanced') {
    return WHISPER_DECODE_PROFILES_BALANCED;
  }
  if (decodeMode === 'fast') {
    return WHISPER_DECODE_PROFILES_FAST;
  }

  if (pcmDurationMs >= WHISPER_LONG_RECORDING_MS) {
    return WHISPER_DECODE_PROFILES_FAST;
  }
  return WHISPER_DECODE_PROFILES_BALANCED;
}

export function shouldUseLenientWeakTranscriptCheck(options: {
  decodeMode: WhisperDecodeMode;
  pcmDurationMs: number;
}): boolean {
  if (options.decodeMode === 'fast' || options.decodeMode === 'balanced') {
    return true;
  }
  if (options.decodeMode === 'smart') {
    return options.pcmDurationMs >= WHISPER_LONG_RECORDING_MS;
  }
  return false;
}

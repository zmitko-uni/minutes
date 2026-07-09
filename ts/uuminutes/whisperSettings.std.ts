// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/** Výchozí jazyk přepisu hovorů (Whisper language code). */
export const DEFAULT_WHISPER_LANGUAGE = 'cs';

/** Kontextové fráze z běžných hovorů — snižují halucinace Whisperu u češtiny. */
export const DEFAULT_WHISPER_PROMPT =
  'Toto je nahrávka hovoru v češtině. Přepisuj přesně mluvenou češtinu. ' +
  'Typické fráze: Jak se máš? Co jsi dělala? Co děláš? Dobré ráno. Dobrý den. ' +
  'Zapínám nahrávání. Po nákupu jsem jela. Dnes jsem byla u babičky. ' +
  'Nepřekládej do angličtiny. Nepřidávej jména, která nebyla vyslovena.';

export const WHISPER_DECODE_PROFILES: ReadonlyArray<
  Readonly<{
    temperature: number;
    beam_size: number;
    best_of: number;
  }>
> = [
  { temperature: 0, beam_size: 8, best_of: 5 },
  { temperature: 0.2, beam_size: 8, best_of: 3 },
  { temperature: 0.4, beam_size: 5, best_of: 2 },
];

export const WHISPER_VAD_MODEL_FILE = 'ggml-silero-v6.2.0.bin';
export const WHISPER_VAD_MODEL_URL =
  'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin';
export const WHISPER_VAD_MODEL_MIN_BYTES = 750_000;

export const RECORDING_PCM_SIDECAR_SUFFIX = '.pcm.f32';

export type WhisperModelDefinition = Readonly<{
  id: string;
  fileName: string;
  label: string;
  description: string;
  downloadUrl: string;
  minBytes: number;
  downloadLabel: string;
  recommended?: boolean;
}>;

const HF_BASE =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

/** Modely ke stažení — pořadí v UI. */
export const WHISPER_MODEL_CATALOG: ReadonlyArray<WhisperModelDefinition> = [
  {
    id: 'base',
    fileName: 'ggml-base.bin',
    label: 'Základní (base)',
    description: 'Nejrychlejší přepis, nižší přesnost',
    downloadUrl: `${HF_BASE}/ggml-base.bin`,
    minBytes: 100_000_000,
    downloadLabel: 'cca 150 MB',
  },
  {
    id: 'small',
    fileName: 'ggml-small.bin',
    label: 'Doporučený (small)',
    description: 'Vyvážená kvalita pro češtinu',
    downloadUrl: `${HF_BASE}/ggml-small.bin`,
    minBytes: 400_000_000,
    downloadLabel: 'cca 470 MB',
    recommended: true,
  },
  {
    id: 'medium',
    fileName: 'ggml-medium.bin',
    label: 'Nejlepší (medium)',
    description: 'Nejvyšší přesnost, pomalejší a větší soubor',
    downloadUrl: `${HF_BASE}/ggml-medium.bin`,
    minBytes: 1_400_000_000,
    downloadLabel: 'cca 1,5 GB',
  },
  {
    id: 'large-v3-turbo',
    fileName: 'ggml-large-v3-turbo.bin',
    label: 'Large v3 Turbo',
    description: 'Velmi dobrá přesnost, rychlejší než full large',
    downloadUrl: `${HF_BASE}/ggml-large-v3-turbo.bin`,
    minBytes: 1_400_000_000,
    downloadLabel: 'cca 1,5 GB',
  },
  {
    id: 'large-v3',
    fileName: 'ggml-large-v3.bin',
    label: 'Nejvyšší (large v3)',
    description: 'Maximální přesnost pro češtinu, nejpomalejší',
    downloadUrl: `${HF_BASE}/ggml-large-v3.bin`,
    minBytes: 2_900_000_000,
    downloadLabel: 'cca 3,1 GB',
  },
];

export const DEFAULT_WHISPER_MODEL: WhisperModelDefinition =
  WHISPER_MODEL_CATALOG.find(model => model.recommended) ??
  WHISPER_MODEL_CATALOG[1]!;

export function getWhisperModelDefinition(
  fileName: string
): WhisperModelDefinition | undefined {
  return WHISPER_MODEL_CATALOG.find(model => model.fileName === fileName);
}

export function getWhisperModelMinBytes(fileName: string): number {
  return getWhisperModelDefinition(fileName)?.minBytes ?? 100_000_000;
}

export function getWhisperModelDownloadUrl(fileName: string): string {
  return (
    getWhisperModelDefinition(fileName)?.downloadUrl ??
    DEFAULT_WHISPER_MODEL.downloadUrl
  );
}

export function getWhisperModelDownloadLabel(fileName: string): string {
  return (
    getWhisperModelDefinition(fileName)?.downloadLabel ??
    DEFAULT_WHISPER_MODEL.downloadLabel
  );
}

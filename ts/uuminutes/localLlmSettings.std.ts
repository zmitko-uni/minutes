// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type LocalLlmModelDefinition = Readonly<{
  id: string;
  fileName: string;
  label: string;
  description: string;
  downloadUrl: string;
  minBytes: number;
  downloadLabel: string;
  recommended?: boolean;
}>;

const HF_GGML = 'https://huggingface.co/ggml-org';

/** Lokální GGUF modely pro AI sumarizaci — text-only (bez mmproj). */
export const LOCAL_LLM_MODEL_CATALOG: ReadonlyArray<LocalLlmModelDefinition> = [
  {
    id: 'gemma-3-4b',
    fileName: 'gemma-3-4b-it-Q4_K_M.gguf',
    label: 'Lehký (Gemma 3 4B)',
    description:
      'Nejrychlejší sumarizace, vhodné od 8 GB RAM. Dobrý start pro slabší PC.',
    downloadUrl: `${HF_GGML}/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf`,
    minBytes: 2_200_000_000,
    downloadLabel: 'cca 2,5 GB',
  },
  {
    id: 'gemma-3-12b',
    fileName: 'gemma-3-12b-it-Q4_K_M.gguf',
    label: 'Střední (Gemma 3 12B)',
    description: 'Kompromis kvalita/velikost, doporučeno od 12 GB RAM.',
    downloadUrl: `${HF_GGML}/gemma-3-12b-it-GGUF/resolve/main/gemma-3-12b-it-Q4_K_M.gguf`,
    minBytes: 6_800_000_000,
    downloadLabel: 'cca 7,5 GB',
  },
  {
    id: 'gemma-4-12b',
    fileName: 'gemma-4-12B-it-Q4_K_M.gguf',
    label: 'Doporučený (Gemma 4 12B)',
    description:
      'Nejlepší kvalita sumarizace. Vyžaduje cca 16 GB RAM nebo VRAM.',
    downloadUrl: `${HF_GGML}/gemma-4-12B-it-GGUF/resolve/main/gemma-4-12B-it-Q4_K_M.gguf`,
    minBytes: 6_500_000_000,
    downloadLabel: 'cca 7 GB',
    recommended: true,
  },
];

export const DEFAULT_LOCAL_LLM_MODEL: LocalLlmModelDefinition =
  LOCAL_LLM_MODEL_CATALOG.find(model => model.recommended) ??
  LOCAL_LLM_MODEL_CATALOG[2]!;

export const LOCAL_LLM_MODELS_DIR = 'uuMinutes/models/llm';

/** Staré/chybné názvy souborů z dřívějších verzí katalogu. */
const LOCAL_LLM_MODEL_FILE_ALIASES: Readonly<Record<string, string>> = {
  'gemma-4-12b-it-Q4_K_M.gguf': 'gemma-4-12B-it-Q4_K_M.gguf',
};

export function normalizeLocalLlmModelFileName(fileName: string): string {
  return LOCAL_LLM_MODEL_FILE_ALIASES[fileName] ?? fileName;
}

export function getLocalLlmModelDefinition(
  fileName: string
): LocalLlmModelDefinition | undefined {
  return LOCAL_LLM_MODEL_CATALOG.find(model => model.fileName === fileName);
}

export function getLocalLlmModelMinBytes(fileName: string): number {
  return getLocalLlmModelDefinition(fileName)?.minBytes ?? 2_000_000_000;
}

export function getLocalLlmModelDownloadUrl(fileName: string): string {
  return (
    getLocalLlmModelDefinition(fileName)?.downloadUrl ??
    DEFAULT_LOCAL_LLM_MODEL.downloadUrl
  );
}

export function getLocalLlmModelDownloadLabel(fileName: string): string {
  return (
    getLocalLlmModelDefinition(fileName)?.downloadLabel ??
    DEFAULT_LOCAL_LLM_MODEL.downloadLabel
  );
}

export function getLocalLlmModelLabel(fileName: string): string {
  return getLocalLlmModelDefinition(fileName)?.label ?? fileName;
}
